/**
 * A release of the CodeQL CLI hosted on GitHub.
 */
export interface Release {
  /**
   * The assets associated with the release on GitHub.
   */
  assets: ReleaseAsset[];

  /**
   * The creation date of the release on GitHub.
   *
   * This is the date that the release was uploaded to GitHub, and not the date
   * when we downloaded it or the date when we fetched the data from the GitHub API.
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
 * An asset attached to a release on GitHub.
 * Each release may have multiple assets, and each asset can be downloaded independently.
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
