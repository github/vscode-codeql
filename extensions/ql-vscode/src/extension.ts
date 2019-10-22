import { commands, ExtensionContext, ProgressOptions, ProgressLocation } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { DatabaseManager } from './databases';
import { DatabaseUI } from './databases-ui';
import { spawnIdeServer } from './ide-server';
import { InterfaceManager } from './interface';
import { compileAndRunQueryAgainstDatabase, EvaluationInfo, tmpDirDisposal } from './queries';
import * as qsClient from './queryserver-client';
import { QueryServerConfigListener, DistributionConfigListener } from './config';
import { QueryHistoryItem, QueryHistoryManager } from './query-history';
import * as archiveFilesystemProvider from './archive-filesystem-provider';
import { logger, queryServerLogger, ideServerLogger } from './logging';
import * as helpers from './helpers';
import { DistributionManager, DistributionInstallOrUpdateResultKind } from './distribution';

/**
* extension.ts
* ------------
*
* A vscode extension for QL query development.
*/

export async function activate(ctx: ExtensionContext): Promise<void> {
  // Initialise logging, and ensure all loggers are disposed upon exit.
  ctx.subscriptions.push(logger);
  logger.log('Starting QL extension');

  const distributionConfigListener = new DistributionConfigListener();
  ctx.subscriptions.push(distributionConfigListener);
  const distributionManager = new DistributionManager(ctx, distributionConfigListener);

  async function downloadOrUpdateDistribution(progressTitle: string): Promise<void> {
    const progressOptions: ProgressOptions = {
      location: ProgressLocation.Notification,
      title: progressTitle,
      cancellable: false,
    };
    const result = await helpers.withProgress(progressOptions,
      progress => distributionManager.installOrUpdateDistribution(progress));
    switch (result.kind) {
      case DistributionInstallOrUpdateResultKind.AlreadyUpToDate:
        helpers.showAndLogInformationMessage("CodeQL tools already up to date.");
        break;
      case DistributionInstallOrUpdateResultKind.DistributionUpdated:
        helpers.showAndLogInformationMessage(`CodeQL tools updated to version ${result.updatedRelease.name}.`);
        break;
      case DistributionInstallOrUpdateResultKind.InvalidDistributionLocation:
        helpers.showAndLogErrorMessage("CodeQL tools are installed externally so could not be updated.");
        break;
      default:
        helpers.assertNever(result);
    }
  }

  ctx.subscriptions.push(commands.registerCommand('ql.updateTools', () => downloadOrUpdateDistribution("Checking for CodeQL Updates")));

  if (await distributionManager.getCodeQlPath() === undefined) {
    await downloadOrUpdateDistribution("Installing CodeQL Distribution");
  }

  activateWithInstalledDistribution(ctx, distributionManager);
}

async function activateWithInstalledDistribution(ctx: ExtensionContext, distributionManager: DistributionManager) {
  const qlConfigurationListener = await QueryServerConfigListener.createQueryServerConfigListener(distributionManager);
  ctx.subscriptions.push(qlConfigurationListener);

  ctx.subscriptions.push(queryServerLogger);
  ctx.subscriptions.push(ideServerLogger);

  const qs = new qsClient.QueryServerClient(qlConfigurationListener, {
    logger: queryServerLogger,
  });
  ctx.subscriptions.push(qs);
  await qs.startQueryServer();

  const dbm = new DatabaseManager(ctx, qlConfigurationListener, logger);
  ctx.subscriptions.push(dbm);
  const databaseUI = new DatabaseUI(ctx, dbm, qs);
  ctx.subscriptions.push(databaseUI);

  const qhm = new QueryHistoryManager(ctx, async item => showResultsForInfo(item.info));
  const intm = new InterfaceManager(ctx, dbm, qlConfigurationListener, queryServerLogger);
  ctx.subscriptions.push(intm);
  archiveFilesystemProvider.activate(ctx);

  async function showResultsForInfo(info: EvaluationInfo): Promise<void> {
    await intm.showResults(info);
  }

  async function compileAndRunQuery(quickEval: boolean) {
    if (qs !== undefined) {
      try {
        const dbItem = await databaseUI.getDatabaseItem();
        if (dbItem === undefined) {
          throw new Error('Can\'t run query without a selected database');
        }
        const info = await compileAndRunQueryAgainstDatabase(qlConfigurationListener, qs, dbItem, quickEval);
        await showResultsForInfo(info);
        qhm.push(new QueryHistoryItem(info));
      }
      catch (e) {
        if (e instanceof Error)
          helpers.showAndLogErrorMessage(e.message);
        else
          throw e;
      }
    }
  }

  ctx.subscriptions.push(tmpDirDisposal);

  let client = new LanguageClient('QL Language Server', () => spawnIdeServer(qlConfigurationListener), {
    documentSelector: ['ql', { language: 'yaml', pattern: '**/qlpack.yml' }],
    synchronize: {
      configurationSection: 'ql'
    },
    // Ensure that language server exceptions are logged to the same channel as its output.
    outputChannel: ideServerLogger.outputChannel
  }, true);

  ctx.subscriptions.push(commands.registerCommand('ql.runQuery', async () => await compileAndRunQuery(false)));
  ctx.subscriptions.push(commands.registerCommand('ql.quickEval', async () => await compileAndRunQuery(true)));

  ctx.subscriptions.push(client.start());
}
