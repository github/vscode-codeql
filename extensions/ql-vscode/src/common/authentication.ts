import type { Octokit } from "@octokit/rest";

/**
 * An interface providing methods for obtaining access tokens
 * or an octokit instance for making HTTP requests.
 */
export interface Credentials {
  /**
   * Returns an authenticated instance of Octokit.
   * May prompt the user to log in and grant permission to use their
   * token, if they have not already done so.
   *
   * @returns An instance of Octokit.
   */
  getOctokit(): Promise<Octokit>;

  /**
   * Returns an OAuth access token.
   * May prompt the user to log in and grant permission to use their
   * token, if they have not already done so.
   *
   * @returns An OAuth access token.
   */
  getAccessToken(): Promise<string>;

  /**
   * Returns an OAuth access token if one is available.
   * If a token is not available this will return undefined and
   * will not prompt the user to log in.
   *
   * @returns An OAuth access token, or undefined.
   */
  getExistingAccessToken(): Promise<string | undefined>;

  /**
   * Returns the ID of the authentication provider to use.
   */
  authProviderId: string;
}
