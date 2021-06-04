/* eslint-disable @typescript-eslint/camelcase */
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

  async initialize(context: vscode.ExtensionContext): Promise<void> {
    this.registerListeners(context);
    this.setOctokit();
  }

  private async setOctokit() {
    // If `createIfNone` were true, a dialog would pop up asking the user to authenticate as soon as the extension starts.
    // Setting `createIfNone` to false for now, so we can have a more "quiet" prompt, i.e. a numbered label on the "accounts"
    // icon in the activity bar.
    const session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone: false });

    if (session) {
      this.octokit = new Octokit.Octokit({
        auth: session.accessToken
      });

      return;
    }

    this.octokit = undefined;
  }

  registerListeners(context: vscode.ExtensionContext): void {
    // Sessions are changed when a user logs in or logs out.
    context.subscriptions.push(vscode.authentication.onDidChangeSessions(async e => {
      if (e.provider.id === GITHUB_AUTH_PROVIDER_ID) {
        await this.setOctokit();
      }
    }));
  }

  async getOctokit(): Promise<Octokit.Octokit> {
    if (this.octokit) {
      return this.octokit;
    }

    const session = await vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone: true });
    this.octokit = new Octokit.Octokit({
      auth: session.accessToken
    });
    return this.octokit;
  }
}


