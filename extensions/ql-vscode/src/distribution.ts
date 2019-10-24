import * as fetch from "node-fetch";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as unzipper from "unzipper";
import * as url from "url";
import { ExtensionContext, Event } from "vscode";
import { DistributionConfig } from "./config";
import { ProgressUpdate, showAndLogErrorMessage } from "./helpers";
import { logger } from "./logging";

export class GithubApiError extends Error {
  constructor(public status: number, public body: string) {
    super(`API call failed with status code ${status}, body: ${body}`);
  }
}

export class DistributionManager {
  constructor(extensionContext: ExtensionContext, config: DistributionConfig) {
    this._config = config;
    this._extensionSpecificDistributionManager = new ExtensionSpecificDistributionManager(extensionContext, config);
    this._onDidChangeDistribution = config.onDidChangeDistributionConfiguration;
  }

  /**
   * Returns the path to the CodeQL launcher binary, or undefined if one could not be found.
   */
  public async getCodeQlPath(): Promise<string | undefined> {
    // Check config setting, then extension specific distribution, then PATH.
    if (this._config.customCodeQlPath !== undefined) {
      if (!await fs.pathExists(this._config.customCodeQlPath)) {
        showAndLogErrorMessage(`The CodeQL binary path is specified as "${this._config.customCodeQlPath}" ` +
          "by a configuration setting, but a CodeQL binary could not be found at that path. Please check " +
          "that a CodeQL binary exists at the specified path or remove the setting.");
      }
      return this._config.customCodeQlPath;
    }

    const extensionSpecificCodeQlPath = this._extensionSpecificDistributionManager.getCodeQlPath();
    if (extensionSpecificCodeQlPath !== undefined) {
      return extensionSpecificCodeQlPath;
    }

    if (process.env.PATH) {
      for (const searchDirectory of process.env.PATH.split(path.delimiter)) {
        const expectedLauncherPath = path.join(searchDirectory, codeQlLauncherName());
        if (await fs.pathExists(expectedLauncherPath)) {
          return expectedLauncherPath;
        }
      }
      logger.log("INFO: Could not find CodeQL on path.");
    }

    return undefined;
  }

  /**
   * Check for updates to the extension-managed distribution.  If one has not already been installed,
   * this will return an update available result with the latest available release.
   * 
   * Returns a failed promise if an unexpected error occurs during installation.
   */
  public async checkForUpdatesToExtensionManagedDistribution(): Promise<DistributionUpdateCheckResult> {
    const codeQlPath = await this.getCodeQlPath();
    const extensionManagedCodeQlPath = await this._extensionSpecificDistributionManager.getCodeQlPath();
    if (codeQlPath !== undefined && extensionManagedCodeQlPath === undefined) {
      // A distribution is present but it isn't managed by the extension.
      return createInvalidDistributionLocationResult();
    }
    return this._extensionSpecificDistributionManager.checkForUpdatesToDistribution();
  }

  /**
   * Installs a release of the extension-managed distribution.
   * 
   * Returns a failed promise if an unexpected error occurs during installation.
   */
  public installExtensionManagedDistributionRelease(release: Release,
    progressCallback?: (p: ProgressUpdate) => void): Promise<void> {
    return this._extensionSpecificDistributionManager.installDistributionRelease(release, progressCallback);
  }

  public get onDidChangeDistribution(): Event<void> | undefined {
    return this._onDidChangeDistribution;
  }

  private readonly _config: DistributionConfig;
  private readonly _extensionSpecificDistributionManager: ExtensionSpecificDistributionManager;
  private readonly _onDidChangeDistribution: Event<void> | undefined;
}

class ExtensionSpecificDistributionManager {
  constructor(extensionContext: ExtensionContext, config: DistributionConfig) {
    this._extensionContext = extensionContext;
    this._config = config;
  }

  public async getCodeQlPath(): Promise<string | undefined> {
    if (this.getInstalledRelease() !== undefined) {
      // An extension specific distribution has been installed.
      const expectedLauncherPath = path.join(this.getDistributionPath(), codeQlLauncherName());
      if (await fs.pathExists(expectedLauncherPath)) {
        return expectedLauncherPath;
      }
      logger.log(`WARNING: Expected to find a CodeQL binary at ${expectedLauncherPath} but one was not found. ` +
        "Will try PATH.");
      try {
        await this.removeDistribution();
      } catch (e) {
        logger.log("WARNING: Tried to remove corrupted distribution at " +
          `${this.getDistributionPath()} but encountered error ${e}.`);
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
    const codeQlPath = await this.getCodeQlPath();
    const extensionSpecificRelease = this.getInstalledRelease();
    const latestRelease = await this.getLatestRelease();

    if (extensionSpecificRelease !== undefined && codeQlPath !== undefined && latestRelease.id === extensionSpecificRelease.id) {
      return createDistributionAlreadyUpToDateResult();
    }
    return createUpdateAvailableResult(latestRelease);
  }

  /**
   * Installs a release of the extension-managed distribution.
   * 
   * Returns a failed promise if an unexpected error occurs during installation.
   */
  public async installDistributionRelease(release: Release,
    progressCallback?: (p: ProgressUpdate) => void): Promise<void> {
    await this.downloadDistribution(release, progressCallback);
    // Store the installed release within the global extension state.
    this.storeInstalledRelease(release);
  }

  private async downloadDistribution(release: Release,
    progressCallback?: (p: ProgressUpdate) => void): Promise<void> {
    await this.removeDistribution();

    const assetStream = await this.createReleasesApiConsumer().streamBinaryContentOfAsset(release.assets[0]);

    const tmpDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "vscode-codeql"));
    const archivePath = path.join(tmpDirectory, "distributionDownload.zip");
    const archiveFile = fs.createWriteStream(archivePath);

    const contentLength = assetStream.headers.get("content-length");
    let numBytesDownloaded = 0;

    if (progressCallback && contentLength !== null) {
      const updateProgress = () => {
        progressCallback({
          step: numBytesDownloaded,
          maxStep: parseInt(contentLength, 10),
          message: "Downloading distribution…",
        });
      };

      // Display the progress straight away rather than waiting for the first chunk.
      updateProgress();

      assetStream.body.on("data", data => {
        numBytesDownloaded += data.length;
        updateProgress();
      });
    }

    await new Promise((resolve, reject) =>
      assetStream.body.pipe(archiveFile)
        .on("finish", resolve)
        .on("error", reject)
    );

    logger.log(`Extracting distribution to ${this.getCurrentDistributionStoragePath()}`);
    await extractZipArchive(archivePath, this.getCurrentDistributionStoragePath());

    await fs.remove(tmpDirectory);
  }

  /**
   * Remove the extension-managed distribution.
   * 
   * This should not be called for a distribution that is currently in use, as remove may fail.
   */
  private async removeDistribution(): Promise<void> {
    this.storeInstalledRelease(undefined);
    if (await fs.pathExists(this.getCurrentDistributionStoragePath())) {
      await fs.remove(this.getCurrentDistributionStoragePath());
    }
  }

  private async getLatestRelease(): Promise<Release> {
    const release = await this.createReleasesApiConsumer().getLatestRelease(this._config.includePrerelease);
    if (release.assets.length !== 1) {
      throw new Error("Release had an unexpected number of assets");
    }
    return release;
  }

  private createReleasesApiConsumer(): ReleasesApiConsumer {
    return new ReleasesApiConsumer(this._config.ownerName, this._config.repositoryName, this._config.personalAccessToken);
  }

  private getCurrentDistributionStoragePath(): string {
    return path.join(this._extensionContext.globalStoragePath,
      ExtensionSpecificDistributionManager._currentDistributionFolderName);
  }

  private getDistributionPath(): string {
    return path.join(this.getCurrentDistributionStoragePath(),
      ExtensionSpecificDistributionManager._codeQlExtractedFolderName);
  }

  private getInstalledRelease(): Release | undefined {
    return this._extensionContext.globalState.get(ExtensionSpecificDistributionManager._installedReleaseStateKey);
  }

  private storeInstalledRelease(release: Release | undefined): void {
    this._extensionContext.globalState.update(ExtensionSpecificDistributionManager._installedReleaseStateKey, release);
  }

  private readonly _config: DistributionConfig;
  private readonly _extensionContext: ExtensionContext;

  private static readonly _currentDistributionFolderName: string = "distribution";
  private static readonly _installedReleaseStateKey = "distributionRelease";
  private static readonly _codeQlExtractedFolderName: string = "codeql";
}

export class ReleasesApiConsumer {
  constructor(ownerName: string, repoName: string, personalAccessToken?: string) {
    // Specify version of the GitHub API
    this._defaultHeaders["accept"] = "application/vnd.github.v3+json";

    if (personalAccessToken) {
      this._defaultHeaders["authorization"] = `token ${personalAccessToken}`;
    }

    this._ownerName = ownerName;
    this._repoName = repoName;
  }

  public async getLatestRelease(includePrerelease: boolean = false): Promise<Release> {
    if (!includePrerelease) {
      const apiPath = `/repos/${this._ownerName}/${this._repoName}/releases/latest`;
      const response = await this.makeApiCall(apiPath);
      return response.json();
    }

    const apiPath = `/repos/${this._ownerName}/${this._repoName}/releases`;
    const releases: any[] = await (await this.makeApiCall(apiPath)).json();
    const latestRelease = releases.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    const assets: ReleaseAsset[] = latestRelease.assets.map(asset => {
      return {
        id: asset.id,
        name: asset.name,
        size: asset.size
      };
    });

    return {
      assets,
      createdAt: latestRelease.created_at,
      id: latestRelease.id,
      name: latestRelease.name
    };
  }

  public async streamBinaryContentOfAsset(asset: ReleaseAsset): Promise<fetch.Response> {
    const apiPath = `/repos/${this._ownerName}/${this._repoName}/releases/assets/${asset.id}`;

    return await this.makeApiCall(apiPath, {
      "accept": "application/octet-stream"
    });
  }

  protected async makeApiCall(apiPath: string, additionalHeaders: { [key: string]: string } = {}): Promise<fetch.Response> {
    const response = await this.makeRawRequest(ReleasesApiConsumer._apiBase + apiPath,
      Object.assign({}, this._defaultHeaders, additionalHeaders));

    if (!response.ok) {
      throw new GithubApiError(response.status, await response.text());
    }
    return response;
  }

  private async makeRawRequest(
    requestUrl: string,
    headers: { [key: string]: string },
    redirectCount: number = 0): Promise<fetch.Response> {
    const response = await fetch.default(requestUrl, {
      headers,
      redirect: "manual"
    });

    const redirectUrl = response.headers.get("location");
    if (isRedirectStatusCode(response.status) && redirectUrl && redirectCount < ReleasesApiConsumer._maxRedirects) {
      const parsedRedirectUrl = url.parse(redirectUrl);
      if (parsedRedirectUrl.protocol != "https:") {
        throw new Error("Encountered a non-https redirect, rejecting");
      }
      if (parsedRedirectUrl.host != "api.github.com") {
        // Remove authorization header if we are redirected outside of the GitHub API.
        //
        // This is necessary to stream release assets since AWS fails if more than one auth
        // mechanism is provided.
        delete headers["authorization"];
      }
      return await this.makeRawRequest(redirectUrl, headers, redirectCount + 1)
    }

    return response;
  }

  private readonly _defaultHeaders: { [key: string]: string } = {};
  private readonly _ownerName: string;
  private readonly _repoName: string;

  private static readonly _apiBase = "https://api.github.com";
  private static readonly _maxRedirects = 20;
}

export async function extractZipArchive(archivePath: string, outPath: string): Promise<void> {
  const archive = await unzipper.Open.file(archivePath);
  // The type definition for unzipper.Open.file(...).extract() is wrong
  await (archive.extract({
    concurrency: 4,
    path: outPath
  }) as unknown as Promise<void>);
  // Set file permissions for extracted files
  await Promise.all(archive.files.map(async file => {
    // Only change file permissions if within outPath (path.join normalises the path)
    const extractedPath = path.join(outPath, file.path);
    if (extractedPath.indexOf(outPath) !== 0 || !(await fs.pathExists(extractedPath))) {
      return Promise.resolve();
    }
    return fs.chmod(extractedPath, file.externalFileAttributes >>> 16);
  }));
}

function codeQlLauncherName(): string {
  return (os.platform() === "win32") ? "codeql.cmd" : "codeql";
}

function isRedirectStatusCode(statusCode: number): boolean {
  return statusCode === 301 || statusCode === 302 || statusCode === 303 || statusCode === 307 || statusCode === 308;
}

export enum DistributionResultKind {
  AlreadyUpToDate,
  InvalidDistributionLocation,
  UpdateAvailable
}

type DistributionUpdateCheckResult = DistributionAlreadyUpToDateResult | InvalidDistributionLocationResult |
  UpdateAvailableResult;

export interface DistributionAlreadyUpToDateResult {
  kind: DistributionResultKind.AlreadyUpToDate;
}

/**
 * The distribution could not be installed or updated because it is not managed by the extension.
 */
export interface InvalidDistributionLocationResult {
  kind: DistributionResultKind.InvalidDistributionLocation;
}

export interface UpdateAvailableResult {
  kind: DistributionResultKind.UpdateAvailable;
  updatedRelease: Release;
}

function createDistributionAlreadyUpToDateResult(): DistributionAlreadyUpToDateResult {
  return {
    kind: DistributionResultKind.AlreadyUpToDate
  };
}

function createInvalidDistributionLocationResult(): InvalidDistributionLocationResult {
  return {
    kind: DistributionResultKind.InvalidDistributionLocation
  };
}

function createUpdateAvailableResult(updatedRelease: Release): UpdateAvailableResult {
  return {
    kind: DistributionResultKind.UpdateAvailable,
    updatedRelease
  };
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
