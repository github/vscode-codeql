import * as vscode from "vscode";
import * as Octokit from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import { Credentials } from "./common/authentication";

const GITHUB_AUTH_PROVIDER_ID = "github";

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
   * A specific octokit to return, otherwise a new authenticated octokit will be created when needed.
   */
  private octokit: Octokit.Octokit | undefined;

  /**
   * Creates or returns an instance of Octokit.
   *
   * @returns An instance of Octokit.
   */
  async getOctokit(): Promise<Octokit.Octokit> {
    if (this.octokit) {
      return this.octokit;
    }

    const accessToken = await this.getAccessToken();

    return new Octokit.Octokit({
      auth: accessToken,
      retry,
    });
  }

  async getAccessToken(): Promise<string> {
    const session = await vscode.authentication.getSession(
      GITHUB_AUTH_PROVIDER_ID,
      SCOPES,
      { createIfNone: true },
    );

    return session.accessToken;
  }

  async getExistingAccessToken(): Promise<string | undefined> {
    const session = await vscode.authentication.getSession(
      GITHUB_AUTH_PROVIDER_ID,
      SCOPES,
      { createIfNone: false },
    );

    return session?.accessToken;
  }
}
