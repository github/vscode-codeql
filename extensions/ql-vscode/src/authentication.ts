import * as vscode from 'vscode';
import * as Octokit from '@octokit/rest';

const GITHUB_AUTH_PROVIDER_ID = 'github';

// 'repo' scope should be enough for triggering workflows. For a comprenhensive list, see:
// https://docs.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps
const SCOPES = ['repo'];

/** 
 * Handles authentication to GitHub, using the VS Code [authentication API](https://code.visualstudio.com/api/references/vscode-api#authentication).
 */
export class Credentials {
  private octokit: Octokit.Octokit | undefined;

  // Explicitly make the constructor private, so that we can't accidentally call the constructor from outside the class
  // without also initializing the class.
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() { }

  static async initialize(context: vscode.ExtensionContext): Promise<Credentials> {
    const c = new Credentials();
    c.registerListeners(context);
    await c.initializeOctokit(false);
    return c;
  }

  private async initializeOctokit(createIfNone: boolean) {
    // If `createIfNone` is true, a dialog pops up asking the user to authenticate as soon as the extension starts.
    // Initializing with `createIfNone: false` for now, so we can have a more quiet prompt, i.e. a numbered label on
    // the "accounts" icon in the activity bar.
    const session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone: createIfNone });

    if (session) {
      this.octokit = new Octokit.Octokit({
        auth: session.accessToken
      });
    } else {
      this.octokit = undefined;
    }
  }

  registerListeners(context: vscode.ExtensionContext): void {
    // Sessions are changed when a user logs in or logs out.
    context.subscriptions.push(vscode.authentication.onDidChangeSessions(async e => {
      if (e.provider.id === GITHUB_AUTH_PROVIDER_ID) {
        await this.initializeOctokit(false);
      }
    }));
  }

  async getOctokit(): Promise<Octokit.Octokit> {
    if (this.octokit) {
      return this.octokit;
    }

    await this.initializeOctokit(true);
    // octokit shouldn't be undefined, since we've set "createIfNone: true".
    // The following block is mainly here to prevent a compiler error.
    if (!this.octokit) {
      throw new Error('Failed to initialize Octokit.');
    }
    return this.octokit;
  }
}
