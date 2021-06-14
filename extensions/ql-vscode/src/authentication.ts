import * as vscode from 'vscode';
import * as Octokit from '@octokit/rest';

const GITHUB_AUTH_PROVIDER_ID = 'github';

// 'repo' scope should be enough for triggering workflows. For a comprehensive list, see:
// https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps
const SCOPES = ['repo'];

interface OctokitAndToken {
  octokit: Octokit.Octokit;
  token: string;
}

/** 
 * Handles authentication to GitHub, using the VS Code [authentication API](https://code.visualstudio.com/api/references/vscode-api#authentication).
 */
export class Credentials {
  private octokitAndToken: OctokitAndToken | undefined;

  // Explicitly make the constructor private, so that we can't accidentally call the constructor from outside the class
  // without also initializing the class.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() { }

  static async initialize(context: vscode.ExtensionContext): Promise<Credentials> {
    const c = new Credentials();
    c.registerListeners(context);
    c.octokitAndToken = await c.createOctokit(false);
    return c;
  }

  private async createOctokit(createIfNone: boolean): Promise<OctokitAndToken | undefined> {
    const session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone });

    if (session) {
      return {
        octokit: new Octokit.Octokit({
          auth: session.accessToken
        }),
        token: session.accessToken
      };
    } else {
      return undefined;
    }
  }

  registerListeners(context: vscode.ExtensionContext): void {
    // Sessions are changed when a user logs in or logs out.
    context.subscriptions.push(vscode.authentication.onDidChangeSessions(async e => {
      if (e.provider.id === GITHUB_AUTH_PROVIDER_ID) {
        this.octokitAndToken = await this.createOctokit(false);
      }
    }));
  }

  async getOctokit(): Promise<Octokit.Octokit> {
    if (this.octokitAndToken) {
      return this.octokitAndToken.octokit;
    }

    this.octokitAndToken = await this.createOctokit(true);
    // octokit shouldn't be undefined, since we've set "createIfNone: true".
    // The following block is mainly here to prevent a compiler error.
    if (!this.octokitAndToken) {
      throw new Error('Did not initialize Octokit.');
    }
    return this.octokitAndToken.octokit;
  }

  async getToken(): Promise<string> {
    if (this.octokitAndToken) {
      return this.octokitAndToken.token;
    }
    this.octokitAndToken = await this.createOctokit(true);
    if (!this.octokitAndToken) {
      throw new Error('Did not initialize Octokit.');
    }
    return this.octokitAndToken.token;
  }
}
