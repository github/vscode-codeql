import * as fetch from "node-fetch";
import * as unzipper from "unzipper";
 
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
    const response = await fetch.default(ReleasesApiConsumer._apiBase + apiPath, {
      headers: Object.assign({}, this._defaultHeaders, additionalHeaders)
    });
    if (response.status != 200) {
      throw new Error(`Bad status code: ${response.status}`);
    }
    return response;
  }

  private readonly _defaultHeaders: { [key: string]: string };
  private readonly _ownerName: string;
  private readonly _repoName: string;

  private static readonly _apiBase = "https://api.github.com";
}

export async function extractZipArchive(archivePath: string, outPath: string): Promise<void> {
  const archive = await unzipper.Open.file(archivePath);
  await archive.extract({
    concurrency: 4,
    path: outPath
  }).promise();
}
