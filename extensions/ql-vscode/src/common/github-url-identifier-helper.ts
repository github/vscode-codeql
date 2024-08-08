import { OWNER_REGEX, REPO_REGEX } from "./helpers-pure";

/**
 * Checks if a string is a valid GitHub NWO.
 * @param identifier The GitHub NWO
 * @returns
 */
export function isValidGitHubNwo(identifier: string): boolean {
  return validGitHubNwoOrOwner(identifier, "nwo");
}

/**
 * Checks if a string is a valid GitHub owner.
 * @param identifier The GitHub owner
 * @returns
 */
export function isValidGitHubOwner(identifier: string): boolean {
  return validGitHubNwoOrOwner(identifier, "owner");
}

function validGitHubNwoOrOwner(
  identifier: string,
  kind: "owner" | "nwo",
): boolean {
  return kind === "owner"
    ? OWNER_REGEX.test(identifier)
    : REPO_REGEX.test(identifier);
}

/**
 * Extracts an NWO from a GitHub URL.
 * @param repositoryUrl The GitHub repository URL
 * @param githubUrl The URL of the GitHub instance
 * @return The corresponding NWO, or undefined if the URL is not valid
 */
export function getNwoFromGitHubUrl(
  repositoryUrl: string,
  githubUrl: URL,
): string | undefined {
  return getNwoOrOwnerFromGitHubUrl(repositoryUrl, githubUrl, "nwo");
}

/**
 * Extracts an owner from a GitHub URL.
 * @param repositoryUrl The GitHub repository URL
 * @param githubUrl The URL of the GitHub instance
 * @return The corresponding Owner, or undefined if the URL is not valid
 */
export function getOwnerFromGitHubUrl(
  repositoryUrl: string,
  githubUrl: URL,
): string | undefined {
  return getNwoOrOwnerFromGitHubUrl(repositoryUrl, githubUrl, "owner");
}

function getNwoOrOwnerFromGitHubUrl(
  repositoryUrl: string,
  githubUrl: URL,
  kind: "owner" | "nwo",
): string | undefined {
  const validHostnames = [githubUrl.hostname, `www.${githubUrl.hostname}`];

  try {
    let paths: string[];
    const urlElements = repositoryUrl.split("/");
    if (validHostnames.includes(urlElements[0])) {
      paths = repositoryUrl.split("/").slice(1);
    } else {
      const uri = new URL(repositoryUrl);
      if (!validHostnames.includes(uri.hostname)) {
        return;
      }
      paths = uri.pathname.split("/").filter((segment: string) => segment);
    }
    const owner = `${paths[0]}`;
    if (kind === "owner") {
      return owner ? owner : undefined;
    }
    const nwo = `${paths[0]}/${paths[1]}`;
    return paths[1] ? nwo : undefined;
  } catch {
    // Ignore the error here, since we catch failures at a higher level.
    return;
  }
}
