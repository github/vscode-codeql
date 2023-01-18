import * as Octokit from "@octokit/rest";

export interface Credentials {
  /**
   * Creates or returns an instance of Octokit.
   *
   * @returns An instance of Octokit.
   */
  getOctokit(): Promise<Octokit.Octokit>;

  getAccessToken(): Promise<string>;

  getExistingAccessToken(): Promise<string | undefined>;
}
