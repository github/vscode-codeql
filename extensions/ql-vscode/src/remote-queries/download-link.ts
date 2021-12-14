/**
 * Represents a link to an artifact to be downloaded. 
 */
export interface DownloadLink {
  /**
   *  A unique id of the file/artifact being downloaded. 
   */
  id: string;

  /**
   * The URL path to use against the GitHub API to download the
   * linked file/artifact. 
   */
  urlPath: string;

  /**
   * An optional path to follow inside the downloaded archive containing the artifact.
   */
  innerFilePath?: string;
}
