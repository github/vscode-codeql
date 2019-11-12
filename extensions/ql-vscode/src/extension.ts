import { commands, Disposable, ExtensionContext, extensions, ProgressLocation, ProgressOptions, window as Window, Uri } from 'vscode';
import { ErrorCodes, LanguageClient, ResponseError } from 'vscode-languageclient';
import * as archiveFilesystemProvider from './archive-filesystem-provider';
import { DistributionConfigListener, QueryServerConfigListener } from './config';
import { DatabaseManager } from './databases';
import { DatabaseUI } from './databases-ui';
import { DistributionUpdateCheckResultKind, DistributionManager, FindDistributionResult, FindDistributionResultKind, GithubApiError, DEFAULT_DISTRIBUTION_VERSION_CONSTRAINT } from './distribution';
import * as helpers from './helpers';
import { spawnIdeServer } from './ide-server';
import { InterfaceManager, WebviewReveal } from './interface';
import { ideServerLogger, logger, queryServerLogger } from './logging';
import { compileAndRunQueryAgainstDatabase, EvaluationInfo, tmpDirDisposal, UserCancellationException } from './queries';
import { QueryHistoryItem, QueryHistoryManager } from './query-history';
import * as qsClient from './queryserver-client';
import { CodeQLCliServer } from './cli';
import { assertNever } from './helpers-pure';

/**
 * extension.ts
 * ------------
 *
 * A vscode extension for CodeQL query development.
 */

/**
 * Holds when we have proceeded past the initial phase of extension activation in which
 * we are trying to ensure that a valid CodeQL distribution exists, and we're actually setting
 * up the bulk of the extension.
 */
let beganMainExtensionActivation = false;

/**
 * A list of vscode-registered-command disposables that contain
 * temporary stub handlers for commands that exist package.json (hence
 * are already connected to onscreen ui elements) but which will not
 * have any useful effect if we haven't located a CodeQL distribution.
 */
const errorStubs: Disposable[] = [];

/**
 * Holds when we are installing or checking for updates to the distribution.
 */
let isInstallingOrUpdatingDistribution = false;

/**
 * If the user tries to execute vscode commands after extension activation is failed, give
 * a sensible error message.
 *
 * @param excludedCommands List of commands for which we should not register error stubs.
 */
function registerErrorStubs(ctx: ExtensionContext, excludedCommands: string[], stubGenerator: (command: string) => () => void) {
  // Remove existing stubs
  errorStubs.forEach(stub => stub.dispose());

  const extensionId = 'GitHub.vscode-codeql'; // TODO: Is there a better way of obtaining this?
  const extension = extensions.getExtension(extensionId);
  if (extension === undefined)
    throw new Error(`Can't find extension ${extensionId}`);

  const stubbedCommands: string[]
    = extension.packageJSON.contributes.commands.map((entry: { command: string }) => entry.command);

  stubbedCommands.forEach(command => {
    if (excludedCommands.indexOf(command) === -1) {
      errorStubs.push(commands.registerCommand(command, stubGenerator(command)));
    }
  });
}

export async function activate(ctx: ExtensionContext): Promise<void> {
  // Initialise logging, and ensure all loggers are disposed upon exit.
  ctx.subscriptions.push(logger);
  logger.log('Starting CodeQL extension');

  const distributionConfigListener = new DistributionConfigListener();
  ctx.subscriptions.push(distributionConfigListener);
  const distributionManager = new DistributionManager(ctx, distributionConfigListener, DEFAULT_DISTRIBUTION_VERSION_CONSTRAINT);

  const shouldUpdateOnNextActivationKey = "shouldUpdateOnNextActivation";
  
  registerErrorStubs(ctx, [checkForUpdatesCommand], command => () => {
    Window.showErrorMessage(`Can't execute ${command}: waiting to finish loading CodeQL CLI.`);
  });

  async function installOrUpdateDistributionWithProgressTitle(progressTitle: string, isSilentIfCannotUpdate: boolean): Promise<void> {
    const result = await distributionManager.checkForUpdatesToExtensionManagedDistribution();
    switch (result.kind) {
      case DistributionUpdateCheckResultKind.AlreadyUpToDate:
        if (!isSilentIfCannotUpdate) {
          helpers.showAndLogInformationMessage("CodeQL CLI already up to date.");
        }
        break;
      case DistributionUpdateCheckResultKind.InvalidDistributionLocation:
        if (!isSilentIfCannotUpdate) {
          helpers.showAndLogErrorMessage("CodeQL CLI is installed externally so could not be updated.");
        }
        break;
      case DistributionUpdateCheckResultKind.UpdateAvailable:
        if (beganMainExtensionActivation) {
          const updateAvailableMessage = `Version "${result.updatedRelease.name}" of the CodeQL CLI is now available. ` +
            "The update will be installed after Visual Studio Code restarts. Restart now to upgrade?";
          ctx.globalState.update(shouldUpdateOnNextActivationKey, true);
          if (await helpers.showInformationMessageWithAction(updateAvailableMessage, "Restart and Upgrade")) {
            await commands.executeCommand("workbench.action.reloadWindow");
          }
        } else {
          const progressOptions: ProgressOptions = {
            location: ProgressLocation.Notification,
            title: progressTitle,
            cancellable: false,
          };
          await helpers.withProgress(progressOptions, progress =>
            distributionManager.installExtensionManagedDistributionRelease(result.updatedRelease, progress));

          ctx.globalState.update(shouldUpdateOnNextActivationKey, false);
          helpers.showAndLogInformationMessage(`CodeQL CLI updated to version "${result.updatedRelease.name}".`);
        }
        break;
      default:
        assertNever(result);
    }
  }

  async function installOrUpdateDistribution(isSilentIfCannotUpdate: boolean): Promise<void> {
    if (isInstallingOrUpdatingDistribution) {
      throw new Error("Already installing or updating CodeQL CLI");
    }
    isInstallingOrUpdatingDistribution = true;
    try {
      const codeQlInstalled = await distributionManager.getCodeQlPathWithoutVersionCheck() !== undefined;
      const messageText = ctx.globalState.get(shouldUpdateOnNextActivationKey) ? "Updating CodeQL CLI" :
        codeQlInstalled ? "Checking for updates to CodeQL CLI" : "Installing CodeQL CLI";
      await installOrUpdateDistributionWithProgressTitle(messageText, isSilentIfCannotUpdate);
    } catch (e) {
      // Don't rethrow the exception, because if the config is changed, we want to be able to retry installing
      // or updating the distribution.
      if (e instanceof GithubApiError && (e.status == 404 || e.status == 403 || e.status === 401)) {
        const errorMessageResponse = Window.showErrorMessage("Unable to download CodeQL CLI. See " +
          "https://github.com/github/vscode-codeql/blob/master/extensions/ql-vscode/README.md for more details about how " +
          "to obtain CodeQL CLI.", "Edit Settings");
        // We're deliberately not `await`ing this promise, just
        // asynchronously letting the user follow the convenience link
        // if they want to.
        errorMessageResponse.then(response => {
          if (response !== undefined) {
            commands.executeCommand('workbench.action.openSettingsJson');
          }
        });
      } else {
        helpers.showAndLogErrorMessage("Unable to download CodeQL CLI. " + e);
      }
    } finally {
      isInstallingOrUpdatingDistribution = false;
    }
  }

  async function getDistributionDisplayingDistributionWarnings(): Promise<FindDistributionResult> {
    const result = await distributionManager.getDistribution();
    switch (result.kind) {
      case FindDistributionResultKind.CompatibleDistribution:
        logger.log(`Found compatible version of CodeQL CLI (version ${result.version.rawString})`);
        break;
      case FindDistributionResultKind.IncompatibleDistribution:
        helpers.showAndLogWarningMessage("The current version of the CodeQL CLI is incompatible with this extension.");
        break;
      case FindDistributionResultKind.UnknownCompatibilityDistribution:
        helpers.showAndLogWarningMessage("Compatibility with the configured CodeQL CLI could not be determined. " +
          "You may experience problems using the extension.");
        break;
      case FindDistributionResultKind.NoDistribution:
        helpers.showAndLogErrorMessage("The CodeQL CLI could not be found.");
        break;
      default:
        assertNever(result);
    }
    return result;
  }

  async function installOrUpdateThenTryActivate(isSilentIfCannotUpdate: boolean): Promise<void> {
    if (!isInstallingOrUpdatingDistribution) {
      await installOrUpdateDistribution(isSilentIfCannotUpdate);
    }

    // Display the warnings even if the extension has already activated.
    const distributionResult = await getDistributionDisplayingDistributionWarnings();

    if (!beganMainExtensionActivation && distributionResult.kind !== FindDistributionResultKind.NoDistribution) {
      await activateWithInstalledDistribution(ctx, distributionManager);
    } else if (distributionResult.kind === FindDistributionResultKind.NoDistribution) {
      registerErrorStubs(ctx, [checkForUpdatesCommand], command => async () => {
        const installActionName = "Install CodeQL CLI";
        const chosenAction = await Window.showErrorMessage(`Can't execute ${command}: missing CodeQL CLI.`, installActionName);
        if (chosenAction === installActionName) {
          installOrUpdateThenTryActivate(true);
        }
      });
    }
  }

  ctx.subscriptions.push(distributionConfigListener.onDidChangeDistributionConfiguration(() => installOrUpdateThenTryActivate(true)));
  ctx.subscriptions.push(commands.registerCommand(checkForUpdatesCommand, () => installOrUpdateThenTryActivate(false)));

  await installOrUpdateThenTryActivate(true);
}

async function activateWithInstalledDistribution(ctx: ExtensionContext, distributionManager: DistributionManager) {
  beganMainExtensionActivation = true;
  // Remove any error stubs command handlers left over from first part
  // of activation.
  errorStubs.forEach(stub => stub.dispose());

  const qlConfigurationListener = await QueryServerConfigListener.createQueryServerConfigListener(distributionManager);
  ctx.subscriptions.push(qlConfigurationListener);

  ctx.subscriptions.push(queryServerLogger);
  ctx.subscriptions.push(ideServerLogger);


  const cliServer = new CodeQLCliServer(distributionManager, logger);
  ctx.subscriptions.push(cliServer);

  const qs = new qsClient.QueryServerClient(qlConfigurationListener, cliServer, {
    logger: queryServerLogger,
  }, task => Window.withProgress({ title: 'CodeQL query server', location: ProgressLocation.Window }, task));
  ctx.subscriptions.push(qs);
  await qs.startQueryServer();

  const dbm = new DatabaseManager(ctx, qlConfigurationListener, logger);
  ctx.subscriptions.push(dbm);
  const databaseUI = new DatabaseUI(ctx, cliServer, dbm, qs);
  ctx.subscriptions.push(databaseUI);

  const qhm = new QueryHistoryManager(ctx, async item => showResultsForInfo(item.info, WebviewReveal.Forced));
  const intm = new InterfaceManager(ctx, dbm, cliServer, queryServerLogger);
  ctx.subscriptions.push(intm);
  archiveFilesystemProvider.activate(ctx);

  async function showResultsForInfo(info: EvaluationInfo, forceReveal: WebviewReveal): Promise<void> {
    await intm.showResults(info, forceReveal, false);
  }

  async function compileAndRunQuery(quickEval: boolean, selectedQuery: Uri | undefined) {
    if (qs !== undefined) {
      try {
        const dbItem = await databaseUI.getDatabaseItem();
        if (dbItem === undefined) {
          throw new Error('Can\'t run query without a selected database');
        }
        const info = await compileAndRunQueryAgainstDatabase(cliServer, qs, dbItem, quickEval, selectedQuery);
        await showResultsForInfo(info, WebviewReveal.NotForced);
        qhm.push(new QueryHistoryItem(info));
      }
      catch (e) {
        if (e instanceof UserCancellationException) {
          logger.log(e.message);
        }
        else if (e instanceof ResponseError && e.code == ErrorCodes.RequestCancelled) {
          logger.log(e.message);
        }
        else if (e instanceof Error)
          helpers.showAndLogErrorMessage(e.message);
        else
          throw e;
      }
    }
  }

  ctx.subscriptions.push(tmpDirDisposal);

  let client = new LanguageClient('CodeQL Language Server', () => spawnIdeServer(qlConfigurationListener), {
    documentSelector: [
      { language: 'ql', scheme: 'file' },
      { language: 'yaml', scheme: 'file', pattern: '**/qlpack.yml' }
    ],
    synchronize: {
      configurationSection: 'codeQL'
    },
    // Ensure that language server exceptions are logged to the same channel as its output.
    outputChannel: ideServerLogger.outputChannel
  }, true);

  ctx.subscriptions.push(commands.registerCommand('codeQL.runQuery', async (uri: Uri | undefined) => await compileAndRunQuery(false, uri)));
  ctx.subscriptions.push(commands.registerCommand('codeQL.quickEval', async (uri: Uri | undefined) => await compileAndRunQuery(true, uri)));

  ctx.subscriptions.push(client.start());
}

const checkForUpdatesCommand = 'codeQL.checkForUpdatesToCLI';
