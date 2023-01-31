import { OWNER_REGEX, REPO_REGEX } from "../pure/helpers-pure";

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
 * @param githubUrl The GitHub repository URL
 * @return The corresponding NWO, or undefined if the URL is not valid
 */
export function getNwoFromGitHubUrl(githubUrl: string): string | undefined {
  return getNwoOrOwnerFromGitHubUrl(githubUrl, "nwo");
}

/**
 * Extracts an owner from a GitHub URL.
 * @param githubUrl The GitHub repository URL
 * @return The corresponding Owner, or undefined if the URL is not valid
 */
export function getOwnerFromGitHubUrl(githubUrl: string): string | undefined {
  return getNwoOrOwnerFromGitHubUrl(githubUrl, "owner");
}

function getNwoOrOwnerFromGitHubUrl(
  githubUrl: string,
  kind: "owner" | "nwo",
): string | undefined {
  try {
    const uri = new URL(githubUrl);
    if (uri.hostname !== "github.com" && uri.hostname !== "www.github.com") {
      return;
    }
    const paths = uri.pathname.split("/").filter((segment: string) => segment);
    const owner = `${paths[0]}`;
    if (kind === "owner") {
      return owner ? owner : undefined;
    }
    const nwo = `${paths[0]}/${paths[1]}`;
    return paths[1] ? nwo : undefined;
  } catch (e) {
    // Ignore the error here, since we catch failures at a higher level.
    return;
  }
}
