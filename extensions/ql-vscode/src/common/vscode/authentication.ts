import { authentication } from "vscode";
import type { Octokit } from "@octokit/rest";
import type { Credentials } from "../authentication";
import { AppOctokit } from "../octokit";
import { hasGhecDrUri } from "../../config";
import { getOctokitBaseUrl } from "./octokit";

// We need 'repo' scope for triggering workflows, 'gist' scope for exporting results to Gist,
// and 'read:packages' for reading private CodeQL packages.
// For a comprehensive list of scopes, see:
// https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps
const SCOPES = ["repo", "gist", "read:packages"];

/**
 * Handles authentication to GitHub, using the VS Code [authentication API](https://code.visualstudio.com/api/references/vscode-api#authentication).
 */
export class VSCodeCredentials implements Credentials {
  /**
   * Creates or returns an instance of Octokit. The returned instance should
   * not be stored and reused, as it may become out-of-date with the current
   * authentication session.
   *
   * @returns An instance of Octokit.
   */
  async getOctokit(): Promise<Octokit> {
    const accessToken = await this.getAccessToken();

    return new AppOctokit({
      auth: accessToken,
      baseUrl: getOctokitBaseUrl(),
    });
  }

  async getAccessToken(): Promise<string> {
    const session = await authentication.getSession(
      this.authProviderId,
      SCOPES,
      { createIfNone: true },
    );

    return session.accessToken;
  }

  async getExistingAccessToken(): Promise<string | undefined> {
    const session = await authentication.getSession(
      this.authProviderId,
      SCOPES,
      { createIfNone: false },
    );

    return session?.accessToken;
  }

  public get authProviderId(): string {
    if (hasGhecDrUri()) {
      return "github-enterprise";
    }
    return "github";
  }
}
