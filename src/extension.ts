import { commands, ExtensionContext, window as Window } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { DatabaseManager } from './databases';
import { spawnIdeServer } from './ide-server';
import { showResults } from './interface';
import { compileAndRunQueryAgainstDatabase, EvaluationInfo, spawnQueryServer, tmpDirDisposal } from './queries';
import * as qsClient from './queryserver-client';
import { QLConfiguration } from './config';

/**
* extension.ts
* ------------
*
* A vscode extension for QL query development.
*/

export function activate(ctx: ExtensionContext) {

  function showResultsForInfo(qs: qsClient.Server, info: EvaluationInfo) {
    showResults(ctx, info, qs);
  }

  async function compileAndRunQueryAsync(qs: qsClient.Server, quickEval: boolean): Promise<EvaluationInfo> {
    const dbItem = await dbm.getDatabaseItem();
    if (dbItem == undefined) {
      throw new Error('Can\'t run query without a selected database');
    }
    return compileAndRunQueryAgainstDatabase(qs, dbItem, quickEval);
  }

  function compileAndRunQuerySync(
    quickEval: boolean,
  ) {
    if (qs) {
      compileAndRunQueryAsync(qs, quickEval)
        .then(info => showResultsForInfo(qs, info))
        .catch(e => {
          if (e instanceof Error)
            Window.showErrorMessage(e.message);
          else
            throw e;
        });
    }
  }

  const qlConfiguration = new QLConfiguration();

  const dbm = new DatabaseManager(ctx);
  const qs = spawnQueryServer(qlConfiguration);

  ctx.subscriptions.push(tmpDirDisposal);

  let client = new LanguageClient('ql', () => spawnIdeServer(qlConfiguration), {
    documentSelector: ['ql'],
    synchronize: {
      configurationSection: 'ql'
    }
  }, true);

  ctx.subscriptions.push(commands.registerCommand('ql.setCurrentDatabase', (db) => dbm.setCurrentDatabase(db)));
  ctx.subscriptions.push(commands.registerCommand('ql.chooseDatabase', () => dbm.chooseAndSetDatabaseSync()));
  ctx.subscriptions.push(commands.registerCommand('qlDatabases.setCurrentDatabase', (db) => dbm.setCurrentItem(db)));
  ctx.subscriptions.push(commands.registerCommand('qlDatabases.removeDatabase', (db) => dbm.removeItem(db)));
  ctx.subscriptions.push(commands.registerCommand('ql.runQuery', () => compileAndRunQuerySync(false)));
  ctx.subscriptions.push(commands.registerCommand('ql.quickEval', () => compileAndRunQuerySync(true)));

  ctx.subscriptions.push(client.start());
}
