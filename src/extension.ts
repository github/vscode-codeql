import { commands, ExtensionContext } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { spawnIdeServer } from './ide-server';

/**
 * extension.ts
 * ------------
 *
 * A vscode extension for QL query development.
 */

export function activate(ctx: ExtensionContext) {

  let client = new LanguageClient('ql', spawnIdeServer, {
    documentSelector: ['ql'],
    synchronize: {
      configurationSection: 'ql'
    }
  }, true);

  ctx.subscriptions.push(client.start());
}
