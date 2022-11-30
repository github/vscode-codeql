import { join } from "path";

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

/**
 * Converts a downloadLink to the path where the artifact should be stored.
 *
 * @param storagePath The base directory to store artifacts in.
 * @param downloadLink The DownloadLink
 * @param extension An optional file extension to append to the artifact (no `.`).
 *
 * @returns A full path to the download location of the artifact
 */
export function createDownloadPath(
  storagePath: string,
  downloadLink: DownloadLink,
  extension = "",
) {
  return join(
    storagePath,
    downloadLink.queryId,
    downloadLink.id + (extension ? `.${extension}` : ""),
  );
}
