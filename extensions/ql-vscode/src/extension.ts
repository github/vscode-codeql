import {
  CancellationToken,
  commands,
  Disposable,
  ExtensionContext,
  extensions,
  languages,
  ProgressLocation,
  ProgressOptions,
  Uri,
  window as Window,
  env,
  window,
  QuickPickItem
} from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import * as os from 'os';
import * as path from 'path';
import * as tmp from 'tmp-promise';
import { testExplorerExtensionId, TestHub } from 'vscode-test-adapter-api';

import { AstViewer } from './astViewer';
import * as archiveFilesystemProvider from './archive-filesystem-provider';
import { CodeQLCliServer, CliVersionConstraint } from './cli';
import {
  CliConfigListener,
  DistributionConfigListener,
  isCanary,
  MAX_QUERIES,
  QueryHistoryConfigListener,
  QueryServerConfigListener
} from './config';
import * as languageSupport from './languageSupport';
import { DatabaseItem, DatabaseManager } from './databases';
import { DatabaseUI } from './databases-ui';
import * as messages from './pure/messages';
import {
  TemplateQueryDefinitionProvider,
  TemplateQueryReferenceProvider,
  TemplatePrintAstProvider
} from './contextual/templateProvider';
import {
  DEFAULT_DISTRIBUTION_VERSION_RANGE,
  DistributionKind,
  DistributionManager,
  DistributionUpdateCheckResultKind,
  FindDistributionResult,
  FindDistributionResultKind,
  GithubApiError,
  GithubRateLimitedError
} from './distribution';
import * as helpers from './helpers';
import { assertNever } from './pure/helpers-pure';
import { spawnIdeServer } from './ide-server';
import { InterfaceManager } from './interface';
import { WebviewReveal } from './interface-utils';
import { ideServerLogger, logger, queryServerLogger } from './logging';
import { QueryHistoryManager } from './query-history';
import { CompletedQuery } from './query-results';
import * as qsClient from './queryserver-client';
import { displayQuickQuery } from './quick-query';
import { compileAndRunInitializedQueryAgainstDatabase, createResult, initQuery, QueryWithResults, tmpDirDisposal } from './run-queries';
import { QLTestAdapterFactory } from './test-adapter';
import { TestUIService } from './test-ui';
import { CompareInterfaceManager } from './compare/compare-interface';
import { gatherQlFiles } from './pure/files';
import { initializeTelemetry } from './telemetry';
import {
  commandRunner,
  commandRunnerWithProgress,
  ProgressCallback,
  withProgress,
  ProgressUpdate
} from './commandRunner';
import { CodeQlStatusBarHandler } from './status-bar';

import { Credentials } from './authentication';
import { runRemoteQuery } from './remote-queries/run-remote-query';
import { RemoteQueriesInterfaceManager } from './remote-queries/remote-queries-interface';

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

const extensionId = 'GitHub.vscode-codeql';
const extension = extensions.getExtension(extensionId);

/**
 * If the user tries to execute vscode commands after extension activation is failed, give
 * a sensible error message.
 *
 * @param excludedCommands List of commands for which we should not register error stubs.
 */
function registerErrorStubs(excludedCommands: string[], stubGenerator: (command: string) => () => Promise<void>): void {
  // Remove existing stubs
  errorStubs.forEach(stub => stub.dispose());

  if (extension === undefined) {
    throw new Error(`Can't find extension ${extensionId}`);
  }

  const stubbedCommands: string[]
    = extension.packageJSON.contributes.commands.map((entry: { command: string }) => entry.command);

  stubbedCommands.forEach(command => {
    if (excludedCommands.indexOf(command) === -1) {
      errorStubs.push(commandRunner(command, stubGenerator(command)));
    }
  });
}

/**
 * The publicly available interface for this extension. This is to
 * be used in our tests.
 */
export interface CodeQLExtensionInterface {
  readonly ctx: ExtensionContext;
  readonly cliServer: CodeQLCliServer;
  readonly qs: qsClient.QueryServerClient;
  readonly distributionManager: DistributionManager;
  readonly databaseManager: DatabaseManager;
  readonly databaseUI: DatabaseUI;
  readonly dispose: () => void;
}

/**
 * Returns the CodeQLExtensionInterface, or an empty object if the interface is not
 * available after activation is complete. This will happen if there is no cli
 * installed when the extension starts. Downloading and installing the cli
 * will happen at a later time.
 *
 * @param ctx The extension context
 *
 * @returns CodeQLExtensionInterface
 */
export async function activate(ctx: ExtensionContext): Promise<CodeQLExtensionInterface | Record<string, never>> {
  void logger.log(`Starting ${extensionId} extension`);
  if (extension === undefined) {
    throw new Error(`Can't find extension ${extensionId}`);
  }

  const distributionConfigListener = new DistributionConfigListener();
  await initializeLogging(ctx);
  await initializeTelemetry(extension, ctx);
  languageSupport.install();

  ctx.subscriptions.push(distributionConfigListener);
  const codeQlVersionRange = DEFAULT_DISTRIBUTION_VERSION_RANGE;
  const distributionManager = new DistributionManager(distributionConfigListener, codeQlVersionRange, ctx);

  const shouldUpdateOnNextActivationKey = 'shouldUpdateOnNextActivation';

  registerErrorStubs([checkForUpdatesCommand], command => (async () => {
    void helpers.showAndLogErrorMessage(`Can't execute ${command}: waiting to finish loading CodeQL CLI.`);
  }));

  interface DistributionUpdateConfig {
    isUserInitiated: boolean;
    shouldDisplayMessageWhenNoUpdates: boolean;
    allowAutoUpdating: boolean;
  }

  async function installOrUpdateDistributionWithProgressTitle(progressTitle: string, config: DistributionUpdateConfig): Promise<void> {
    const minSecondsSinceLastUpdateCheck = config.isUserInitiated ? 0 : 86400;
    const noUpdatesLoggingFunc = config.shouldDisplayMessageWhenNoUpdates ?
      helpers.showAndLogInformationMessage : async (message: string) => void logger.log(message);
    const result = await distributionManager.checkForUpdatesToExtensionManagedDistribution(minSecondsSinceLastUpdateCheck);

    // We do want to auto update if there is no distribution at all
    const allowAutoUpdating = config.allowAutoUpdating || !await distributionManager.hasDistribution();

    switch (result.kind) {
      case DistributionUpdateCheckResultKind.AlreadyCheckedRecentlyResult:
        void logger.log('Didn\'t perform CodeQL CLI update check since a check was already performed within the previous ' +
          `${minSecondsSinceLastUpdateCheck} seconds.`);
        break;
      case DistributionUpdateCheckResultKind.AlreadyUpToDate:
        await noUpdatesLoggingFunc('CodeQL CLI already up to date.');
        break;
      case DistributionUpdateCheckResultKind.InvalidLocation:
        await noUpdatesLoggingFunc('CodeQL CLI is installed externally so could not be updated.');
        break;
      case DistributionUpdateCheckResultKind.UpdateAvailable:
        if (beganMainExtensionActivation || !allowAutoUpdating) {
          const updateAvailableMessage = `Version "${result.updatedRelease.name}" of the CodeQL CLI is now available. ` +
            'Do you wish to upgrade?';
          await ctx.globalState.update(shouldUpdateOnNextActivationKey, true);
          if (await helpers.showInformationMessageWithAction(updateAvailableMessage, 'Restart and Upgrade')) {
            await commands.executeCommand('workbench.action.reloadWindow');
          }
        } else {
          const progressOptions: ProgressOptions = {
            title: progressTitle,
            location: ProgressLocation.Notification,
          };

          await withProgress(progressOptions, progress =>
            distributionManager.installExtensionManagedDistributionRelease(result.updatedRelease, progress));

          await ctx.globalState.update(shouldUpdateOnNextActivationKey, false);
          void helpers.showAndLogInformationMessage(`CodeQL CLI updated to version "${result.updatedRelease.name}".`);
        }
        break;
      default:
        assertNever(result);
    }
  }

  async function installOrUpdateDistribution(config: DistributionUpdateConfig): Promise<void> {
    if (isInstallingOrUpdatingDistribution) {
      throw new Error('Already installing or updating CodeQL CLI');
    }
    isInstallingOrUpdatingDistribution = true;
    const codeQlInstalled = await distributionManager.getCodeQlPathWithoutVersionCheck() !== undefined;
    const willUpdateCodeQl = ctx.globalState.get(shouldUpdateOnNextActivationKey);
    const messageText = willUpdateCodeQl
      ? 'Updating CodeQL CLI'
      : codeQlInstalled
        ? 'Checking for updates to CodeQL CLI'
        : 'Installing CodeQL CLI';

    try {
      await installOrUpdateDistributionWithProgressTitle(messageText, config);
    } catch (e) {
      // Don't rethrow the exception, because if the config is changed, we want to be able to retry installing
      // or updating the distribution.
      const alertFunction = (codeQlInstalled && !config.isUserInitiated) ?
        helpers.showAndLogWarningMessage : helpers.showAndLogErrorMessage;
      const taskDescription = (willUpdateCodeQl ? 'update' :
        codeQlInstalled ? 'check for updates to' : 'install') + ' CodeQL CLI';

      if (e instanceof GithubRateLimitedError) {
        void alertFunction(`Rate limited while trying to ${taskDescription}. Please try again after ` +
          `your rate limit window resets at ${e.rateLimitResetDate.toLocaleString(env.language)}.`);
      } else if (e instanceof GithubApiError) {
        void alertFunction(`Encountered GitHub API error while trying to ${taskDescription}. ` + e);
      }
      void alertFunction(`Unable to ${taskDescription}. ` + e);
    } finally {
      isInstallingOrUpdatingDistribution = false;
    }
  }

  async function getDistributionDisplayingDistributionWarnings(): Promise<FindDistributionResult> {
    const result = await distributionManager.getDistribution();
    switch (result.kind) {
      case FindDistributionResultKind.CompatibleDistribution:
        void logger.log(`Found compatible version of CodeQL CLI (version ${result.version.raw})`);
        break;
      case FindDistributionResultKind.IncompatibleDistribution: {
        const fixGuidanceMessage = (() => {
          switch (result.distribution.kind) {
            case DistributionKind.ExtensionManaged:
              return 'Please update the CodeQL CLI by running the "CodeQL: Check for CLI Updates" command.';
            case DistributionKind.CustomPathConfig:
              return `Please update the \"CodeQL CLI Executable Path\" setting to point to a CLI in the version range ${codeQlVersionRange}.`;
            case DistributionKind.PathEnvironmentVariable:
              return `Please update the CodeQL CLI on your PATH to a version compatible with ${codeQlVersionRange}, or ` +
                `set the \"CodeQL CLI Executable Path\" setting to the path of a CLI version compatible with ${codeQlVersionRange}.`;
          }
        })();

        void helpers.showAndLogWarningMessage(
          `The current version of the CodeQL CLI (${result.version.raw}) ` +
          `is incompatible with this extension. ${fixGuidanceMessage}`
        );
        break;
      }
      case FindDistributionResultKind.UnknownCompatibilityDistribution:
        void helpers.showAndLogWarningMessage(
          'Compatibility with the configured CodeQL CLI could not be determined. ' +
          'You may experience problems using the extension.'
        );
        break;
      case FindDistributionResultKind.NoDistribution:
        void helpers.showAndLogErrorMessage('The CodeQL CLI could not be found.');
        break;
      default:
        assertNever(result);
    }
    return result;
  }

  async function installOrUpdateThenTryActivate(
    config: DistributionUpdateConfig
  ): Promise<CodeQLExtensionInterface | Record<string, never>> {

    await installOrUpdateDistribution(config);

    // Display the warnings even if the extension has already activated.
    const distributionResult = await getDistributionDisplayingDistributionWarnings();
    let extensionInterface: CodeQLExtensionInterface | Record<string, never> = {};
    if (!beganMainExtensionActivation && distributionResult.kind !== FindDistributionResultKind.NoDistribution) {
      extensionInterface = await activateWithInstalledDistribution(
        ctx,
        distributionManager,
        distributionConfigListener
      );

    } else if (distributionResult.kind === FindDistributionResultKind.NoDistribution) {
      registerErrorStubs([checkForUpdatesCommand], command => async () => {
        const installActionName = 'Install CodeQL CLI';
        const chosenAction = await void helpers.showAndLogErrorMessage(`Can't execute ${command}: missing CodeQL CLI.`, {
          items: [installActionName]
        });
        if (chosenAction === installActionName) {
          await installOrUpdateThenTryActivate({
            isUserInitiated: true,
            shouldDisplayMessageWhenNoUpdates: false,
            allowAutoUpdating: true
          });
        }
      });
    }
    return extensionInterface;
  }

  ctx.subscriptions.push(distributionConfigListener.onDidChangeConfiguration(() => installOrUpdateThenTryActivate({
    isUserInitiated: true,
    shouldDisplayMessageWhenNoUpdates: false,
    allowAutoUpdating: true
  })));
  ctx.subscriptions.push(commandRunner(checkForUpdatesCommand, () => installOrUpdateThenTryActivate({
    isUserInitiated: true,
    shouldDisplayMessageWhenNoUpdates: true,
    allowAutoUpdating: true
  })));

  return await installOrUpdateThenTryActivate({
    isUserInitiated: !!ctx.globalState.get(shouldUpdateOnNextActivationKey),
    shouldDisplayMessageWhenNoUpdates: false,

    // only auto update on startup if the user has previously requested an update
    // otherwise, ask user to accept the update
    allowAutoUpdating: !!ctx.globalState.get(shouldUpdateOnNextActivationKey)
  });
}

async function activateWithInstalledDistribution(
  ctx: ExtensionContext,
  distributionManager: DistributionManager,
  distributionConfigListener: DistributionConfigListener
): Promise<CodeQLExtensionInterface> {
  beganMainExtensionActivation = true;
  // Remove any error stubs command handlers left over from first part
  // of activation.
  errorStubs.forEach((stub) => stub.dispose());

  void logger.log('Initializing configuration listener...');
  const qlConfigurationListener = await QueryServerConfigListener.createQueryServerConfigListener(
    distributionManager
  );
  ctx.subscriptions.push(qlConfigurationListener);

  void logger.log('Initializing CodeQL cli server...');
  const cliServer = new CodeQLCliServer(
    distributionManager,
    new CliConfigListener(),
    logger
  );
  ctx.subscriptions.push(cliServer);

  const statusBar = new CodeQlStatusBarHandler(cliServer, distributionConfigListener);
  ctx.subscriptions.push(statusBar);

  void logger.log('Initializing query server client.');
  const qs = new qsClient.QueryServerClient(
    qlConfigurationListener,
    cliServer,
    {
      logger: queryServerLogger,
      contextStoragePath: getContextStoragePath(ctx),
    },
    (task) =>
      Window.withProgress(
        { title: 'CodeQL query server', location: ProgressLocation.Window },
        task
      )
  );
  ctx.subscriptions.push(qs);
  await qs.startQueryServer();

  void logger.log('Initializing database manager.');
  const dbm = new DatabaseManager(ctx, qs, cliServer, logger);
  ctx.subscriptions.push(dbm);
  void logger.log('Initializing database panel.');
  const databaseUI = new DatabaseUI(
    dbm,
    qs,
    getContextStoragePath(ctx),
    ctx.extensionPath
  );
  databaseUI.init();
  ctx.subscriptions.push(databaseUI);

  void logger.log('Initializing query history manager.');
  const queryHistoryConfigurationListener = new QueryHistoryConfigListener();
  ctx.subscriptions.push(queryHistoryConfigurationListener);
  const showResults = async (item: CompletedQuery) =>
    showResultsForCompletedQuery(item, WebviewReveal.Forced);

  const qhm = new QueryHistoryManager(
    qs,
    ctx.extensionPath,
    queryHistoryConfigurationListener,
    showResults,
    async (from: CompletedQuery, to: CompletedQuery) =>
      showResultsForComparison(from, to),
  );
  ctx.subscriptions.push(qhm);
  void logger.log('Initializing results panel interface.');
  const intm = new InterfaceManager(ctx, dbm, cliServer, queryServerLogger);
  ctx.subscriptions.push(intm);

  void logger.log('Initializing compare panel interface.');
  const cmpm = new CompareInterfaceManager(
    ctx,
    dbm,
    cliServer,
    queryServerLogger,
    showResults
  );
  ctx.subscriptions.push(cmpm);

  void logger.log('Initializing source archive filesystem provider.');
  archiveFilesystemProvider.activate(ctx);

  async function showResultsForComparison(
    from: CompletedQuery,
    to: CompletedQuery
  ): Promise<void> {
    try {
      await cmpm.showResults(from, to);
    } catch (e) {
      void helpers.showAndLogErrorMessage(e.message);
    }
  }

  async function showResultsForCompletedQuery(
    query: CompletedQuery,
    forceReveal: WebviewReveal
  ): Promise<void> {
    await intm.showResults(query, forceReveal, false);
  }

  async function compileAndRunQuery(
    quickEval: boolean,
    selectedQuery: Uri | undefined,
    progress: ProgressCallback,
    token: CancellationToken,
    databaseItem: DatabaseItem | undefined,
  ): Promise<void> {
    if (qs !== undefined) {
      // If no databaseItem is specified, use the database currently selected in the Databases UI
      databaseItem = databaseItem || await databaseUI.getDatabaseItem(progress, token);
      if (databaseItem === undefined) {
        throw new Error('Can\'t run query without a selected database');
      }

      // Initialize Query
      const queryInitInfo = await initQuery(
        cliServer,
        databaseItem,
        quickEval,
        selectedQuery
      );

      // Create QueryWithResults object
      const queryInfo = createResult(
        queryInitInfo.query,
        databaseItem,
        queryInitInfo.historyItemOptions,
        messages.QueryResultType.OOM
      );

      // Add query to history item view
      const runningQueryInfo: CompletedQuery = qhm.buildCompletedQuery(queryInfo);
      qhm.addCompletedQuery(runningQueryInfo);

      // Compile Query
      const results: QueryWithResults = await compileAndRunInitializedQueryAgainstDatabase(
        cliServer,
        qs,
        databaseItem,
        quickEval,
        progress,
        token,
        queryInitInfo.query,
        queryInitInfo.historyItemOptions,
        queryInitInfo.availableMlModels
      );

      const completeQuery = qhm.buildCompletedQuery(results);
      qhm.updateQueryWithResults(completeQuery);
      await showResultsForCompletedQuery(runningQueryInfo, WebviewReveal.NotForced);
    }
  }

  const qhelpTmpDir = tmp.dirSync({ prefix: 'qhelp_', keep: false, unsafeCleanup: true });
  ctx.subscriptions.push({ dispose: qhelpTmpDir.removeCallback });

  async function previewQueryHelp(
    selectedQuery: Uri
  ): Promise<void> {
    // selectedQuery is unpopulated when executing through the command palette
    const pathToQhelp = selectedQuery ? selectedQuery.fsPath : window.activeTextEditor?.document.uri.fsPath;
    if (pathToQhelp) {
      // Create temporary directory
      const relativePathToMd = path.basename(pathToQhelp, '.qhelp') + '.md';
      const absolutePathToMd = path.join(qhelpTmpDir.name, relativePathToMd);
      const uri = Uri.file(absolutePathToMd);
      try {
        await cliServer.generateQueryHelp(pathToQhelp, absolutePathToMd);
        await commands.executeCommand('markdown.showPreviewToSide', uri);
      } catch (err) {
        const errorMessage = err.message.includes('Generating qhelp in markdown') ? (
          `Could not generate markdown from ${pathToQhelp}: Bad formatting in .qhelp file.`
        ) : `Could not open a preview of the generated file (${absolutePathToMd}).`;
        void helpers.showAndLogErrorMessage(errorMessage, { fullMessage: `${errorMessage}\n${err}` });
      }
    }

  }

  async function openReferencedFile(
    selectedQuery: Uri
  ): Promise<void> {
    // If no file is selected, the path of the file in the editor is selected
    const path = selectedQuery?.fsPath || window.activeTextEditor?.document.uri.fsPath;
    if (qs !== undefined && path) {
      if (await cliServer.cliConstraints.supportsResolveQlref()) {
        const resolved = await cliServer.resolveQlref(path);
        const uri = Uri.file(resolved.resolvedPath);
        await window.showTextDocument(uri, { preview: false });
      } else {
        void helpers.showAndLogErrorMessage(
          'Jumping from a .qlref file to the .ql file it references is not '
          + 'supported with the CLI version you are running.\n'
          + `Please upgrade your CLI to version ${CliVersionConstraint.CLI_VERSION_WITH_RESOLVE_QLREF
          } or later to use this feature.`);
      }
    }
  }

  ctx.subscriptions.push(tmpDirDisposal);

  void logger.log('Initializing CodeQL language server.');
  const client = new LanguageClient(
    'CodeQL Language Server',
    () => spawnIdeServer(qlConfigurationListener),
    {
      documentSelector: [
        { language: 'ql', scheme: 'file' },
        { language: 'yaml', scheme: 'file', pattern: '**/qlpack.yml' },
      ],
      synchronize: {
        configurationSection: 'codeQL',
      },
      // Ensure that language server exceptions are logged to the same channel as its output.
      outputChannel: ideServerLogger.outputChannel,
    },
    true
  );

  void logger.log('Initializing QLTest interface.');
  const testExplorerExtension = extensions.getExtension<TestHub>(
    testExplorerExtensionId
  );
  if (testExplorerExtension) {
    const testHub = testExplorerExtension.exports;
    const testAdapterFactory = new QLTestAdapterFactory(testHub, cliServer, dbm);
    ctx.subscriptions.push(testAdapterFactory);

    const testUIService = new TestUIService(testHub);
    ctx.subscriptions.push(testUIService);
  }

  void logger.log('Registering top-level command palette commands.');
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      'codeQL.runQuery',
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri | undefined
      ) => await compileAndRunQuery(false, uri, progress, token, undefined),
      {
        title: 'Running query',
        cancellable: true
      }
    )
  );
  interface DatabaseQuickPickItem extends QuickPickItem {
    databaseItem: DatabaseItem;
  }
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      'codeQL.runQueryOnMultipleDatabases',
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri | undefined
      ) => {
        let filteredDBs = dbm.databaseItems;
        if (filteredDBs.length === 0) {
          void helpers.showAndLogErrorMessage('No databases found. Please add a suitable database to your workspace.');
          return;
        }
        // If possible, only show databases with the right language (otherwise show all databases).
        const queryLanguage = await helpers.findLanguage(cliServer, uri);
        if (queryLanguage) {
          filteredDBs = dbm.databaseItems.filter(db => db.language === queryLanguage);
          if (filteredDBs.length === 0) {
            void helpers.showAndLogErrorMessage(`No databases found for language ${queryLanguage}. Please add a suitable database to your workspace.`);
            return;
          }
        }
        const quickPickItems = filteredDBs.map<DatabaseQuickPickItem>(dbItem => (
          {
            databaseItem: dbItem,
            label: dbItem.name,
            description: dbItem.language,
          }
        ));
        /**
         * Databases that were selected in the quick pick menu.
         */
        const quickpick = await window.showQuickPick<DatabaseQuickPickItem>(
          quickPickItems,
          { canPickMany: true, ignoreFocusOut: true }
        );
        if (quickpick !== undefined) {
          // Collect all skipped databases and display them at the end (instead of popping up individual errors)
          const skippedDatabases = [];
          const errors = [];
          for (const item of quickpick) {
            try {
              await compileAndRunQuery(false, uri, progress, token, item.databaseItem);
            } catch (error) {
              skippedDatabases.push(item.label);
              errors.push(error.message);
            }
          }
          if (skippedDatabases.length > 0) {
            void logger.log(`Errors:\n${errors.join('\n')}`);
            void helpers.showAndLogWarningMessage(
              `The following databases were skipped:\n${skippedDatabases.join('\n')}.\nFor details about the errors, see the logs.`
            );
          }
        } else {
          void helpers.showAndLogErrorMessage('No databases selected.');
        }
      },
      {
        title: 'Running query on selected databases',
        cancellable: true
      }
    )
  );
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      'codeQL.runQueries',
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        _: Uri | undefined,
        multi: Uri[]
      ) => {
        const maxQueryCount = MAX_QUERIES.getValue() as number;
        const [files, dirFound] = await gatherQlFiles(multi.map(uri => uri.fsPath));
        if (files.length > maxQueryCount) {
          throw new Error(`You tried to run ${files.length} queries, but the maximum is ${maxQueryCount}. Try selecting fewer queries or changing the 'codeQL.runningQueries.maxQueries' setting.`);
        }
        // warn user and display selected files when a directory is selected because some ql
        // files may be hidden from the user.
        if (dirFound) {
          const fileString = files.map(file => path.basename(file)).join(', ');
          const res = await helpers.showBinaryChoiceDialog(
            `You are about to run ${files.length} queries: ${fileString} Do you want to continue?`
          );
          if (!res) {
            return;
          }
        }
        const queryUris = files.map(path => Uri.parse(`file:${path}`, true));

        // Use a wrapped progress so that messages appear with the queries remaining in it.
        let queriesRemaining = queryUris.length;
        function wrappedProgress(update: ProgressUpdate) {
          const message = queriesRemaining > 1
            ? `${queriesRemaining} remaining. ${update.message}`
            : update.message;
          progress({
            ...update,
            message
          });
        }

        if (queryUris.length > 1) {
          // Try to upgrade the current database before running any queries
          // so that the user isn't confronted with multiple upgrade
          // requests for each query to run.
          // Only do it if running multiple queries since this check is
          // performed on each query run anyway.
          await databaseUI.tryUpgradeCurrentDatabase(progress, token);
        }

        wrappedProgress({
          maxStep: queryUris.length,
          step: queryUris.length - queriesRemaining,
          message: ''
        });

        await Promise.all(queryUris.map(async uri =>
          compileAndRunQuery(false, uri, wrappedProgress, token, undefined)
            .then(() => queriesRemaining--)
        ));
      },
      {
        title: 'Running queries',
        cancellable: true
      })
  );
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      'codeQL.quickEval',
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri | undefined
      ) => await compileAndRunQuery(true, uri, progress, token, undefined),
      {
        title: 'Running query',
        cancellable: true
      })
  );
  ctx.subscriptions.push(
    commandRunnerWithProgress('codeQL.quickQuery', async (
      progress: ProgressCallback,
      token: CancellationToken
    ) =>
      displayQuickQuery(ctx, cliServer, databaseUI, progress, token),
      {
        title: 'Run Quick Query'
      }
    )
  );

  void logger.log('Initializing remote queries panel interface.');
  const rmpm = new RemoteQueriesInterfaceManager(
    ctx,
    logger
  );
  ctx.subscriptions.push(rmpm);

  // The "runRemoteQuery" command is internal-only.
  ctx.subscriptions.push(
    commandRunnerWithProgress('codeQL.runRemoteQuery', async (
      progress: ProgressCallback,
      token: CancellationToken,
      uri: Uri | undefined
    ) => {
      if (isCanary()) {
        progress({
          maxStep: 5,
          step: 0,
          message: 'Getting credentials'
        });
        const credentials = await Credentials.initialize(ctx);
        await runRemoteQuery(cliServer, credentials, uri || window.activeTextEditor?.document.uri, false, progress, token);
      } else {
        throw new Error('Remote queries require the CodeQL Canary version to run.');
      }
    }, {
      title: 'Run Remote Query',
      cancellable: true
    })
  );
  ctx.subscriptions.push(
    commandRunner(
      'codeQL.openReferencedFile',
      openReferencedFile
    )
  );

  ctx.subscriptions.push(
    commandRunner(
      'codeQL.previewQueryHelp',
      previewQueryHelp
    )
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress('codeQL.restartQueryServer', async (
      progress: ProgressCallback,
      token: CancellationToken
    ) => {
      await qs.restartQueryServer(progress, token);
      void helpers.showAndLogInformationMessage('CodeQL Query Server restarted.', {
        outputLogger: queryServerLogger,
      });
    }, {
      title: 'Restarting Query Server'
    })
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress('codeQL.chooseDatabaseFolder', (
      progress: ProgressCallback,
      token: CancellationToken
    ) =>
      databaseUI.handleChooseDatabaseFolder(progress, token), {
      title: 'Choose a Database from a Folder'
    })
  );
  ctx.subscriptions.push(
    commandRunnerWithProgress('codeQL.chooseDatabaseArchive', (
      progress: ProgressCallback,
      token: CancellationToken
    ) =>
      databaseUI.handleChooseDatabaseArchive(progress, token), {
      title: 'Choose a Database from an Archive'
    })
  );
  ctx.subscriptions.push(
    commandRunnerWithProgress('codeQL.chooseDatabaseLgtm', (
      progress: ProgressCallback,
      token: CancellationToken
    ) =>
      databaseUI.handleChooseDatabaseLgtm(progress, token),
      {
        title: 'Adding database from LGTM',
      })
  );
  ctx.subscriptions.push(
    commandRunnerWithProgress('codeQL.chooseDatabaseInternet', (
      progress: ProgressCallback,
      token: CancellationToken
    ) =>
      databaseUI.handleChooseDatabaseInternet(progress, token),

      {
        title: 'Adding database from URL',
      })
  );

  ctx.subscriptions.push(
    commandRunner('codeQL.openDocumentation', async () =>
      env.openExternal(Uri.parse('https://codeql.github.com/docs/'))));

  ctx.subscriptions.push(
    commandRunner('codeQL.copyVersion', async () => {
      const text = `CodeQL extension version: ${extension?.packageJSON.version} \nCodeQL CLI version: ${await getCliVersion()} \nPlatform: ${os.platform()} ${os.arch()}`;
      await env.clipboard.writeText(text);
      void helpers.showAndLogInformationMessage(text);
    }));

  const getCliVersion = async () => {
    try {
      return await cliServer.getVersion();
    } catch {
      return '<missing>';
    }
  };

  // The "authenticateToGitHub" command is internal-only.
  ctx.subscriptions.push(
    commandRunner('codeQL.authenticateToGitHub', async () => {
      if (isCanary()) {
        /**
         * Credentials for authenticating to GitHub.
         * These are used when making API calls.
         */
        const credentials = await Credentials.initialize(ctx);
        const octokit = await credentials.getOctokit();
        const userInfo = await octokit.users.getAuthenticated();
        void helpers.showAndLogInformationMessage(`Authenticated to GitHub as user: ${userInfo.data.login}`);
      }
    }));

  commands.registerCommand('codeQL.showLogs', () => {
    logger.show();
  });

  void logger.log('Starting language server.');
  ctx.subscriptions.push(client.start());

  // Jump-to-definition and find-references
  void logger.log('Registering jump-to-definition handlers.');
  languages.registerDefinitionProvider(
    { scheme: archiveFilesystemProvider.zipArchiveScheme },
    new TemplateQueryDefinitionProvider(cliServer, qs, dbm)
  );

  languages.registerReferenceProvider(
    { scheme: archiveFilesystemProvider.zipArchiveScheme },
    new TemplateQueryReferenceProvider(cliServer, qs, dbm)
  );

  const astViewer = new AstViewer();
  const templateProvider = new TemplatePrintAstProvider(cliServer, qs, dbm);

  ctx.subscriptions.push(astViewer);
  ctx.subscriptions.push(commandRunnerWithProgress('codeQL.viewAst', async (
    progress: ProgressCallback,
    token: CancellationToken
  ) => {
    const ast = await templateProvider.provideAst(
      progress,
      token,
      window.activeTextEditor?.document,
    );
    if (ast) {
      astViewer.updateRoots(await ast.getRoots(), ast.db, ast.fileName);
    }
  }, {
    cancellable: true,
    title: 'Calculate AST'
  }));

  await commands.executeCommand('codeQLDatabases.removeOrphanedDatabases');

  void logger.log('Successfully finished extension initialization.');

  return {
    ctx,
    cliServer,
    qs,
    distributionManager,
    databaseManager: dbm,
    databaseUI,
    dispose: () => {
      ctx.subscriptions.forEach(d => d.dispose());
    }
  };
}

function getContextStoragePath(ctx: ExtensionContext) {
  return ctx.storagePath || ctx.globalStoragePath;
}

async function initializeLogging(ctx: ExtensionContext): Promise<void> {
  const storagePath = getContextStoragePath(ctx);
  await logger.setLogStoragePath(storagePath, false);
  await ideServerLogger.setLogStoragePath(storagePath, false);
  ctx.subscriptions.push(logger);
  ctx.subscriptions.push(queryServerLogger);
  ctx.subscriptions.push(ideServerLogger);
}

const checkForUpdatesCommand = 'codeQL.checkForUpdatesToCLI';

