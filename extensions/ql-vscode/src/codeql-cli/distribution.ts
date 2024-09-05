import type { WriteStream } from "fs";
import { createWriteStream, mkdtemp, pathExists, remove } from "fs-extra";
import { tmpdir } from "os";
import { delimiter, dirname, join } from "path";
import { Range, satisfies } from "semver";
import type { Event, ExtensionContext } from "vscode";
import type { DistributionConfig } from "../config";
import { extLogger } from "../common/logging/vscode";
import type { VersionAndFeatures } from "./cli-version";
import { getCodeQlCliVersion } from "./cli-version";
import type { ProgressCallback } from "../common/vscode/progress";
import { reportStreamProgress } from "../common/vscode/progress";
import {
  codeQlLauncherName,
  deprecatedCodeQlLauncherName,
  getRequiredAssetName,
} from "../common/distribution";
import {
  InvocationRateLimiter,
  InvocationRateLimiterResultKind,
} from "../common/invocation-rate-limiter";
import {
  showAndLogErrorMessage,
  showAndLogWarningMessage,
} from "../common/logging";
import { unzipToDirectoryConcurrently } from "../common/unzip-concurrently";
import { reportUnzipProgress } from "../common/vscode/unzip-progress";
import type { Release } from "./distribution/release";
import { ReleasesApiConsumer } from "./distribution/releases-api-consumer";
import { createTimeoutSignal } from "../common/fetch-stream";
import { AbortError } from "node-fetch";

/**
 * distribution.ts
 * ------------
 *
 * Management of CodeQL CLI binaries.
 */

/**
 * Repository name with owner of the stable version of the extension-managed distribution on GitHub.
 */
const STABLE_DISTRIBUTION_REPOSITORY_NWO = "github/codeql-cli-binaries";

/**
 * Repository name with owner of the nightly version of the extension-managed distribution on GitHub.
 */
const NIGHTLY_DISTRIBUTION_REPOSITORY_NWO = "dsp-testing/codeql-cli-nightlies";

/**
 * Range of versions of the CLI that are compatible with the extension.
 *
 * This applies to both extension-managed and CLI distributions.
 */
export const DEFAULT_DISTRIBUTION_VERSION_RANGE: Range = new Range("2.x");

export interface DistributionProvider {
  getCodeQlPathWithoutVersionCheck(): Promise<string | undefined>;
  onDidChangeDistribution?: Event<void>;
  getDistribution(): Promise<FindDistributionResult>;
}

export class DistributionManager implements DistributionProvider {
  constructor(
    public readonly config: DistributionConfig,
    private readonly versionRange: Range,
    extensionContext: ExtensionContext,
  ) {
    this._onDidChangeDistribution = config.onDidChangeConfiguration;
    this.extensionSpecificDistributionManager =
      new ExtensionSpecificDistributionManager(
        config,
        versionRange,
        extensionContext,
      );
    this.updateCheckRateLimiter = new InvocationRateLimiter(
      extensionContext.globalState,
      "extensionSpecificDistributionUpdateCheck",
      () =>
        this.extensionSpecificDistributionManager.checkForUpdatesToDistribution(),
    );
  }

  /**
   * Look up a CodeQL launcher binary.
   */
  public async getDistribution(): Promise<FindDistributionResult> {
    const distribution = await this.getDistributionWithoutVersionCheck();
    if (distribution === undefined) {
      return {
        kind: FindDistributionResultKind.NoDistribution,
      };
    }
    const versionAndFeatures = await getCodeQlCliVersion(
      distribution.codeQlPath,
      extLogger,
    );
    if (versionAndFeatures === undefined) {
      return {
        distribution,
        kind: FindDistributionResultKind.UnknownCompatibilityDistribution,
      };
    }

    /**
     * Specifies whether prerelease versions of the CodeQL CLI should be accepted.
     *
     * Suppose a user sets the includePrerelease config option, obtains a prerelease, then decides
     * they no longer want a prerelease, so unsets the includePrerelease config option.
     * Unsetting the includePrerelease config option should trigger an update check, and this
     * update check should present them an update that returns them back to a non-prerelease
     * version.
     *
     * Therefore, we adopt the following:
     *
     * - If the user is managing their own CLI, they can use a prerelease without specifying the
     * includePrerelease option.
     * - If the user is using an extension-managed CLI, then prereleases are only accepted when the
     * includePrerelease config option is set.
     */
    const includePrerelease =
      distribution.kind !== DistributionKind.ExtensionManaged ||
      this.config.includePrerelease;

    if (
      !satisfies(versionAndFeatures.version, this.versionRange, {
        includePrerelease,
      })
    ) {
      return {
        distribution,
        kind: FindDistributionResultKind.IncompatibleDistribution,
        versionAndFeatures,
      };
    }
    return {
      distribution,
      kind: FindDistributionResultKind.CompatibleDistribution,
      versionAndFeatures,
    };
  }

  public async hasDistribution(): Promise<boolean> {
    const result = await this.getDistribution();
    return result.kind !== FindDistributionResultKind.NoDistribution;
  }

  public async getCodeQlPathWithoutVersionCheck(): Promise<string | undefined> {
    const distribution = await this.getDistributionWithoutVersionCheck();
    return distribution?.codeQlPath;
  }

  /**
   * Returns the path to a possibly-compatible CodeQL launcher binary, or undefined if a binary not be found.
   */
  async getDistributionWithoutVersionCheck(): Promise<
    Distribution | undefined
  > {
    // Check config setting, then extension specific distribution, then PATH.
    if (this.config.customCodeQlPath) {
      if (!(await pathExists(this.config.customCodeQlPath))) {
        void showAndLogErrorMessage(
          extLogger,
          `The CodeQL executable path is specified as "${this.config.customCodeQlPath}" ` +
            "by a configuration setting, but a CodeQL executable could not be found at that path. Please check " +
            "that a CodeQL executable exists at the specified path or remove the setting.",
        );
        return undefined;
      }

      // emit a warning if using a deprecated launcher and a non-deprecated launcher exists
      if (
        deprecatedCodeQlLauncherName() &&
        this.config.customCodeQlPath.endsWith(
          deprecatedCodeQlLauncherName()!,
        ) &&
        (await this.hasNewLauncherName())
      ) {
        warnDeprecatedLauncher();
      }
      return {
        codeQlPath: this.config.customCodeQlPath,
        kind: DistributionKind.CustomPathConfig,
      };
    }

    const extensionSpecificCodeQlPath =
      await this.extensionSpecificDistributionManager.getCodeQlPathWithoutVersionCheck();
    if (extensionSpecificCodeQlPath !== undefined) {
      return {
        codeQlPath: extensionSpecificCodeQlPath,
        kind: DistributionKind.ExtensionManaged,
      };
    }

    if (process.env.PATH) {
      for (const searchDirectory of process.env.PATH.split(delimiter)) {
        const expectedLauncherPath =
          await getExecutableFromDirectory(searchDirectory);
        if (expectedLauncherPath) {
          return {
            codeQlPath: expectedLauncherPath,
            kind: DistributionKind.PathEnvironmentVariable,
          };
        }
      }
      void extLogger.log("INFO: Could not find CodeQL on path.");
    }

    return undefined;
  }

  /**
   * Check for updates to the extension-managed distribution.  If one has not already been installed,
   * this will return an update available result with the latest available release.
   *
   * Returns a failed promise if an unexpected error occurs during installation.
   */
  public async checkForUpdatesToExtensionManagedDistribution(
    minSecondsSinceLastUpdateCheck: number,
  ): Promise<DistributionUpdateCheckResult> {
    const distribution = await this.getDistributionWithoutVersionCheck();
    if (distribution === undefined) {
      minSecondsSinceLastUpdateCheck = 0;
    }
    const extensionManagedCodeQlPath =
      await this.extensionSpecificDistributionManager.getCodeQlPathWithoutVersionCheck();
    if (distribution?.codeQlPath !== extensionManagedCodeQlPath) {
      // A distribution is present but it isn't managed by the extension.
      return createInvalidLocationResult();
    }
    const updateCheckResult =
      await this.updateCheckRateLimiter.invokeFunctionIfIntervalElapsed(
        minSecondsSinceLastUpdateCheck,
      );
    switch (updateCheckResult.kind) {
      case InvocationRateLimiterResultKind.Invoked:
        return updateCheckResult.result;
      case InvocationRateLimiterResultKind.RateLimited:
        return createAlreadyCheckedRecentlyResult();
    }
  }

  /**
   * Installs a release of the extension-managed distribution.
   *
   * Returns a failed promise if an unexpected error occurs during installation.
   */
  public installExtensionManagedDistributionRelease(
    release: Release,
    progressCallback?: ProgressCallback,
  ): Promise<void> {
    return this.extensionSpecificDistributionManager.installDistributionRelease(
      release,
      progressCallback,
    );
  }

  public get onDidChangeDistribution(): Event<void> | undefined {
    return this._onDidChangeDistribution;
  }

  /**
   * @return true if the non-deprecated launcher name exists on the file system
   * in the same directory as the specified launcher only if using an external
   * installation. False otherwise.
   */
  private async hasNewLauncherName(): Promise<boolean> {
    if (!this.config.customCodeQlPath) {
      // not managed externally
      return false;
    }
    const dir = dirname(this.config.customCodeQlPath);
    const newLaunderPath = join(dir, codeQlLauncherName());
    return await pathExists(newLaunderPath);
  }

  private readonly extensionSpecificDistributionManager: ExtensionSpecificDistributionManager;
  private readonly updateCheckRateLimiter: InvocationRateLimiter<DistributionUpdateCheckResult>;
  private readonly _onDidChangeDistribution: Event<void> | undefined;
}

class ExtensionSpecificDistributionManager {
  constructor(
    private readonly config: DistributionConfig,
    private readonly versionRange: Range,
    private readonly extensionContext: ExtensionContext,
  ) {
    /**/
  }

  public async getCodeQlPathWithoutVersionCheck(): Promise<string | undefined> {
    if (this.getInstalledRelease() !== undefined) {
      // An extension specific distribution has been installed.
      const expectedLauncherPath = await getExecutableFromDirectory(
        this.getDistributionRootPath(),
        true,
      );
      if (expectedLauncherPath) {
        return expectedLauncherPath;
      }

      try {
        await this.removeDistribution();
      } catch (e) {
        void extLogger.log(
          "WARNING: Tried to remove corrupted CodeQL CLI at " +
            `${this.getDistributionStoragePath()} but encountered an error: ${e}.`,
        );
      }
    }
    return undefined;
  }

  /**
   * Check for updates to the extension-managed distribution.  If one has not already been installed,
   * this will return an update available result with the latest available release.
   *
   * Returns a failed promise if an unexpected error occurs during installation.
   */
  public async checkForUpdatesToDistribution(): Promise<DistributionUpdateCheckResult> {
    const codeQlPath = await this.getCodeQlPathWithoutVersionCheck();
    const extensionSpecificRelease = this.getInstalledRelease();
    const latestRelease = await this.getLatestRelease();

    // v2.12.3 was released with a bug that causes the extension to fail
    // so we force the extension to ignore it.
    if (
      extensionSpecificRelease &&
      extensionSpecificRelease.name === "v2.12.3"
    ) {
      return createUpdateAvailableResult(latestRelease);
    }

    if (
      extensionSpecificRelease !== undefined &&
      codeQlPath !== undefined &&
      latestRelease.id === extensionSpecificRelease.id
    ) {
      return createAlreadyUpToDateResult();
    }
    return createUpdateAvailableResult(latestRelease);
  }

  /**
   * Installs a release of the extension-managed distribution.
   *
   * Returns a failed promise if an unexpected error occurs during installation.
   */
  public async installDistributionRelease(
    release: Release,
    progressCallback?: ProgressCallback,
  ): Promise<void> {
    await this.downloadDistribution(release, progressCallback);
    // Store the installed release within the global extension state.
    await this.storeInstalledRelease(release);
  }

  private async downloadDistribution(
    release: Release,
    progressCallback?: ProgressCallback,
  ): Promise<void> {
    try {
      await this.removeDistribution();
    } catch (e) {
      void extLogger.log(
        `Tried to clean up old version of CLI at ${this.getDistributionStoragePath()} ` +
          `but encountered an error: ${e}.`,
      );
    }

    // Filter assets to the unique one that we require.
    const requiredAssetName = getRequiredAssetName();
    const assets = release.assets.filter(
      (asset) => asset.name === requiredAssetName,
    );
    if (assets.length === 0) {
      throw new Error(
        `Invariant violation: chose a release to install that didn't have ${requiredAssetName}`,
      );
    }
    if (assets.length > 1) {
      void extLogger.log(
        `WARNING: chose a release with more than one asset to install, found ${assets
          .map((asset) => asset.name)
          .join(", ")}`,
      );
    }

    const {
      signal,
      onData,
      dispose: disposeTimeout,
    } = createTimeoutSignal(this.config.downloadTimeout);

    const tmpDirectory = await mkdtemp(join(tmpdir(), "vscode-codeql"));

    let archiveFile: WriteStream | undefined = undefined;

    try {
      const assetStream =
        await this.createReleasesApiConsumer().streamBinaryContentOfAsset(
          assets[0],
          signal,
        );

      const body = assetStream.body;
      if (!body) {
        throw new Error("No body in asset stream");
      }

      const archivePath = join(tmpDirectory, "distributionDownload.zip");
      archiveFile = createWriteStream(archivePath);

      const contentLength = assetStream.headers.get("content-length");
      const totalNumBytes = contentLength
        ? parseInt(contentLength, 10)
        : undefined;
      reportStreamProgress(
        body,
        `Downloading CodeQL CLI ${release.name}…`,
        totalNumBytes,
        progressCallback,
      );

      body.on("data", onData);

      await new Promise((resolve, reject) => {
        if (!archiveFile) {
          throw new Error("Invariant violation: archiveFile not set");
        }

        body.pipe(archiveFile).on("finish", resolve).on("error", reject);

        // If an error occurs on the body, we also want to reject the promise (e.g. during a timeout error).
        body.on("error", reject);
      });

      disposeTimeout();

      await this.bumpDistributionFolderIndex();

      void extLogger.log(
        `Extracting CodeQL CLI to ${this.getDistributionStoragePath()}`,
      );
      await unzipToDirectoryConcurrently(
        archivePath,
        this.getDistributionStoragePath(),
        progressCallback
          ? reportUnzipProgress(
              `Extracting CodeQL CLI ${release.name}…`,
              progressCallback,
            )
          : undefined,
      );
    } catch (e) {
      if (e instanceof AbortError) {
        const thrownError = new AbortError("The download timed out.");
        thrownError.stack = e.stack;
        throw thrownError;
      }

      throw e;
    } finally {
      disposeTimeout();

      archiveFile?.close();

      await remove(tmpDirectory);
    }
  }

  /**
   * Remove the extension-managed distribution.
   *
   * This should not be called for a distribution that is currently in use, as remove may fail.
   */
  private async removeDistribution(): Promise<void> {
    await this.storeInstalledRelease(undefined);
    if (await pathExists(this.getDistributionStoragePath())) {
      await remove(this.getDistributionStoragePath());
    }
  }

  private async getLatestRelease(): Promise<Release> {
    const requiredAssetName = getRequiredAssetName();
    void extLogger.log(
      `Searching for latest release including ${requiredAssetName}.`,
    );

    const versionRange = this.usingNightlyReleases
      ? undefined
      : this.versionRange;
    const orderBySemver = !this.usingNightlyReleases;
    const includePrerelease =
      this.usingNightlyReleases || this.config.includePrerelease;

    return this.createReleasesApiConsumer().getLatestRelease(
      versionRange,
      orderBySemver,
      includePrerelease,
      (release) => {
        // v2.12.3 was released with a bug that causes the extension to fail
        // so we force the extension to ignore it.
        if (release.name === "v2.12.3") {
          return false;
        }

        const matchingAssets = release.assets.filter(
          (asset) => asset.name === requiredAssetName,
        );
        if (matchingAssets.length === 0) {
          // For example, this could be a release with no platform-specific assets.
          void extLogger.log(
            `INFO: Ignoring a release with no assets named ${requiredAssetName}`,
          );
          return false;
        }
        if (matchingAssets.length > 1) {
          void extLogger.log(
            `WARNING: Ignoring a release with more than one asset named ${requiredAssetName}`,
          );
          return false;
        }
        return true;
      },
    );
  }

  private createReleasesApiConsumer(): ReleasesApiConsumer {
    return new ReleasesApiConsumer(
      this.distributionRepositoryNwo,
      this.config.personalAccessToken,
    );
  }

  private get distributionRepositoryNwo(): string {
    if (this.config.channel === "nightly") {
      return NIGHTLY_DISTRIBUTION_REPOSITORY_NWO;
    } else {
      return STABLE_DISTRIBUTION_REPOSITORY_NWO;
    }
  }

  private get usingNightlyReleases(): boolean {
    return (
      this.distributionRepositoryNwo === NIGHTLY_DISTRIBUTION_REPOSITORY_NWO
    );
  }

  private async bumpDistributionFolderIndex(): Promise<void> {
    const index = this.extensionContext.globalState.get(
      ExtensionSpecificDistributionManager._currentDistributionFolderIndexStateKey,
      0,
    );
    await this.extensionContext.globalState.update(
      ExtensionSpecificDistributionManager._currentDistributionFolderIndexStateKey,
      index + 1,
    );
  }

  private getDistributionStoragePath(): string {
    // Use an empty string for the initial distribution for backwards compatibility.
    const distributionFolderIndex =
      this.extensionContext.globalState.get(
        ExtensionSpecificDistributionManager._currentDistributionFolderIndexStateKey,
        0,
      ) || "";
    return join(
      this.extensionContext.globalStorageUri.fsPath,
      ExtensionSpecificDistributionManager._currentDistributionFolderBaseName +
        distributionFolderIndex,
    );
  }

  private getDistributionRootPath(): string {
    return join(
      this.getDistributionStoragePath(),
      ExtensionSpecificDistributionManager._codeQlExtractedFolderName,
    );
  }

  private getInstalledRelease(): Release | undefined {
    return this.extensionContext.globalState.get(
      ExtensionSpecificDistributionManager._installedReleaseStateKey,
    );
  }

  private async storeInstalledRelease(
    release: Release | undefined,
  ): Promise<void> {
    await this.extensionContext.globalState.update(
      ExtensionSpecificDistributionManager._installedReleaseStateKey,
      release,
    );
  }

  private static readonly _currentDistributionFolderBaseName = "distribution";
  private static readonly _currentDistributionFolderIndexStateKey =
    "distributionFolderIndex";
  private static readonly _installedReleaseStateKey = "distributionRelease";
  private static readonly _codeQlExtractedFolderName = "codeql";
}

/*
 * Types and helper functions relating to those types.
 */

export enum DistributionKind {
  CustomPathConfig,
  ExtensionManaged,
  PathEnvironmentVariable,
}

interface Distribution {
  codeQlPath: string;
  kind: DistributionKind;
}

export enum FindDistributionResultKind {
  CompatibleDistribution,
  UnknownCompatibilityDistribution,
  IncompatibleDistribution,
  NoDistribution,
}

export type FindDistributionResult =
  | CompatibleDistributionResult
  | UnknownCompatibilityDistributionResult
  | IncompatibleDistributionResult
  | NoDistributionResult;

/**
 * A result representing a distribution of the CodeQL CLI that may or may not be compatible with
 * the extension.
 */
interface DistributionResult {
  distribution: Distribution;
  kind: FindDistributionResultKind;
}

interface CompatibleDistributionResult extends DistributionResult {
  kind: FindDistributionResultKind.CompatibleDistribution;
  versionAndFeatures: VersionAndFeatures;
}

interface UnknownCompatibilityDistributionResult extends DistributionResult {
  kind: FindDistributionResultKind.UnknownCompatibilityDistribution;
}

interface IncompatibleDistributionResult extends DistributionResult {
  kind: FindDistributionResultKind.IncompatibleDistribution;
  versionAndFeatures: VersionAndFeatures;
}

interface NoDistributionResult {
  kind: FindDistributionResultKind.NoDistribution;
}

export enum DistributionUpdateCheckResultKind {
  AlreadyCheckedRecentlyResult,
  AlreadyUpToDate,
  InvalidLocation,
  UpdateAvailable,
}

type DistributionUpdateCheckResult =
  | AlreadyCheckedRecentlyResult
  | AlreadyUpToDateResult
  | InvalidLocationResult
  | UpdateAvailableResult;

interface AlreadyCheckedRecentlyResult {
  kind: DistributionUpdateCheckResultKind.AlreadyCheckedRecentlyResult;
}

interface AlreadyUpToDateResult {
  kind: DistributionUpdateCheckResultKind.AlreadyUpToDate;
}

/**
 * The distribution could not be installed or updated because it is not managed by the extension.
 */
interface InvalidLocationResult {
  kind: DistributionUpdateCheckResultKind.InvalidLocation;
}

interface UpdateAvailableResult {
  kind: DistributionUpdateCheckResultKind.UpdateAvailable;
  updatedRelease: Release;
}

function createAlreadyCheckedRecentlyResult(): AlreadyCheckedRecentlyResult {
  return {
    kind: DistributionUpdateCheckResultKind.AlreadyCheckedRecentlyResult,
  };
}

function createAlreadyUpToDateResult(): AlreadyUpToDateResult {
  return {
    kind: DistributionUpdateCheckResultKind.AlreadyUpToDate,
  };
}

function createInvalidLocationResult(): InvalidLocationResult {
  return {
    kind: DistributionUpdateCheckResultKind.InvalidLocation,
  };
}

function createUpdateAvailableResult(
  updatedRelease: Release,
): UpdateAvailableResult {
  return {
    kind: DistributionUpdateCheckResultKind.UpdateAvailable,
    updatedRelease,
  };
}

// Exported for testing
export async function getExecutableFromDirectory(
  directory: string,
  warnWhenNotFound = false,
): Promise<string | undefined> {
  const expectedLauncherPath = join(directory, codeQlLauncherName());
  const deprecatedLauncherName = deprecatedCodeQlLauncherName();
  const alternateExpectedLauncherPath = deprecatedLauncherName
    ? join(directory, deprecatedLauncherName)
    : undefined;
  if (await pathExists(expectedLauncherPath)) {
    return expectedLauncherPath;
  } else if (
    alternateExpectedLauncherPath &&
    (await pathExists(alternateExpectedLauncherPath))
  ) {
    warnDeprecatedLauncher();
    return alternateExpectedLauncherPath;
  }
  if (warnWhenNotFound) {
    void extLogger.log(
      `WARNING: Expected to find a CodeQL CLI executable at ${expectedLauncherPath} but one was not found. ` +
        "Will try PATH.",
    );
  }
  return undefined;
}

function warnDeprecatedLauncher() {
  void showAndLogWarningMessage(
    extLogger,
    `The "${deprecatedCodeQlLauncherName()!}" launcher has been deprecated and will be removed in a future version. ` +
      `Please use "${codeQlLauncherName()}" instead. It is recommended to update to the latest CodeQL binaries.`,
  );
}
