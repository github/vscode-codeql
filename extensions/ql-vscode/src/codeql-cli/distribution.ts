import * as fetch from "node-fetch";
import { pathExists, mkdtemp, createWriteStream, remove } from "fs-extra";
import { tmpdir } from "os";
import { delimiter, dirname, join } from "path";
import * as semver from "semver";
import { URL } from "url";
import { ExtensionContext, Event } from "vscode";
import { DistributionConfig } from "../config";
import { showAndLogErrorMessage, showAndLogWarningMessage } from "../helpers";
import { extLogger } from "../common";
import { getCodeQlCliVersion } from "./cli-version";
import {
  ProgressCallback,
  reportStreamProgress,
} from "../common/vscode/progress";
import {
  codeQlLauncherName,
  deprecatedCodeQlLauncherName,
  extractZipArchive,
  getRequiredAssetName,
} from "../pure/distribution";
import {
  InvocationRateLimiter,
  InvocationRateLimiterResultKind,
} from "../invocation-rate-limiter";

/**
 * distribution.ts
 * ------------
 *
 * Management of CodeQL CLI binaries.
 */

/**
 * Default value for the owner name of the extension-managed distribution on GitHub.
 *
 * We set the default here rather than as a default config value so that this default is invoked
 * upon blanking the setting.
 */
const DEFAULT_DISTRIBUTION_OWNER_NAME = "github";

/**
 * Default value for the repository name of the extension-managed distribution on GitHub.
 *
 * We set the default here rather than as a default config value so that this default is invoked
 * upon blanking the setting.
 */
const DEFAULT_DISTRIBUTION_REPOSITORY_NAME = "codeql-cli-binaries";

/**
 * Range of versions of the CLI that are compatible with the extension.
 *
 * This applies to both extension-managed and CLI distributions.
 */
export const DEFAULT_DISTRIBUTION_VERSION_RANGE: semver.Range =
  new semver.Range("2.x");

export interface DistributionProvider {
  getCodeQlPathWithoutVersionCheck(): Promise<string | undefined>;
  onDidChangeDistribution?: Event<void>;
  getDistribution(): Promise<FindDistributionResult>;
}

export class DistributionManager implements DistributionProvider {
  constructor(
    public readonly config: DistributionConfig,
    private readonly versionRange: semver.Range,
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
    const version = await getCodeQlCliVersion(
      distribution.codeQlPath,
      extLogger,
    );
    if (version === undefined) {
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

    if (!semver.satisfies(version, this.versionRange, { includePrerelease })) {
      return {
        distribution,
        kind: FindDistributionResultKind.IncompatibleDistribution,
        version,
      };
    }
    return {
      distribution,
      kind: FindDistributionResultKind.CompatibleDistribution,
      version,
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
        const expectedLauncherPath = await getExecutableFromDirectory(
          searchDirectory,
        );
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
    private readonly versionRange: semver.Range,
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

    const assetStream =
      await this.createReleasesApiConsumer().streamBinaryContentOfAsset(
        assets[0],
      );
    const tmpDirectory = await mkdtemp(join(tmpdir(), "vscode-codeql"));

    try {
      const archivePath = join(tmpDirectory, "distributionDownload.zip");
      const archiveFile = createWriteStream(archivePath);

      const contentLength = assetStream.headers.get("content-length");
      const totalNumBytes = contentLength
        ? parseInt(contentLength, 10)
        : undefined;
      reportStreamProgress(
        assetStream.body,
        `Downloading CodeQL CLI ${release.name}…`,
        totalNumBytes,
        progressCallback,
      );

      await new Promise((resolve, reject) =>
        assetStream.body
          .pipe(archiveFile)
          .on("finish", resolve)
          .on("error", reject),
      );

      await this.bumpDistributionFolderIndex();

      void extLogger.log(
        `Extracting CodeQL CLI to ${this.getDistributionStoragePath()}`,
      );
      await extractZipArchive(archivePath, this.getDistributionStoragePath());
    } finally {
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
    return this.createReleasesApiConsumer().getLatestRelease(
      this.versionRange,
      this.config.includePrerelease,
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
    const ownerName = this.config.ownerName
      ? this.config.ownerName
      : DEFAULT_DISTRIBUTION_OWNER_NAME;
    const repositoryName = this.config.repositoryName
      ? this.config.repositoryName
      : DEFAULT_DISTRIBUTION_REPOSITORY_NAME;
    return new ReleasesApiConsumer(
      ownerName,
      repositoryName,
      this.config.personalAccessToken,
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

export class ReleasesApiConsumer {
  constructor(
    ownerName: string,
    repoName: string,
    personalAccessToken?: string,
  ) {
    // Specify version of the GitHub API
    this._defaultHeaders["accept"] = "application/vnd.github.v3+json";

    if (personalAccessToken) {
      this._defaultHeaders["authorization"] = `token ${personalAccessToken}`;
    }

    this._ownerName = ownerName;
    this._repoName = repoName;
  }

  public async getLatestRelease(
    versionRange: semver.Range,
    includePrerelease = false,
    additionalCompatibilityCheck?: (release: GithubRelease) => boolean,
  ): Promise<Release> {
    const apiPath = `/repos/${this._ownerName}/${this._repoName}/releases`;
    const allReleases: GithubRelease[] = await (
      await this.makeApiCall(apiPath)
    ).json();
    const compatibleReleases = allReleases.filter((release) => {
      if (release.prerelease && !includePrerelease) {
        return false;
      }

      const version = semver.parse(release.tag_name);
      if (
        version === null ||
        !semver.satisfies(version, versionRange, { includePrerelease })
      ) {
        return false;
      }

      return (
        !additionalCompatibilityCheck || additionalCompatibilityCheck(release)
      );
    });
    // Tag names must all be parsable to semvers due to the previous filtering step.
    const latestRelease = compatibleReleases.sort((a, b) => {
      const versionComparison = semver.compare(
        semver.parse(b.tag_name)!,
        semver.parse(a.tag_name)!,
      );
      if (versionComparison !== 0) {
        return versionComparison;
      }
      return b.created_at.localeCompare(a.created_at, "en-US");
    })[0];
    if (latestRelease === undefined) {
      throw new Error(
        "No compatible CodeQL CLI releases were found. " +
          "Please check that the CodeQL extension is up to date.",
      );
    }
    const assets: ReleaseAsset[] = latestRelease.assets.map((asset) => {
      return {
        id: asset.id,
        name: asset.name,
        size: asset.size,
      };
    });

    return {
      assets,
      createdAt: latestRelease.created_at,
      id: latestRelease.id,
      name: latestRelease.name,
    };
  }

  public async streamBinaryContentOfAsset(
    asset: ReleaseAsset,
  ): Promise<fetch.Response> {
    const apiPath = `/repos/${this._ownerName}/${this._repoName}/releases/assets/${asset.id}`;

    return await this.makeApiCall(apiPath, {
      accept: "application/octet-stream",
    });
  }

  protected async makeApiCall(
    apiPath: string,
    additionalHeaders: { [key: string]: string } = {},
  ): Promise<fetch.Response> {
    const response = await this.makeRawRequest(
      ReleasesApiConsumer._apiBase + apiPath,
      Object.assign({}, this._defaultHeaders, additionalHeaders),
    );

    if (!response.ok) {
      // Check for rate limiting
      const rateLimitResetValue = response.headers.get("X-RateLimit-Reset");
      if (response.status === 403 && rateLimitResetValue) {
        const secondsToMillisecondsFactor = 1000;
        const rateLimitResetDate = new Date(
          parseInt(rateLimitResetValue, 10) * secondsToMillisecondsFactor,
        );
        throw new GithubRateLimitedError(
          response.status,
          await response.text(),
          rateLimitResetDate,
        );
      }
      throw new GithubApiError(response.status, await response.text());
    }
    return response;
  }

  private async makeRawRequest(
    requestUrl: string,
    headers: { [key: string]: string },
    redirectCount = 0,
  ): Promise<fetch.Response> {
    const response = await fetch.default(requestUrl, {
      headers,
      redirect: "manual",
    });

    const redirectUrl = response.headers.get("location");
    if (
      isRedirectStatusCode(response.status) &&
      redirectUrl &&
      redirectCount < ReleasesApiConsumer._maxRedirects
    ) {
      const parsedRedirectUrl = new URL(redirectUrl);
      if (parsedRedirectUrl.protocol !== "https:") {
        throw new Error("Encountered a non-https redirect, rejecting");
      }
      if (parsedRedirectUrl.host !== "api.github.com") {
        // Remove authorization header if we are redirected outside of the GitHub API.
        //
        // This is necessary to stream release assets since AWS fails if more than one auth
        // mechanism is provided.
        delete headers["authorization"];
      }
      return await this.makeRawRequest(redirectUrl, headers, redirectCount + 1);
    }

    return response;
  }

  private readonly _defaultHeaders: { [key: string]: string } = {};
  private readonly _ownerName: string;
  private readonly _repoName: string;

  private static readonly _apiBase = "https://api.github.com";
  private static readonly _maxRedirects = 20;
}

function isRedirectStatusCode(statusCode: number): boolean {
  return (
    statusCode === 301 ||
    statusCode === 302 ||
    statusCode === 303 ||
    statusCode === 307 ||
    statusCode === 308
  );
}

/*
 * Types and helper functions relating to those types.
 */

export enum DistributionKind {
  CustomPathConfig,
  ExtensionManaged,
  PathEnvironmentVariable,
}

export interface Distribution {
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
  version: semver.SemVer;
}

interface UnknownCompatibilityDistributionResult extends DistributionResult {
  kind: FindDistributionResultKind.UnknownCompatibilityDistribution;
}

interface IncompatibleDistributionResult extends DistributionResult {
  kind: FindDistributionResultKind.IncompatibleDistribution;
  version: semver.SemVer;
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

export interface AlreadyCheckedRecentlyResult {
  kind: DistributionUpdateCheckResultKind.AlreadyCheckedRecentlyResult;
}

export interface AlreadyUpToDateResult {
  kind: DistributionUpdateCheckResultKind.AlreadyUpToDate;
}

/**
 * The distribution could not be installed or updated because it is not managed by the extension.
 */
export interface InvalidLocationResult {
  kind: DistributionUpdateCheckResultKind.InvalidLocation;
}

export interface UpdateAvailableResult {
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
    `The "${deprecatedCodeQlLauncherName()!}" launcher has been deprecated and will be removed in a future version. ` +
      `Please use "${codeQlLauncherName()}" instead. It is recommended to update to the latest CodeQL binaries.`,
  );
}

/**
 * A release on GitHub.
 */
export interface Release {
  assets: ReleaseAsset[];

  /**
   * The creation date of the release on GitHub.
   */
  createdAt: string;

  /**
   * The id associated with the release on GitHub.
   */
  id: number;

  /**
   * The name associated with the release on GitHub.
   */
  name: string;
}

/**
 * An asset corresponding to a release on GitHub.
 */
export interface ReleaseAsset {
  /**
   * The id associated with the asset on GitHub.
   */
  id: number;

  /**
   * The name associated with the asset on GitHub.
   */
  name: string;

  /**
   * The size of the asset in bytes.
   */
  size: number;
}

/**
 * The json returned from github for a release.
 */
export interface GithubRelease {
  assets: GithubReleaseAsset[];

  /**
   * The creation date of the release on GitHub, in ISO 8601 format.
   */
  created_at: string;

  /**
   * The id associated with the release on GitHub.
   */
  id: number;

  /**
   * The name associated with the release on GitHub.
   */
  name: string;

  /**
   * Whether the release is a prerelease.
   */
  prerelease: boolean;

  /**
   * The tag name.  This should be the version.
   */
  tag_name: string;
}

/**
 * The json returned by github for an asset in a release.
 */
export interface GithubReleaseAsset {
  /**
   * The id associated with the asset on GitHub.
   */
  id: number;

  /**
   * The name associated with the asset on GitHub.
   */
  name: string;

  /**
   * The size of the asset in bytes.
   */
  size: number;
}

export class GithubApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`API call failed with status code ${status}, body: ${body}`);
  }
}

export class GithubRateLimitedError extends GithubApiError {
  constructor(
    public status: number,
    public body: string,
    public rateLimitResetDate: Date,
  ) {
    super(status, body);
  }
}
