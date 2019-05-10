import { commands, ExtensionContext } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { DatabaseManager } from './databases';
import { spawnIdeServer } from './ide-server';

/**
 * extension.ts
 * ------------
 *
 * A vscode extension for QL query development.
 */

export function activate(ctx: ExtensionContext) {

  const dbm = new DatabaseManager(ctx);

  let client = new LanguageClient('ql', spawnIdeServer, {
    documentSelector: ['ql'],
    synchronize: {
      configurationSection: 'ql'
    }
  }, true);

  ctx.subscriptions.push(commands.registerCommand('ql.setCurrentDatabase', (db) => dbm.setCurrentDatabase(db)));
  ctx.subscriptions.push(commands.registerCommand('ql.chooseDatabase', () => dbm.chooseAndSetDatabaseSync()));
  ctx.subscriptions.push(commands.registerCommand('qlDatabases.setCurrentDatabase', (db) => dbm.setCurrentItem(db)));
  ctx.subscriptions.push(commands.registerCommand('qlDatabases.removeDatabase', (db) => dbm.removeItem(db)));

  ctx.subscriptions.push(client.start());
}
