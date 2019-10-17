import * as fetch from "node-fetch";
import * as fs from "fs-extra";
import * as os from "os";
import * as path from "path";
import * as unzipper from "unzipper";
import * as url from "url";

export async function downloadDistribution(
  ownerName: string, repoName: string, outPath: string, options: { additionalHeaders?: { [key: string]: string }, includePrerelease?: boolean } = {}):Promise<void> {

  const releasesApi = new ReleasesApiConsumer(ownerName, repoName, options.additionalHeaders);
  const assets = await releasesApi.getAssetsForLatestRelease(options);
  if (assets.length !== 1) {
    throw new Error("Release had an unexpected number of assets")
  }
  const assetStream = await releasesApi.streamBinaryContentOfAsset(assets[0]);

  const tmpDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "vscode-codeql"));
  const archivePath = path.join(tmpDirectory, "distributionDownload.zip");
  const archiveFile = fs.createWriteStream(archivePath);

  await new Promise((resolve, reject) =>
    assetStream.pipe(archiveFile)
      .on("finish", resolve)
      .on("error", reject)
  );

  await extractZipArchive(archivePath, outPath);
}
 
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

export class ReleasesApiConsumer {
  constructor(ownerName: string, repoName: string, additionalHeaders: { [key: string]: string } = {}) {
    this._defaultHeaders = Object.assign({}, {
      // Specify version of the GitHub API
      "Accept": "application/vnd.github.v3+json"
    }, additionalHeaders);
    this._ownerName = ownerName;
    this._repoName = repoName;
  }

  public async getAssetsForLatestRelease(options: { includePrerelease?: boolean } = {}): Promise<ReleaseAsset[]> {
    const latestRelease = await this.getLatestRelease(options.includePrerelease);
    const assets: ReleaseAsset[] = latestRelease.assets.map(asset => {
      return {
        id: asset.id,
        name: asset.name,
        size: asset.size
      };
    });
    return Promise.resolve(assets);
  }

  public async streamBinaryContentOfAsset(asset: ReleaseAsset): Promise<NodeJS.ReadableStream> {
    const apiPath = `/repos/${this._ownerName}/${this._repoName}/releases/assets/${asset.id}`;

    const response = await this.makeApiCall(apiPath, {
      "Accept": "application/octet-stream"
    });
    return response.body;
  }

  private async getLatestRelease(includePrerelease: boolean | undefined): Promise<any> {
    if (!includePrerelease) {
      const apiPath = `/repos/${this._ownerName}/${this._repoName}/releases/latest`;
      return await (await this.makeApiCall(apiPath)).json();
    }

    const apiPath = `/repos/${this._ownerName}/${this._repoName}/releases`;
    const releases: any[] = await (await this.makeApiCall(apiPath)).json();
    return releases.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  }

  protected async makeApiCall(apiPath: string, additionalHeaders: { [key: string]: string } = {}): Promise<fetch.Response> {
    const response = await this.makeRawRequest(ReleasesApiConsumer._apiBase + apiPath,
      Object.assign({}, this._defaultHeaders, additionalHeaders));

    if (!response.ok) {
      throw new Error(`API call failed with status code ${response.status}, body: ${await response.text()}`);
    }
    return response;
  }

  private async makeRawRequest(requestUrl: string, headers: { [key: string]: string }, redirectCount: number = 0): Promise<fetch.Response> {
    const response = await fetch.default(requestUrl, {
      headers,
      redirect: "manual"
    });

    const redirectUrl = response.headers.get("location");
    if (isRedirectStatusCode(response.status) && redirectUrl && redirectCount < ReleasesApiConsumer._maxRedirects) {
      if (url.parse(redirectUrl).host != "api.github.com") {
        // Remove authorization header if we are redirected outside of the GitHub API.
        //
        // This is necessary to stream release assets since AWS fails if more than one auth
        // mechanism is provided.
        delete headers["Authorization"];
        delete headers["authorization"];
      }
      return await this.makeRawRequest(redirectUrl, headers, redirectCount + 1)
    }

    return response;
  }

  private readonly _defaultHeaders: { [key: string]: string };
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

function isRedirectStatusCode(statusCode: number): boolean {
  return statusCode === 301 || statusCode === 302 || statusCode === 303 || statusCode === 307 || statusCode === 308;
}
