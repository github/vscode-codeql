import { commands, ExtensionContext, window as Window } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { DatabaseManager } from './databases';
import { DatabaseUI } from './databases-ui';
import { spawnIdeServer } from './ide-server';
import { InterfaceManager } from './interface';
import { compileAndRunQueryAgainstDatabase, EvaluationInfo, tmpDirDisposal } from './queries';
import * as qsClient from './queryserver-client';
import { QLConfigurationListener } from './config';
import { QueryHistoryItem, QueryHistoryManager } from './query-history';
import * as archiveFilesystemProvider from './archive-filesystem-provider';
import { logger, queryServerLogger, ideServerLogger } from './logging';
import * as helpers from './helpers';

/**
* extension.ts
* ------------
*
* A vscode extension for QL query development.
*/

export function activate(ctx: ExtensionContext) {
  // Initialise logging, and ensure all loggers are disposed upon exit.
  ctx.subscriptions.push(logger);
  ctx.subscriptions.push(queryServerLogger);
  ctx.subscriptions.push(ideServerLogger);
  logger.log('Starting QL extension');

  const qlConfigurationListener = new QLConfigurationListener();
  ctx.subscriptions.push(qlConfigurationListener);

  const qs = new qsClient.QueryServerClient(qlConfigurationListener, {
    logger: queryServerLogger,
  });
  ctx.subscriptions.push(qs);
  const dbm = new DatabaseManager(ctx);
  ctx.subscriptions.push(dbm);
  const databaseUI = new DatabaseUI(ctx, dbm, qs);
  ctx.subscriptions.push(databaseUI);

  const qhm = new QueryHistoryManager(ctx, item => showResultsForInfo(item.info));
  const intm = new InterfaceManager(ctx, dbm, msg => {
    if (qs !== undefined) { qs.log(msg) }
  });
  ctx.subscriptions.push(intm);
  archiveFilesystemProvider.activate(ctx);

  function showResultsForInfo(info: EvaluationInfo) {
    intm.showResults(ctx, info);
  }

  async function compileAndRunQueryAsync(qs: qsClient.QueryServerClient, quickEval: boolean): Promise<EvaluationInfo> {
    const dbItem = await databaseUI.getDatabaseItem();
    if (dbItem === undefined) {
      throw new Error('Can\'t run query without a selected database');
    }
    return compileAndRunQueryAgainstDatabase(qlConfigurationListener,qs, dbItem, quickEval);
  }

  function compileAndRunQuerySync(
    quickEval: boolean,
  ) {
    if (qs !== undefined) {
      compileAndRunQueryAsync(qs, quickEval)
        .then(info => {
          showResultsForInfo(info);
          qhm.push(new QueryHistoryItem("query", "db", info));
        })
        .catch(e => {
          if (e instanceof Error)
            helpers.showAndLogErrorMessage(e.message);
          else
            throw e;
        });
    }
  }

  ctx.subscriptions.push(tmpDirDisposal);

  let client = new LanguageClient('QL Language Server', () => spawnIdeServer(qlConfigurationListener), {
    documentSelector: ['ql', {language: 'json', pattern: '**/qlpack.json'}],
    synchronize: {
      configurationSection: 'ql'
    },
    // Ensure that language server exceptions are logged to the same channel as its output.
    outputChannel: ideServerLogger.outputChannel
  }, true);

  ctx.subscriptions.push(commands.registerCommand('ql.runQuery', () => compileAndRunQuerySync(false)));
  ctx.subscriptions.push(commands.registerCommand('ql.quickEval', () => compileAndRunQuerySync(true)));

  ctx.subscriptions.push(client.start());
}
