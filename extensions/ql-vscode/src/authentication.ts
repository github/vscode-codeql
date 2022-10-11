import * as vscode from 'vscode';
import * as Octokit from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';

const GITHUB_AUTH_PROVIDER_ID = 'github';

// We need 'repo' scope for triggering workflows and 'gist' scope for exporting results to Gist.
// For a comprehensive list of scopes, see:
// https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps
const SCOPES = ['repo', 'gist'];

/**
 * Handles authentication to GitHub, using the VS Code [authentication API](https://code.visualstudio.com/api/references/vscode-api#authentication).
 */
export class Credentials {
  private octokit: Octokit.Octokit | undefined;

  // Explicitly make the constructor private, so that we can't accidentally call the constructor from outside the class
  // without also initializing the class.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() { }

  /**
   * Initializes an instance of credentials with an octokit instance.
   *
   * Do not call this method until you know you actually need an instance of credentials.
   * since calling this method will require the user to log in.
   *
   * @param context The extension context.
   * @returns An instance of credentials.
   */
  static async initialize(context: vscode.ExtensionContext): Promise<Credentials> {
    const c = new Credentials();
    c.registerListeners(context);
    c.octokit = await c.createOctokit(false);
    return c;
  }

  /**
   * Initializes an instance of credentials with an octokit instance using
   * a token from the user's GitHub account. This method is meant to be
   * used non-interactive environments such as tests.
   *
   * @param overrideToken The GitHub token to use for authentication.
   * @returns An instance of credentials.
   */
  static async initializeWithToken(overrideToken: string) {
    const c = new Credentials();
    c.octokit = await c.createOctokit(false, overrideToken);
    return c;
  }

  private async createOctokit(createIfNone: boolean, overrideToken?: string): Promise<Octokit.Octokit | undefined> {
    if (overrideToken) {
      return new Octokit.Octokit({ auth: overrideToken, retry });
    }

    const session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone });

    if (session) {
      return new Octokit.Octokit({
        auth: session.accessToken,
        retry
      });
    } else {
      return undefined;
    }
  }

  registerListeners(context: vscode.ExtensionContext): void {
    // Sessions are changed when a user logs in or logs out.
    context.subscriptions.push(vscode.authentication.onDidChangeSessions(async e => {
      if (e.provider.id === GITHUB_AUTH_PROVIDER_ID) {
        this.octokit = await this.createOctokit(false);
      }
    }));
  }

  /**
   * Creates or returns an instance of Octokit.
   *
   * @param requireAuthentication Whether the Octokit instance needs to be authenticated as user.
   * @returns An instance of Octokit.
   */
  async getOctokit(requireAuthentication = true): Promise<Octokit.Octokit> {
    if (this.octokit) {
      return this.octokit;
    }

    this.octokit = await this.createOctokit(requireAuthentication);

    if (!this.octokit) {
      if (requireAuthentication) {
        throw new Error('Did not initialize Octokit.');
      }

      // We don't want to set this in this.octokit because that would prevent
      // authenticating when requireCredentials is true.
      return new Octokit.Octokit({ retry });
    }
    return this.octokit;
  }
}
