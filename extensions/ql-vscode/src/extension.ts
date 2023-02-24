import "source-map-support/register";
import {
  CancellationToken,
  CancellationTokenSource,
  commands,
  Disposable,
  env,
  ExtensionContext,
  extensions,
  languages,
  ProgressLocation,
  ProgressOptions,
  QuickPickItem,
  Range,
  Uri,
  version as vscodeVersion,
  window as Window,
  window,
  workspace,
} from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { arch, platform } from "os";
import { ensureDir } from "fs-extra";
import { basename, join } from "path";
import { dirSync } from "tmp-promise";
import { testExplorerExtensionId, TestHub } from "vscode-test-adapter-api";
import { lt, parse } from "semver";

import { AstViewer } from "./astViewer";
import {
  activate as archiveFilesystemProvider_activate,
  zipArchiveScheme,
} from "./archive-filesystem-provider";
import QuickEvalCodeLensProvider from "./quickEvalCodeLensProvider";
import { CodeQLCliServer } from "./cli";
import {
  CliConfigListener,
  DistributionConfigListener,
  isCanary,
  joinOrderWarningThreshold,
  MAX_QUERIES,
  QueryHistoryConfigListener,
  QueryServerConfigListener,
} from "./config";
import { install } from "./languageSupport";
import { DatabaseItem, DatabaseManager } from "./local-databases";
import { DatabaseUI } from "./local-databases-ui";
import {
  TemplatePrintAstProvider,
  TemplatePrintCfgProvider,
  TemplateQueryDefinitionProvider,
  TemplateQueryReferenceProvider,
} from "./contextual/templateProvider";
import {
  DEFAULT_DISTRIBUTION_VERSION_RANGE,
  DistributionKind,
  DistributionManager,
  DistributionUpdateCheckResultKind,
  FindDistributionResult,
  FindDistributionResultKind,
  GithubApiError,
  GithubRateLimitedError,
} from "./distribution";
import {
  findLanguage,
  showAndLogErrorMessage,
  showAndLogExceptionWithTelemetry,
  showAndLogInformationMessage,
  showAndLogWarningMessage,
  showBinaryChoiceDialog,
  showInformationMessageWithAction,
  tmpDir,
  tmpDirDisposal,
} from "./helpers";
import { asError, assertNever, getErrorMessage } from "./pure/helpers-pure";
import { spawnIdeServer } from "./ide-server";
import { ResultsView } from "./interface";
import { WebviewReveal } from "./interface-utils";
import {
  extLogger,
  ideServerLogger,
  ProgressReporter,
  queryServerLogger,
} from "./common";
import { QueryHistoryManager } from "./query-history/query-history-manager";
import { CompletedLocalQueryInfo, LocalQueryInfo } from "./query-results";
import { QueryServerClient as LegacyQueryServerClient } from "./legacy-query-server/queryserver-client";
import { QueryServerClient } from "./query-server/queryserver-client";
import { displayQuickQuery } from "./quick-query";
import { QLTestAdapterFactory } from "./test-adapter";
import { TestUIService } from "./test-ui";
import { CompareView } from "./compare/compare-view";
import { gatherQlFiles } from "./pure/files";
import { initializeTelemetry } from "./telemetry";
import {
  commandRunner,
  commandRunnerWithProgress,
  ProgressCallback,
  ProgressUpdate,
  withProgress,
} from "./commandRunner";
import { CodeQlStatusBarHandler } from "./status-bar";
import {
  handleDownloadPacks,
  handleInstallPackDependencies,
} from "./packaging";
import { HistoryItemLabelProvider } from "./query-history/history-item-label-provider";
import {
  exportSelectedVariantAnalysisResults,
  exportVariantAnalysisResults,
} from "./variant-analysis/export-results";
import { EvalLogViewer } from "./eval-log-viewer";
import { SummaryLanguageSupport } from "./log-insights/summary-language-support";
import { JoinOrderScannerProvider } from "./log-insights/join-order";
import { LogScannerService } from "./log-insights/log-scanner-service";
import { createInitialQueryInfo } from "./run-queries-shared";
import { LegacyQueryRunner } from "./legacy-query-server/legacyRunner";
import { NewQueryRunner } from "./query-server/query-runner";
import { QueryRunner } from "./queryRunner";
import { VariantAnalysisView } from "./variant-analysis/variant-analysis-view";
import { VariantAnalysisViewSerializer } from "./variant-analysis/variant-analysis-view-serializer";
import {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
} from "./variant-analysis/shared/variant-analysis";
import { VariantAnalysisManager } from "./variant-analysis/variant-analysis-manager";
import { createVariantAnalysisContentProvider } from "./variant-analysis/variant-analysis-content-provider";
import { VSCodeMockGitHubApiServer } from "./mocks/vscode-mock-gh-api-server";
import { VariantAnalysisResultsManager } from "./variant-analysis/variant-analysis-results-manager";
import { ExtensionApp } from "./common/vscode/vscode-app";
import { RepositoriesFilterSortStateWithIds } from "./pure/variant-analysis-filter-sort";
import { DbModule } from "./databases/db-module";
import { redactableError } from "./pure/errors";

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

const extensionId = "GitHub.vscode-codeql";
const extension = extensions.getExtension(extensionId);

/**
 * If the user tries to execute vscode commands after extension activation is failed, give
 * a sensible error message.
 *
 * @param excludedCommands List of commands for which we should not register error stubs.
 */
function registerErrorStubs(
  excludedCommands: string[],
  stubGenerator: (command: string) => () => Promise<void>,
): void {
  // Remove existing stubs
  errorStubs.forEach((stub) => stub.dispose());

  if (extension === undefined) {
    throw new Error(`Can't find extension ${extensionId}`);
  }

  const stubbedCommands: string[] =
    extension.packageJSON.contributes.commands.map(
      (entry: { command: string }) => entry.command,
    );

  stubbedCommands.forEach((command) => {
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
  readonly qs: QueryRunner;
  readonly distributionManager: DistributionManager;
  readonly databaseManager: DatabaseManager;
  readonly databaseUI: DatabaseUI;
  readonly variantAnalysisManager: VariantAnalysisManager;
  readonly dispose: () => void;
}

// This is the minimum version of vscode that we _want_ to support. We want to update the language server library, but that
// requires 1.67 or later. If we change the minimum version in the package.json, then anyone on an older version of vscode
// silently be unable to upgrade. So, the solution is to first bump the minimum version here and release. Then
// bump the version in the package.json and release again. This way, anyone on an older version of vscode will get a warning
// before silently being refused to upgrade.
const MIN_VERSION = "1.67.0";

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
export async function activate(
  ctx: ExtensionContext,
): Promise<CodeQLExtensionInterface | Record<string, never>> {
  void extLogger.log(`Starting ${extensionId} extension`);
  if (extension === undefined) {
    throw new Error(`Can't find extension ${extensionId}`);
  }

  const distributionConfigListener = new DistributionConfigListener();
  await initializeLogging(ctx);
  await initializeTelemetry(extension, ctx);
  addUnhandledRejectionListener();
  install();

  const codelensProvider = new QuickEvalCodeLensProvider();
  languages.registerCodeLensProvider(
    { scheme: "file", language: "ql" },
    codelensProvider,
  );

  ctx.subscriptions.push(distributionConfigListener);
  const codeQlVersionRange = DEFAULT_DISTRIBUTION_VERSION_RANGE;
  const distributionManager = new DistributionManager(
    distributionConfigListener,
    codeQlVersionRange,
    ctx,
  );

  const shouldUpdateOnNextActivationKey = "shouldUpdateOnNextActivation";

  registerErrorStubs([checkForUpdatesCommand], (command) => async () => {
    void showAndLogErrorMessage(
      `Can't execute ${command}: waiting to finish loading CodeQL CLI.`,
    );
  });

  // Checking the vscode version should not block extension activation.
  void assertVSCodeVersionGreaterThan(MIN_VERSION, ctx);

  interface DistributionUpdateConfig {
    isUserInitiated: boolean;
    shouldDisplayMessageWhenNoUpdates: boolean;
    allowAutoUpdating: boolean;
  }

  async function installOrUpdateDistributionWithProgressTitle(
    progressTitle: string,
    config: DistributionUpdateConfig,
  ): Promise<void> {
    const minSecondsSinceLastUpdateCheck = config.isUserInitiated ? 0 : 86400;
    const noUpdatesLoggingFunc = config.shouldDisplayMessageWhenNoUpdates
      ? showAndLogInformationMessage
      : async (message: string) => void extLogger.log(message);
    const result =
      await distributionManager.checkForUpdatesToExtensionManagedDistribution(
        minSecondsSinceLastUpdateCheck,
      );

    // We do want to auto update if there is no distribution at all
    const allowAutoUpdating =
      config.allowAutoUpdating ||
      !(await distributionManager.hasDistribution());

    switch (result.kind) {
      case DistributionUpdateCheckResultKind.AlreadyCheckedRecentlyResult:
        void extLogger.log(
          "Didn't perform CodeQL CLI update check since a check was already performed within the previous " +
            `${minSecondsSinceLastUpdateCheck} seconds.`,
        );
        break;
      case DistributionUpdateCheckResultKind.AlreadyUpToDate:
        await noUpdatesLoggingFunc("CodeQL CLI already up to date.");
        break;
      case DistributionUpdateCheckResultKind.InvalidLocation:
        await noUpdatesLoggingFunc(
          "CodeQL CLI is installed externally so could not be updated.",
        );
        break;
      case DistributionUpdateCheckResultKind.UpdateAvailable:
        if (beganMainExtensionActivation || !allowAutoUpdating) {
          const updateAvailableMessage =
            `Version "${result.updatedRelease.name}" of the CodeQL CLI is now available. ` +
            "Do you wish to upgrade?";
          await ctx.globalState.update(shouldUpdateOnNextActivationKey, true);
          if (
            await showInformationMessageWithAction(
              updateAvailableMessage,
              "Restart and Upgrade",
            )
          ) {
            await commands.executeCommand("workbench.action.reloadWindow");
          }
        } else {
          const progressOptions: ProgressOptions = {
            title: progressTitle,
            location: ProgressLocation.Notification,
          };

          await withProgress(progressOptions, (progress) =>
            distributionManager.installExtensionManagedDistributionRelease(
              result.updatedRelease,
              progress,
            ),
          );

          await ctx.globalState.update(shouldUpdateOnNextActivationKey, false);
          void showAndLogInformationMessage(
            `CodeQL CLI updated to version "${result.updatedRelease.name}".`,
          );
        }
        break;
      default:
        assertNever(result);
    }
  }

  async function installOrUpdateDistribution(
    config: DistributionUpdateConfig,
  ): Promise<void> {
    if (isInstallingOrUpdatingDistribution) {
      throw new Error("Already installing or updating CodeQL CLI");
    }
    isInstallingOrUpdatingDistribution = true;
    const codeQlInstalled =
      (await distributionManager.getCodeQlPathWithoutVersionCheck()) !==
      undefined;
    const willUpdateCodeQl = ctx.globalState.get(
      shouldUpdateOnNextActivationKey,
    );
    const messageText = willUpdateCodeQl
      ? "Updating CodeQL CLI"
      : codeQlInstalled
      ? "Checking for updates to CodeQL CLI"
      : "Installing CodeQL CLI";

    try {
      await installOrUpdateDistributionWithProgressTitle(messageText, config);
    } catch (e) {
      // Don't rethrow the exception, because if the config is changed, we want to be able to retry installing
      // or updating the distribution.
      const alertFunction =
        codeQlInstalled && !config.isUserInitiated
          ? showAndLogWarningMessage
          : showAndLogErrorMessage;
      const taskDescription = `${
        willUpdateCodeQl
          ? "update"
          : codeQlInstalled
          ? "check for updates to"
          : "install"
      } CodeQL CLI`;

      if (e instanceof GithubRateLimitedError) {
        void alertFunction(
          `Rate limited while trying to ${taskDescription}. Please try again after ` +
            `your rate limit window resets at ${e.rateLimitResetDate.toLocaleString(
              env.language,
            )}.`,
        );
      } else if (e instanceof GithubApiError) {
        void alertFunction(
          `Encountered GitHub API error while trying to ${taskDescription}. ${e}`,
        );
      }
      void alertFunction(`Unable to ${taskDescription}. ${e}`);
    } finally {
      isInstallingOrUpdatingDistribution = false;
    }
  }

  async function getDistributionDisplayingDistributionWarnings(): Promise<FindDistributionResult> {
    const result = await distributionManager.getDistribution();
    switch (result.kind) {
      case FindDistributionResultKind.CompatibleDistribution:
        void extLogger.log(
          `Found compatible version of CodeQL CLI (version ${result.version.raw})`,
        );
        break;
      case FindDistributionResultKind.IncompatibleDistribution: {
        const fixGuidanceMessage = (() => {
          switch (result.distribution.kind) {
            case DistributionKind.ExtensionManaged:
              return 'Please update the CodeQL CLI by running the "CodeQL: Check for CLI Updates" command.';
            case DistributionKind.CustomPathConfig:
              return `Please update the \"CodeQL CLI Executable Path\" setting to point to a CLI in the version range ${codeQlVersionRange}.`;
            case DistributionKind.PathEnvironmentVariable:
              return (
                `Please update the CodeQL CLI on your PATH to a version compatible with ${codeQlVersionRange}, or ` +
                `set the \"CodeQL CLI Executable Path\" setting to the path of a CLI version compatible with ${codeQlVersionRange}.`
              );
          }
        })();

        void showAndLogWarningMessage(
          `The current version of the CodeQL CLI (${result.version.raw}) ` +
            `is incompatible with this extension. ${fixGuidanceMessage}`,
        );
        break;
      }
      case FindDistributionResultKind.UnknownCompatibilityDistribution:
        void showAndLogWarningMessage(
          "Compatibility with the configured CodeQL CLI could not be determined. " +
            "You may experience problems using the extension.",
        );
        break;
      case FindDistributionResultKind.NoDistribution:
        void showAndLogErrorMessage("The CodeQL CLI could not be found.");
        break;
      default:
        assertNever(result);
    }
    return result;
  }

  async function installOrUpdateThenTryActivate(
    config: DistributionUpdateConfig,
  ): Promise<CodeQLExtensionInterface | Record<string, never>> {
    await installOrUpdateDistribution(config);

    // Display the warnings even if the extension has already activated.
    const distributionResult =
      await getDistributionDisplayingDistributionWarnings();
    let extensionInterface: CodeQLExtensionInterface | Record<string, never> =
      {};
    if (
      !beganMainExtensionActivation &&
      distributionResult.kind !== FindDistributionResultKind.NoDistribution
    ) {
      extensionInterface = await activateWithInstalledDistribution(
        ctx,
        distributionManager,
        distributionConfigListener,
      );
    } else if (
      distributionResult.kind === FindDistributionResultKind.NoDistribution
    ) {
      registerErrorStubs([checkForUpdatesCommand], (command) => async () => {
        const installActionName = "Install CodeQL CLI";
        const chosenAction = await showAndLogErrorMessage(
          `Can't execute ${command}: missing CodeQL CLI.`,
          {
            items: [installActionName],
          },
        );
        if (chosenAction === installActionName) {
          await installOrUpdateThenTryActivate({
            isUserInitiated: true,
            shouldDisplayMessageWhenNoUpdates: false,
            allowAutoUpdating: true,
          });
        }
      });
    }
    return extensionInterface;
  }

  ctx.subscriptions.push(
    distributionConfigListener.onDidChangeConfiguration(() =>
      installOrUpdateThenTryActivate({
        isUserInitiated: true,
        shouldDisplayMessageWhenNoUpdates: false,
        allowAutoUpdating: true,
      }),
    ),
  );
  ctx.subscriptions.push(
    commandRunner(checkForUpdatesCommand, () =>
      installOrUpdateThenTryActivate({
        isUserInitiated: true,
        shouldDisplayMessageWhenNoUpdates: true,
        allowAutoUpdating: true,
      }),
    ),
  );

  const variantAnalysisViewSerializer = new VariantAnalysisViewSerializer(ctx);
  Window.registerWebviewPanelSerializer(
    VariantAnalysisView.viewType,
    variantAnalysisViewSerializer,
  );

  const codeQlExtension = await installOrUpdateThenTryActivate({
    isUserInitiated: !!ctx.globalState.get(shouldUpdateOnNextActivationKey),
    shouldDisplayMessageWhenNoUpdates: false,

    // only auto update on startup if the user has previously requested an update
    // otherwise, ask user to accept the update
    allowAutoUpdating: !!ctx.globalState.get(shouldUpdateOnNextActivationKey),
  });

  variantAnalysisViewSerializer.onExtensionLoaded(
    codeQlExtension.variantAnalysisManager,
  );

  return codeQlExtension;
}

const PACK_GLOBS = [
  "**/codeql-pack.yml",
  "**/qlpack.yml",
  "**/queries.xml",
  "**/codeql-pack.lock.yml",
  "**/qlpack.lock.yml",
  ".codeqlmanifest.json",
  "codeql-workspace.yml",
];

async function activateWithInstalledDistribution(
  ctx: ExtensionContext,
  distributionManager: DistributionManager,
  distributionConfigListener: DistributionConfigListener,
): Promise<CodeQLExtensionInterface> {
  beganMainExtensionActivation = true;
  // Remove any error stubs command handlers left over from first part
  // of activation.
  errorStubs.forEach((stub) => stub.dispose());

  const app = new ExtensionApp(ctx);

  void extLogger.log("Initializing configuration listener...");
  const qlConfigurationListener =
    await QueryServerConfigListener.createQueryServerConfigListener(
      distributionManager,
    );
  ctx.subscriptions.push(qlConfigurationListener);

  void extLogger.log("Initializing CodeQL cli server...");
  const cliServer = new CodeQLCliServer(
    app,
    distributionManager,
    new CliConfigListener(),
    extLogger,
  );
  ctx.subscriptions.push(cliServer);

  const statusBar = new CodeQlStatusBarHandler(
    cliServer,
    distributionConfigListener,
  );
  ctx.subscriptions.push(statusBar);

  void extLogger.log("Initializing query server client.");
  const qs = await createQueryServer(qlConfigurationListener, cliServer, ctx);

  for (const glob of PACK_GLOBS) {
    const fsWatcher = workspace.createFileSystemWatcher(glob);
    ctx.subscriptions.push(fsWatcher);
    fsWatcher.onDidChange(async (_uri) => {
      await qs.clearPackCache();
    });
  }

  void extLogger.log("Initializing database manager.");
  const dbm = new DatabaseManager(ctx, qs, cliServer, extLogger);

  // Let this run async.
  void dbm.loadPersistedState();

  ctx.subscriptions.push(dbm);
  void extLogger.log("Initializing database panel.");
  const databaseUI = new DatabaseUI(
    app,
    dbm,
    qs,
    getContextStoragePath(ctx),
    ctx.extensionPath,
  );
  databaseUI.init();
  ctx.subscriptions.push(databaseUI);

  void extLogger.log("Initializing evaluator log viewer.");
  const evalLogViewer = new EvalLogViewer();
  ctx.subscriptions.push(evalLogViewer);

  void extLogger.log("Initializing query history manager.");
  const queryHistoryConfigurationListener = new QueryHistoryConfigListener();
  ctx.subscriptions.push(queryHistoryConfigurationListener);
  const showResults = async (item: CompletedLocalQueryInfo) =>
    showResultsForCompletedQuery(item, WebviewReveal.Forced);
  const queryStorageDir = join(ctx.globalStorageUri.fsPath, "queries");
  await ensureDir(queryStorageDir);
  const labelProvider = new HistoryItemLabelProvider(
    queryHistoryConfigurationListener,
  );

  void extLogger.log("Initializing results panel interface.");
  const localQueryResultsView = new ResultsView(
    ctx,
    dbm,
    cliServer,
    queryServerLogger,
    labelProvider,
  );
  ctx.subscriptions.push(localQueryResultsView);

  void extLogger.log("Initializing variant analysis manager.");

  const dbModule = await DbModule.initialize(app);

  const variantAnalysisStorageDir = join(
    ctx.globalStorageUri.fsPath,
    "variant-analyses",
  );
  await ensureDir(variantAnalysisStorageDir);
  const variantAnalysisResultsManager = new VariantAnalysisResultsManager(
    cliServer,
    extLogger,
  );

  const variantAnalysisManager = new VariantAnalysisManager(
    ctx,
    app,
    cliServer,
    variantAnalysisStorageDir,
    variantAnalysisResultsManager,
    dbModule?.dbManager,
  );
  ctx.subscriptions.push(variantAnalysisManager);
  ctx.subscriptions.push(variantAnalysisResultsManager);
  ctx.subscriptions.push(
    workspace.registerTextDocumentContentProvider(
      "codeql-variant-analysis",
      createVariantAnalysisContentProvider(variantAnalysisManager),
    ),
  );

  void extLogger.log("Initializing query history.");
  const qhm = new QueryHistoryManager(
    qs,
    dbm,
    localQueryResultsView,
    variantAnalysisManager,
    evalLogViewer,
    queryStorageDir,
    ctx,
    queryHistoryConfigurationListener,
    labelProvider,
    async (from: CompletedLocalQueryInfo, to: CompletedLocalQueryInfo) =>
      showResultsForComparison(from, to),
  );

  ctx.subscriptions.push(qhm);

  void extLogger.log("Initializing evaluation log scanners.");
  const logScannerService = new LogScannerService(qhm);
  ctx.subscriptions.push(logScannerService);
  ctx.subscriptions.push(
    logScannerService.scanners.registerLogScannerProvider(
      new JoinOrderScannerProvider(() => joinOrderWarningThreshold()),
    ),
  );

  void extLogger.log("Initializing compare view.");
  const compareView = new CompareView(
    ctx,
    dbm,
    cliServer,
    queryServerLogger,
    labelProvider,
    showResults,
  );
  ctx.subscriptions.push(compareView);

  void extLogger.log("Initializing source archive filesystem provider.");
  archiveFilesystemProvider_activate(ctx);

  async function showResultsForComparison(
    from: CompletedLocalQueryInfo,
    to: CompletedLocalQueryInfo,
  ): Promise<void> {
    try {
      await compareView.showResults(from, to);
    } catch (e) {
      void showAndLogExceptionWithTelemetry(
        redactableError(asError(e))`Failed to show results: ${getErrorMessage(
          e,
        )}`,
      );
    }
  }

  async function showResultsForCompletedQuery(
    query: CompletedLocalQueryInfo,
    forceReveal: WebviewReveal,
  ): Promise<void> {
    await localQueryResultsView.showResults(query, forceReveal, false);
  }

  async function compileAndRunQuery(
    quickEval: boolean,
    selectedQuery: Uri | undefined,
    progress: ProgressCallback,
    token: CancellationToken,
    databaseItem: DatabaseItem | undefined,
    range?: Range,
  ): Promise<void> {
    if (qs !== undefined) {
      // If no databaseItem is specified, use the database currently selected in the Databases UI
      databaseItem =
        databaseItem || (await databaseUI.getDatabaseItem(progress, token));
      if (databaseItem === undefined) {
        throw new Error("Can't run query without a selected database");
      }
      const databaseInfo = {
        name: databaseItem.name,
        databaseUri: databaseItem.databaseUri.toString(),
      };

      // handle cancellation from the history view.
      const source = new CancellationTokenSource();
      token.onCancellationRequested(() => source.cancel());

      const initialInfo = await createInitialQueryInfo(
        selectedQuery,
        databaseInfo,
        quickEval,
        range,
      );
      const item = new LocalQueryInfo(initialInfo, source);
      qhm.addQuery(item);
      try {
        const completedQueryInfo = await qs.compileAndRunQueryAgainstDatabase(
          databaseItem,
          initialInfo,
          queryStorageDir,
          progress,
          source.token,
          undefined,
          item,
        );
        qhm.completeQuery(item, completedQueryInfo);
        await showResultsForCompletedQuery(
          item as CompletedLocalQueryInfo,
          WebviewReveal.Forced,
        );
        // Note we must update the query history view after showing results as the
        // display and sorting might depend on the number of results
      } catch (e) {
        const err = asError(e);
        err.message = `Error running query: ${err.message}`;
        item.failureReason = err.message;
        throw e;
      } finally {
        await qhm.refreshTreeView();
        source.dispose();
      }
    }
  }

  async function runPerformanceQueryOnDB(
    inputPath: Uri,
    dbPath: Uri,
    bqrsPath: Uri,
    csvOut: Uri,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> {
    // handle cancellation from the history view.
    const source = new CancellationTokenSource();
    token.onCancellationRequested(() => source.cancel());

    function wrappedProgress(update: ProgressUpdate) {
      const message = update.message;
      progress({
        ...update,
        message,
      });
    }

    wrappedProgress({
      maxStep: 2,
      step: 1,
      message: "Preparing to run performance query on database...",
    });

    try {
      await qs.cliServer.runPerformanceQueryOnDB(
        inputPath.toString(),
        dbPath.toString(),
        bqrsPath.toString(),
        csvOut.toString(),
      );

      wrappedProgress({
        maxStep: 2,
        step: 2,
        message: "Finished",
      });
    } catch (e) {
      const err = asError(e);
      err.message = `Error running performance queries: ${err.message}`;
      throw e;
    } finally {
      await qhm.refreshTreeView();
      source.dispose();
    }
  }

  async function buildQueryPerformanceDataDatabase(
    inputDirectory: Uri,
    outputDirectory: Uri,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> {
    // handle cancellation from the history view.
    const source = new CancellationTokenSource();
    token.onCancellationRequested(() => source.cancel());

    function wrappedProgress(update: ProgressUpdate) {
      const message = update.message;
      progress({
        ...update,
        message,
      });
    }

    wrappedProgress({
      maxStep: 2,
      step: 1,
      message: "Preparing to build database...",
    });

    // convert the evaluator log via `codeql generate log-summary in.jsonl out.json`
    try {
      await qs.cliServer.compileQLForQLDatabase(
        inputDirectory.toString(),
        outputDirectory.toString(),
      );

      wrappedProgress({
        maxStep: 2,
        step: 2,
        message: "Finished",
      });
    } catch (e) {
      const err = asError(e);
      err.message = `Error building performance database: ${err.message}`;
      throw e;
    } finally {
      await qhm.refreshTreeView();
      source.dispose();
    }
  }

  const qhelpTmpDir = dirSync({
    prefix: "qhelp_",
    keep: false,
    unsafeCleanup: true,
  });
  ctx.subscriptions.push({ dispose: qhelpTmpDir.removeCallback });

  async function previewQueryHelp(selectedQuery: Uri): Promise<void> {
    // selectedQuery is unpopulated when executing through the command palette
    const pathToQhelp = selectedQuery
      ? selectedQuery.fsPath
      : window.activeTextEditor?.document.uri.fsPath;
    if (pathToQhelp) {
      // Create temporary directory
      const relativePathToMd = `${basename(pathToQhelp, ".qhelp")}.md`;
      const absolutePathToMd = join(qhelpTmpDir.name, relativePathToMd);
      const uri = Uri.file(absolutePathToMd);
      try {
        await cliServer.generateQueryHelp(pathToQhelp, absolutePathToMd);
        await commands.executeCommand("markdown.showPreviewToSide", uri);
      } catch (e) {
        const errorMessage = getErrorMessage(e).includes(
          "Generating qhelp in markdown",
        )
          ? redactableError`Could not generate markdown from ${pathToQhelp}: Bad formatting in .qhelp file.`
          : redactableError`Could not open a preview of the generated file (${absolutePathToMd}).`;
        void showAndLogExceptionWithTelemetry(errorMessage, {
          fullMessage: `${errorMessage}\n${getErrorMessage(e)}`,
        });
      }
    }
  }

  async function openReferencedFile(selectedQuery: Uri): Promise<void> {
    // If no file is selected, the path of the file in the editor is selected
    const path =
      selectedQuery?.fsPath || window.activeTextEditor?.document.uri.fsPath;
    if (qs !== undefined && path) {
      const resolved = await cliServer.resolveQlref(path);
      const uri = Uri.file(resolved.resolvedPath);
      await window.showTextDocument(uri, { preview: false });
    }
  }

  ctx.subscriptions.push(tmpDirDisposal);

  void extLogger.log("Initializing CodeQL language server.");
  const client = new LanguageClient(
    "CodeQL Language Server",
    () => spawnIdeServer(qlConfigurationListener),
    {
      documentSelector: [
        { language: "ql", scheme: "file" },
        { language: "yaml", scheme: "file", pattern: "**/qlpack.yml" },
        { language: "yaml", scheme: "file", pattern: "**/codeql-pack.yml" },
      ],
      synchronize: {
        configurationSection: "codeQL",
      },
      // Ensure that language server exceptions are logged to the same channel as its output.
      outputChannel: ideServerLogger.outputChannel,
    },
    true,
  );

  void extLogger.log("Initializing QLTest interface.");
  const testExplorerExtension = extensions.getExtension<TestHub>(
    testExplorerExtensionId,
  );
  if (testExplorerExtension) {
    const testHub = testExplorerExtension.exports;
    const testAdapterFactory = new QLTestAdapterFactory(
      testHub,
      cliServer,
      dbm,
    );
    ctx.subscriptions.push(testAdapterFactory);

    const testUIService = new TestUIService(testHub);
    ctx.subscriptions.push(testUIService);
  }

  void extLogger.log("Registering top-level command palette commands.");
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.runQuery",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri | undefined,
      ) => await compileAndRunQuery(false, uri, progress, token, undefined),
      {
        title: "Running query",
        cancellable: true,
      },

      // Open the query server logger on error since that's usually where the interesting errors appear.
      queryServerLogger,
    ),
  );
  interface DatabaseQuickPickItem extends QuickPickItem {
    databaseItem: DatabaseItem;
  }
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.runQueryOnMultipleDatabases",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri | undefined,
      ) => {
        let filteredDBs = dbm.databaseItems;
        if (filteredDBs.length === 0) {
          void showAndLogErrorMessage(
            "No databases found. Please add a suitable database to your workspace.",
          );
          return;
        }
        // If possible, only show databases with the right language (otherwise show all databases).
        const queryLanguage = await findLanguage(cliServer, uri);
        if (queryLanguage) {
          filteredDBs = dbm.databaseItems.filter(
            (db) => db.language === queryLanguage,
          );
          if (filteredDBs.length === 0) {
            void showAndLogErrorMessage(
              `No databases found for language ${queryLanguage}. Please add a suitable database to your workspace.`,
            );
            return;
          }
        }
        const quickPickItems = filteredDBs.map<DatabaseQuickPickItem>(
          (dbItem) => ({
            databaseItem: dbItem,
            label: dbItem.name,
            description: dbItem.language,
          }),
        );
        /**
         * Databases that were selected in the quick pick menu.
         */
        const quickpick = await window.showQuickPick<DatabaseQuickPickItem>(
          quickPickItems,
          { canPickMany: true, ignoreFocusOut: true },
        );
        if (quickpick !== undefined) {
          // Collect all skipped databases and display them at the end (instead of popping up individual errors)
          const skippedDatabases = [];
          const errors = [];
          for (const item of quickpick) {
            try {
              await compileAndRunQuery(
                false,
                uri,
                progress,
                token,
                item.databaseItem,
              );
            } catch (e) {
              skippedDatabases.push(item.label);
              errors.push(getErrorMessage(e));
            }
          }
          if (skippedDatabases.length > 0) {
            void extLogger.log(`Errors:\n${errors.join("\n")}`);
            void showAndLogWarningMessage(
              `The following databases were skipped:\n${skippedDatabases.join(
                "\n",
              )}.\nFor details about the errors, see the logs.`,
            );
          }
        } else {
          void showAndLogErrorMessage("No databases selected.");
        }
      },
      {
        title: "Running query on selected databases",
        cancellable: true,
      },
    ),
  );
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.runQueries",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        _: Uri | undefined,
        multi: Uri[],
      ) => {
        const maxQueryCount = MAX_QUERIES.getValue() as number;
        const [files, dirFound] = await gatherQlFiles(
          multi.map((uri) => uri.fsPath),
        );
        if (files.length > maxQueryCount) {
          throw new Error(
            `You tried to run ${files.length} queries, but the maximum is ${maxQueryCount}. Try selecting fewer queries or changing the 'codeQL.runningQueries.maxQueries' setting.`,
          );
        }
        // warn user and display selected files when a directory is selected because some ql
        // files may be hidden from the user.
        if (dirFound) {
          const fileString = files.map((file) => basename(file)).join(", ");
          const res = await showBinaryChoiceDialog(
            `You are about to run ${files.length} queries: ${fileString} Do you want to continue?`,
          );
          if (!res) {
            return;
          }
        }
        const queryUris = files.map((path) => Uri.parse(`file:${path}`, true));

        // Use a wrapped progress so that messages appear with the queries remaining in it.
        let queriesRemaining = queryUris.length;
        function wrappedProgress(update: ProgressUpdate) {
          const message =
            queriesRemaining > 1
              ? `${queriesRemaining} remaining. ${update.message}`
              : update.message;
          progress({
            ...update,
            message,
          });
        }

        wrappedProgress({
          maxStep: queryUris.length,
          step: queryUris.length - queriesRemaining,
          message: "",
        });

        await Promise.all(
          queryUris.map(async (uri) =>
            compileAndRunQuery(
              false,
              uri,
              wrappedProgress,
              token,
              undefined,
            ).then(() => queriesRemaining--),
          ),
        );
      },
      {
        title: "Running queries",
        cancellable: true,
      },

      // Open the query server logger on error since that's usually where the interesting errors appear.
      queryServerLogger,
    ),
  );
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.quickEval",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri | undefined,
      ) => await compileAndRunQuery(true, uri, progress, token, undefined),
      {
        title: "Running query",
        cancellable: true,
      },
      // Open the query server logger on error since that's usually where the interesting errors appear.
      queryServerLogger,
    ),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.buildQueryPerformanceDataDatabase",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        inputDirectory: Uri,
        outputDirectory: Uri,
      ) =>
        await buildQueryPerformanceDataDatabase(
          inputDirectory,
          outputDirectory,
          progress,
          token,
        ),
      {
        title: "Building performance data database",
        cancellable: true,
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.runPerformanceQueryOnDB",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        inputPath: Uri,
        dbPath: Uri,
        bqrsPath: Uri,
        csvOut: Uri,
      ) =>
        await runPerformanceQueryOnDB(
          inputPath,
          dbPath,
          bqrsPath,
          csvOut,
          progress,
          token,
        ),
      {
        title: "Running performance queries",
        cancellable: true,
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.codeLensQuickEval",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri,
        range: Range,
      ) =>
        await compileAndRunQuery(true, uri, progress, token, undefined, range),
      {
        title: "Running query",
        cancellable: true,
      },

      // Open the query server logger on error since that's usually where the interesting errors appear.
      queryServerLogger,
    ),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.quickQuery",
      async (progress: ProgressCallback, token: CancellationToken) =>
        displayQuickQuery(ctx, cliServer, databaseUI, progress, token),
      {
        title: "Run Quick Query",
      },

      // Open the query server logger on error since that's usually where the interesting errors appear.
      queryServerLogger,
    ),
  );

  // The "runVariantAnalysis" command is internal-only.
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.runVariantAnalysis",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        uri: Uri | undefined,
      ) => {
        if (isCanary()) {
          progress({
            maxStep: 5,
            step: 0,
            message: "Getting credentials",
          });

          await variantAnalysisManager.runVariantAnalysis(
            uri || window.activeTextEditor?.document.uri,
            progress,
            token,
          );
        } else {
          throw new Error(
            "Variant analysis requires the CodeQL Canary version to run.",
          );
        }
      },
      {
        title: "Run Variant Analysis",
        cancellable: true,
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunner(
      "codeQL.openVariantAnalysisLogs",
      async (variantAnalysisId: number) => {
        await variantAnalysisManager.openVariantAnalysisLogs(variantAnalysisId);
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunner(
      "codeQL.copyVariantAnalysisRepoList",
      async (
        variantAnalysisId: number,
        filterSort?: RepositoriesFilterSortStateWithIds,
      ) => {
        await variantAnalysisManager.copyRepoListToClipboard(
          variantAnalysisId,
          filterSort,
        );
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunner(
      "codeQL.monitorVariantAnalysis",
      async (variantAnalysis: VariantAnalysis, token: CancellationToken) => {
        await variantAnalysisManager.monitorVariantAnalysis(
          variantAnalysis,
          token,
        );
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunner(
      "codeQL.autoDownloadVariantAnalysisResult",
      async (
        scannedRepo: VariantAnalysisScannedRepository,
        variantAnalysisSummary: VariantAnalysis,
        token: CancellationToken,
      ) => {
        await variantAnalysisManager.enqueueDownload(
          scannedRepo,
          variantAnalysisSummary,
          token,
        );
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunner(
      "codeQL.cancelVariantAnalysis",
      async (variantAnalysisId: number) => {
        await variantAnalysisManager.cancelVariantAnalysis(variantAnalysisId);
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunner("codeQL.exportSelectedVariantAnalysisResults", async () => {
      await exportSelectedVariantAnalysisResults(qhm);
    }),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.exportVariantAnalysisResults",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        variantAnalysisId: number,
        filterSort?: RepositoriesFilterSortStateWithIds,
      ) => {
        await exportVariantAnalysisResults(
          variantAnalysisManager,
          variantAnalysisId,
          filterSort,
          app.credentials,
          progress,
          token,
        );
      },
      {
        title: "Exporting variant analysis results",
        cancellable: true,
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunner(
      "codeQL.loadVariantAnalysisRepoResults",
      async (variantAnalysisId: number, repositoryFullName: string) => {
        await variantAnalysisManager.loadResults(
          variantAnalysisId,
          repositoryFullName,
        );
      },
    ),
  );

  // The "openVariantAnalysisView" command is internal-only.
  ctx.subscriptions.push(
    commandRunner(
      "codeQL.openVariantAnalysisView",
      async (variantAnalysisId: number) => {
        await variantAnalysisManager.showView(variantAnalysisId);
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunner(
      "codeQL.openVariantAnalysisQueryText",
      async (variantAnalysisId: number) => {
        await variantAnalysisManager.openQueryText(variantAnalysisId);
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunner(
      "codeQL.openVariantAnalysisQueryFile",
      async (variantAnalysisId: number) => {
        await variantAnalysisManager.openQueryFile(variantAnalysisId);
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunner("codeQL.openReferencedFile", openReferencedFile),
  );

  ctx.subscriptions.push(
    commandRunner("codeQL.previewQueryHelp", previewQueryHelp),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.restartQueryServer",
      async (progress: ProgressCallback, token: CancellationToken) => {
        // We restart the CLI server too, to ensure they are the same version
        cliServer.restartCliServer();
        await qs.restartQueryServer(progress, token);
        void showAndLogInformationMessage("CodeQL Query Server restarted.", {
          outputLogger: queryServerLogger,
        });
      },
      {
        title: "Restarting Query Server",
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.chooseDatabaseFolder",
      (progress: ProgressCallback, token: CancellationToken) =>
        databaseUI.handleChooseDatabaseFolder(progress, token),
      {
        title: "Choose a Database from a Folder",
      },
    ),
  );
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.chooseDatabaseArchive",
      (progress: ProgressCallback, token: CancellationToken) =>
        databaseUI.handleChooseDatabaseArchive(progress, token),
      {
        title: "Choose a Database from an Archive",
      },
    ),
  );
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.chooseDatabaseGithub",
      async (progress: ProgressCallback, token: CancellationToken) => {
        const credentials = isCanary() ? app.credentials : undefined;
        await databaseUI.handleChooseDatabaseGithub(
          credentials,
          progress,
          token,
        );
      },
      {
        title: "Adding database from GitHub",
      },
    ),
  );
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.chooseDatabaseInternet",
      (progress: ProgressCallback, token: CancellationToken) =>
        databaseUI.handleChooseDatabaseInternet(progress, token),

      {
        title: "Adding database from URL",
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunner("codeQL.openDocumentation", async () =>
      env.openExternal(Uri.parse("https://codeql.github.com/docs/")),
    ),
  );

  ctx.subscriptions.push(
    commandRunner("codeQL.copyVersion", async () => {
      const text = `CodeQL extension version: ${
        extension?.packageJSON.version
      } \nCodeQL CLI version: ${await getCliVersion()} \nPlatform: ${platform()} ${arch()}`;
      await env.clipboard.writeText(text);
      void showAndLogInformationMessage(text);
    }),
  );

  const getCliVersion = async () => {
    try {
      return await cliServer.getVersion();
    } catch {
      return "<missing>";
    }
  };

  ctx.subscriptions.push(
    commandRunner("codeQL.authenticateToGitHub", async () => {
      /**
       * Credentials for authenticating to GitHub.
       * These are used when making API calls.
       */
      const octokit = await app.credentials.getOctokit();
      const userInfo = await octokit.users.getAuthenticated();
      void showAndLogInformationMessage(
        `Authenticated to GitHub as user: ${userInfo.data.login}`,
      );
    }),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.installPackDependencies",
      async (progress: ProgressCallback) =>
        await handleInstallPackDependencies(cliServer, progress),
      {
        title: "Installing pack dependencies",
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.downloadPacks",
      async (progress: ProgressCallback) =>
        await handleDownloadPacks(cliServer, progress),
      {
        title: "Downloading packs",
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunner("codeQL.showLogs", async () => {
      extLogger.show();
    }),
  );

  ctx.subscriptions.push(new SummaryLanguageSupport());

  void extLogger.log("Starting language server.");
  await client.start();
  ctx.subscriptions.push({
    dispose: () => {
      void client.stop();
    },
  });
  // Jump-to-definition and find-references
  void extLogger.log("Registering jump-to-definition handlers.");

  // Store contextual queries in a temporary folder so that they are removed
  // when the application closes. There is no need for the user to interact with them.
  const contextualQueryStorageDir = join(
    tmpDir.name,
    "contextual-query-storage",
  );
  await ensureDir(contextualQueryStorageDir);
  languages.registerDefinitionProvider(
    { scheme: zipArchiveScheme },
    new TemplateQueryDefinitionProvider(
      cliServer,
      qs,
      dbm,
      contextualQueryStorageDir,
    ),
  );

  languages.registerReferenceProvider(
    { scheme: zipArchiveScheme },
    new TemplateQueryReferenceProvider(
      cliServer,
      qs,
      dbm,
      contextualQueryStorageDir,
    ),
  );

  const astViewer = new AstViewer();
  const printAstTemplateProvider = new TemplatePrintAstProvider(
    cliServer,
    qs,
    dbm,
    contextualQueryStorageDir,
  );
  const cfgTemplateProvider = new TemplatePrintCfgProvider(cliServer, dbm);

  ctx.subscriptions.push(astViewer);
  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.viewAst",
      async (
        progress: ProgressCallback,
        token: CancellationToken,
        selectedFile: Uri,
      ) => {
        const ast = await printAstTemplateProvider.provideAst(
          progress,
          token,
          selectedFile ?? window.activeTextEditor?.document.uri,
        );
        if (ast) {
          astViewer.updateRoots(await ast.getRoots(), ast.db, ast.fileName);
        }
      },
      {
        cancellable: true,
        title: "Calculate AST",
      },
    ),
  );

  ctx.subscriptions.push(
    commandRunnerWithProgress(
      "codeQL.viewCfg",
      async (progress: ProgressCallback, token: CancellationToken) => {
        const res = await cfgTemplateProvider.provideCfgUri(
          window.activeTextEditor?.document,
        );
        if (res) {
          await compileAndRunQuery(false, res[0], progress, token, undefined);
        }
      },
      {
        title: "Calculating Control Flow Graph",
        cancellable: true,
      },
    ),
  );

  const mockServer = new VSCodeMockGitHubApiServer(ctx);
  ctx.subscriptions.push(mockServer);
  ctx.subscriptions.push(
    commandRunner(
      "codeQL.mockGitHubApiServer.startRecording",
      async () => await mockServer.startRecording(),
    ),
  );
  ctx.subscriptions.push(
    commandRunner(
      "codeQL.mockGitHubApiServer.saveScenario",
      async () => await mockServer.saveScenario(),
    ),
  );
  ctx.subscriptions.push(
    commandRunner(
      "codeQL.mockGitHubApiServer.cancelRecording",
      async () => await mockServer.cancelRecording(),
    ),
  );
  ctx.subscriptions.push(
    commandRunner(
      "codeQL.mockGitHubApiServer.loadScenario",
      async () => await mockServer.loadScenario(),
    ),
  );
  ctx.subscriptions.push(
    commandRunner(
      "codeQL.mockGitHubApiServer.unloadScenario",
      async () => await mockServer.unloadScenario(),
    ),
  );

  await commands.executeCommand("codeQLDatabases.removeOrphanedDatabases");

  void extLogger.log("Reading query history");
  await qhm.readQueryHistory();

  void extLogger.log("Successfully finished extension initialization.");

  return {
    ctx,
    cliServer,
    qs,
    distributionManager,
    databaseManager: dbm,
    databaseUI,
    variantAnalysisManager,
    dispose: () => {
      ctx.subscriptions.forEach((d) => d.dispose());
    },
  };
}

function addUnhandledRejectionListener() {
  const handler = (error: unknown) => {
    const message = redactableError(
      asError(error),
    )`Unhandled error: ${getErrorMessage(error)}`;
    // Add a catch so that showAndLogExceptionWithTelemetry fails, we avoid
    // triggering "unhandledRejection" and avoid an infinite loop
    showAndLogExceptionWithTelemetry(message).catch(
      (telemetryError: unknown) => {
        void extLogger.log(
          `Failed to send error telemetry: ${getErrorMessage(telemetryError)}`,
        );
        void extLogger.log(message.fullMessage);
      },
    );
  };

  // "uncaughtException" will trigger whenever an exception reaches the top level.
  // This covers extension initialization and any code within a `setTimeout`.
  // Notably this does not include exceptions thrown when executing commands,
  // because `commandRunner` wraps the command body and handles errors.
  process.addListener("uncaughtException", handler);

  // "unhandledRejection" will trigger whenever any promise is rejected and it is
  // not handled by a "catch" somewhere in the promise chain. This includes when
  // a promise is used with the "void" operator.
  process.addListener("unhandledRejection", handler);
}

async function createQueryServer(
  qlConfigurationListener: QueryServerConfigListener,
  cliServer: CodeQLCliServer,
  ctx: ExtensionContext,
): Promise<QueryRunner> {
  const qsOpts = {
    logger: queryServerLogger,
    contextStoragePath: getContextStoragePath(ctx),
  };
  const progressCallback = (
    task: (
      progress: ProgressReporter,
      token: CancellationToken,
    ) => Thenable<void>,
  ) =>
    Window.withProgress(
      { title: "CodeQL query server", location: ProgressLocation.Window },
      task,
    );
  if (await cliServer.cliConstraints.supportsNewQueryServer()) {
    const qs = new QueryServerClient(
      qlConfigurationListener,
      cliServer,
      qsOpts,
      progressCallback,
    );
    ctx.subscriptions.push(qs);
    await qs.startQueryServer();
    return new NewQueryRunner(qs);
  } else {
    const qs = new LegacyQueryServerClient(
      qlConfigurationListener,
      cliServer,
      qsOpts,
      progressCallback,
    );
    ctx.subscriptions.push(qs);
    await qs.startQueryServer();
    return new LegacyQueryRunner(qs);
  }
}

function getContextStoragePath(ctx: ExtensionContext) {
  return ctx.storageUri?.fsPath || ctx.globalStorageUri.fsPath;
}

async function initializeLogging(ctx: ExtensionContext): Promise<void> {
  ctx.subscriptions.push(extLogger);
  ctx.subscriptions.push(queryServerLogger);
  ctx.subscriptions.push(ideServerLogger);
}

const checkForUpdatesCommand = "codeQL.checkForUpdatesToCLI";

const avoidVersionCheck = "avoid-version-check-at-startup";
const lastVersionChecked = "last-version-checked";
async function assertVSCodeVersionGreaterThan(
  minVersion: string,
  ctx: ExtensionContext,
) {
  // Check if we should reset the version check.
  const lastVersion = await ctx.globalState.get(lastVersionChecked);
  await ctx.globalState.update(lastVersionChecked, vscodeVersion);

  if (lastVersion !== minVersion) {
    // In this case, the version has changed since the last time we checked.
    // If the user has previously opted out of this check, then user has updated their
    // vscode instance since then, so we should check again. Any future warning would
    // be for a different version of vscode.
    await ctx.globalState.update(avoidVersionCheck, false);
  }
  if (await ctx.globalState.get(avoidVersionCheck)) {
    return;
  }
  try {
    const parsedVersion = parse(vscodeVersion);
    const parsedMinVersion = parse(minVersion);
    if (!parsedVersion || !parsedMinVersion) {
      void showAndLogWarningMessage(
        `Could not do a version check of vscode because could not parse version number: actual vscode version ${vscodeVersion} or minimum supported vscode version ${minVersion}.`,
      );
      return;
    }

    if (lt(parsedVersion, parsedMinVersion)) {
      const message = `The CodeQL extension requires VS Code version ${minVersion} or later. Current version is ${vscodeVersion}. Please update VS Code to get the latest features of CodeQL.`;
      const result = await showBinaryChoiceDialog(
        message,
        false,
        "OK",
        "Don't show again",
      );
      if (!result) {
        await ctx.globalState.update(avoidVersionCheck, true);
      }
    }
  } catch (e) {
    void showAndLogWarningMessage(
      `Could not do a version check because of an error: ${getErrorMessage(e)}`,
    );
  }
}
