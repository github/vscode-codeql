import { Uri } from "vscode";
import { REPO_REGEX } from "../pure/helpers-pure";

/**
 * The URL pattern is https://github.com/{owner}/{name}/{subpages}.
 *
 * This function accepts any URL that matches the pattern above. It also accepts just the
 * name with owner (NWO): `<owner>/<repo>`.
 *
 * @param githubRepo The GitHub repository URL or NWO
 *
 * @return true if this looks like a valid GitHub repository URL or NWO
 */
export function looksLikeGithubRepo(
  githubRepo: string | undefined,
): githubRepo is string {
  if (!githubRepo) {
    return false;
  }
  if (REPO_REGEX.test(githubRepo) || convertGitHubUrlToNwo(githubRepo)) {
    return true;
  }
  return false;
}

/**
 * Converts a GitHub repository URL to the corresponding NWO.
 * @param githubUrl The GitHub repository URL
 * @return The corresponding NWO, or undefined if the URL is not valid
 */
export function convertGitHubUrlToNwo(githubUrl: string): string | undefined {
  try {
    const uri = Uri.parse(githubUrl, true);
    if (uri.scheme !== "https") {
      return;
    }
    if (uri.authority !== "github.com" && uri.authority !== "www.github.com") {
      return;
    }
    const paths = uri.path.split("/").filter((segment: string) => segment);
    const nwo = `${paths[0]}/${paths[1]}`;
    if (REPO_REGEX.test(nwo)) {
      return nwo;
    }
    return;
  } catch (e) {
    // Ignore the error here, since we catch failures at a higher level.
    // In particular: returning undefined leads to an error in 'promptImportGithubDatabase'.
    return;
  }
}
