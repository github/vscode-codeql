import { Uri } from "vscode";
import { OWNER_REGEX, REPO_REGEX } from "../pure/helpers-pure";

/**
 * Checks if a string is a valid GitHub owner or NWO.
 * @param identifier The GitHub owner or NWO
 * @param onlyOwner If true, validate an owner, otherwise a repository
 * @returns
 */
export function validGitHubNwoOrOwner(
  identifier: string,
  onlyOwner?: true,
): boolean {
  return onlyOwner ? OWNER_REGEX.test(identifier) : REPO_REGEX.test(identifier);
}

/**
 * Extracts an owner or NOW from a GitHub URL.
 * @param githubUrl The GitHub repository URL
 * @return The corresponding Owner/NWO, or undefined if the URL is not valid
 */
export function getNwoOrOwnerFromGitHubUrl(
  githubUrl: string,
  onlyOwner?: boolean,
): string | undefined {
  try {
    const uri = Uri.parse(githubUrl, true);
    if (uri.scheme !== "https") {
      return;
    }
    if (uri.authority !== "github.com" && uri.authority !== "www.github.com") {
      return;
    }
    const paths = uri.path.split("/").filter((segment: string) => segment);
    const owner = `${paths[0]}`;
    if (onlyOwner) {
      return owner ? owner : undefined;
    }
    const nwo = `${paths[0]}/${paths[1]}`;
    return paths[1] ? nwo : undefined;
  } catch (e) {
    // Ignore the error here, since we catch failures at a higher level.
    return;
  }
}
