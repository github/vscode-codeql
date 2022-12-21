import * as vscode from "vscode";
import * as Octokit from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";

const GITHUB_AUTH_PROVIDER_ID = "github";

// We need 'repo' scope for triggering workflows and 'gist' scope for exporting results to Gist.
// For a comprehensive list of scopes, see:
// https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps
const SCOPES = ["repo", "gist"];

/**
 * Handles authentication to GitHub, using the VS Code [authentication API](https://code.visualstudio.com/api/references/vscode-api#authentication).
 */
export class Credentials {
  /**
   * A specific octokit to return, otherwise a new authenticated octokit will be created when needed.
   */
  private octokit: Octokit.Octokit | undefined;

  // Explicitly make the constructor private, so that we can't accidentally call the constructor from outside the class
  // without also initializing the class.
  private constructor(octokit?: Octokit.Octokit) {
    this.octokit = octokit;
  }

  /**
   * Initializes a Credentials instance. This will generate octokit instances
   * authenticated as the user. If there is not already an authenticated GitHub
   * session availabeT then the user will be prompted to log in.
   *
   * @returns An instance of credentials.
   */
  static async initialize(): Promise<Credentials> {
    return new Credentials();
  }

  /**
   * Initializes an instance of credentials with an octokit instance using
   * a specific known token. This method is meant to be used non-interactive
   * environments such as tests.
   *
   * @param overrideToken The GitHub token to use for authentication.
   * @returns An instance of credentials.
   */
  static async initializeWithToken(overrideToken: string) {
    return new Credentials(new Octokit.Octokit({ auth: overrideToken, retry }));
  }

  /**
   * Creates or returns an instance of Octokit.
   *
   * @returns An instance of Octokit.
   */
  async getOctokit(): Promise<Octokit.Octokit> {
    if (this.octokit) {
      return this.octokit;
    }

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
