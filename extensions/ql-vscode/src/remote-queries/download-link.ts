/**
 * Represents a link to an artifact to be downloaded.
 */
export interface DownloadLink {
  /**
   *  A unique id of the artifact being downloaded.
   */
  id: string;

  /**
   * The URL path to use against the GitHub API to download the
   * linked artifact.
   */
  urlPath: string;

  /**
   * An optional path to follow inside the downloaded archive containing the artifact.
   */
  innerFilePath?: string;

  /**
   * A unique id of the remote query run. This is used to determine where to store artifacts and data from the run.
   */
  queryId: string;
}
