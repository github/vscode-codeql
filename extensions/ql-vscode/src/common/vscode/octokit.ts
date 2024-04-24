import { getGitHubInstanceApiUrl } from "../../config";

/**
 * Returns the Octokit base URL to use based on the GitHub instance URL.
 *
 * This is necessary because the Octokit base URL should not have a trailing
 * slash, but this is included by default in a URL.
 */
export function getOctokitBaseUrl(): string {
  let apiUrl = getGitHubInstanceApiUrl().toString();
  if (apiUrl.endsWith("/")) {
    apiUrl = apiUrl.slice(0, -1);
  }
  return apiUrl;
}
