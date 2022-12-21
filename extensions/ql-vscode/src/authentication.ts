import * as vscode from "vscode";
import * as Octokit from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";
import { Credentials } from "./pure/authentication";

const GITHUB_AUTH_PROVIDER_ID = "github";

// We need 'repo' scope for triggering workflows and 'gist' scope for exporting results to Gist.
// For a comprehensive list of scopes, see:
// https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps
const SCOPES = ["repo", "gist"];

/**
 * Handles authentication to GitHub, using the VS Code [authentication API](https://code.visualstudio.com/api/references/vscode-api#authentication).
 *
 * Should not be referenced directly. If you want an octokit instance then see
 * `getOctokit` from `extensions/ql-vscode/src/pure/authentication.ts`.
 */
export class VSCodeCredentials extends Credentials {
  /**
   * Creates or returns an instance of Octokit.
   *
   * @returns An instance of Octokit.
   */
  async getOctokit(): Promise<Octokit.Octokit> {
    const session = await vscode.authentication.getSession(
      GITHUB_AUTH_PROVIDER_ID,
      SCOPES,
      { createIfNone: true },
    );

    return new Octokit.Octokit({
      auth: session.accessToken,
      retry,
    });
  }
}
