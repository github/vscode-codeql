import "source-map-support/register";
import {
  CancellationToken,
  Disposable,
  env,
  ExtensionContext,
  extensions,
  languages,
  ProgressLocation,
  Uri,
  version as vscodeVersion,
  window as Window,
  workspace,
} from "vscode";
import { LanguageClient } from "vscode-languageclient/node";
import { arch, platform, homedir } from "os";
import { ensureDir } from "fs-extra";
import { join } from "path";
import { dirSync } from "tmp-promise";
import { testExplorerExtensionId, TestHub } from "vscode-test-adapter-api";
import { lt, parse } from "semver";
import { watch } from "chokidar";
import {
  activate as archiveFilesystemProvider_activate,
  zipArchiveScheme,
} from "./common/vscode/archive-filesystem-provider";
import { CliVersionConstraint, CodeQLCliServer } from "./codeql-cli/cli";
import {
  CliConfigListener,
  DistributionConfigListener,
  isCanary,
  joinOrderWarningThreshold,
  QueryHistoryConfigListener,
  QueryServerConfigListener,
} from "./config";
import {
  AstViewer,
  install,
  spawnIdeServer,
  getQueryEditorCommands,
  TemplatePrintAstProvider,
  TemplatePrintCfgProvider,
  TemplateQueryDefinitionProvider,
  TemplateQueryReferenceProvider,
} from "./language-support";
import { DatabaseManager } from "./databases/local-databases";
import { DatabaseUI } from "./databases/local-databases-ui";
import {
  DEFAULT_DISTRIBUTION_VERSION_RANGE,
  DistributionKind,
  DistributionManager,
  DistributionUpdateCheckResultKind,
  FindDistributionResult,
  FindDistributionResultKind,
  GithubApiError,
  GithubRateLimitedError,
} from "./codeql-cli/distribution";
import { tmpDir, tmpDirDisposal } from "./tmp-dir";
import { prepareCodeTour } from "./code-tour";
import {
  showBinaryChoiceDialog,
  showInformationMessageWithAction,
} from "./common/vscode/dialog";
import {
  asError,
  assertNever,
  getErrorMessage,
  getErrorStack,
} from "./pure/helpers-pure";
import {
  ResultsView,
  WebviewReveal,
  LocalQueries,
  QuickEvalCodeLensProvider,
} from "./local-queries";
import {
  BaseLogger,
  extLogger,
  ideServerLogger,
  ProgressReporter,
  queryServerLogger,
} from "./common";
import { showAndLogExceptionWithTelemetry } from "./common/vscode/logging";
import { QueryHistoryManager } from "./query-history/query-history-manager";
import { CompletedLocalQueryInfo } from "./query-results";
import {
  LegacyQueryRunner,
  QueryServerClient as LegacyQueryServerClient,
} from "./query-server/legacy";
import { QLTestAdapterFactory } from "./query-testing/test-adapter";
import { TestUIService } from "./query-testing/test-ui";
import { CompareView } from "./compare/compare-view";
import { initializeTelemetry } from "./common/vscode/telemetry";
import { ProgressCallback, withProgress } from "./common/vscode/progress";
import { CodeQlStatusBarHandler } from "./status-bar";
import { getPackagingCommands } from "./packaging";
import { HistoryItemLabelProvider } from "./query-history/history-item-label-provider";
import { EvalLogViewer } from "./query-evaluation-logging";
import { SummaryLanguageSupport } from "./log-insights/summary-language-support";
import { JoinOrderScannerProvider } from "./log-insights/join-order";
import { LogScannerService } from "./log-insights/log-scanner-service";
import { VariantAnalysisView } from "./variant-analysis/variant-analysis-view";
import { VariantAnalysisViewSerializer } from "./variant-analysis/variant-analysis-view-serializer";
import { VariantAnalysisManager } from "./variant-analysis/variant-analysis-manager";
import { createVariantAnalysisContentProvider } from "./variant-analysis/variant-analysis-content-provider";
import { VSCodeMockGitHubApiServer } from "./variant-analysis/gh-api/mocks/vscode-mock-gh-api-server";
import { VariantAnalysisResultsManager } from "./variant-analysis/variant-analysis-results-manager";
import { ExtensionApp } from "./common/vscode/vscode-app";
import { DbModule } from "./databases/db-module";
import { redactableError } from "./pure/errors";
import { QLDebugAdapterDescriptorFactory } from "./debugger/debugger-factory";
import { QueryHistoryDirs } from "./query-history/query-history-dirs";
import {
  AllExtensionCommands,
  BaseCommands,
  PreActivationCommands,
  QueryServerCommands,
} from "./common/commands";
import { getAstCfgCommands } from "./language-support/ast-viewer/ast-cfg-commands";
import { App } from "./common/app";
import { registerCommandWithErrorHandling } from "./common/vscode/commands";
import { DebuggerUI } from "./debugger/debugger-ui";
import { DataExtensionsEditorModule } from "./data-extensions-editor/data-extensions-editor-module";
import { TestManager } from "./query-testing/test-manager";
import { TestRunner } from "./query-testing/test-runner";
import { TestManagerBase } from "./query-testing/test-manager-base";
import { NewQueryRunner, QueryRunner, QueryServerClient } from "./query-server";
import { QueriesModule } from "./queries-panel/queries-module";
import {
  showAndLogErrorMessage,
  showAndLogInformationMessage,
  showAndLogWarningMessage,
} from "./common/logging";

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
 * Return all commands that are not tied to the more specific managers.
 */
function getCommands(
  app: App,
  cliServer: CodeQLCliServer,
  queryRunner: QueryRunner,
  ideServer: LanguageClient,
): BaseCommands {
  const getCliVersion = async () => {
    try {
      return await cliServer.getVersion();
    } catch {
      return "<missing>";
    }
  };

  const restartQueryServer = async () =>
    withProgress(
      async (progress: ProgressCallback, token: CancellationToken) => {
        // Restart all of the spawned servers: cli, query, and language.
        cliServer.restartCliServer();
        await Promise.all([
          queryRunner.restartQueryServer(progress, token),
          async () => {
            if (ideServer.isRunning()) {
              await ideServer.restart();
            } else {
              await ideServer.start();
            }
          },
        ]);
        void showAndLogInformationMessage(
          queryServerLogger,
          "CodeQL Query Server restarted.",
        );
      },
      {
        title: "Restarting Query Server",
      },
    );

  return {
    "codeQL.openDocumentation": async () => {
      await env.openExternal(Uri.parse("https://codeql.github.com/docs/"));
    },
    "codeQL.restartQueryServer": restartQueryServer,
    "codeQL.restartQueryServerOnConfigChange": restartQueryServer,
    "codeQL.restartLegacyQueryServerOnConfigChange": restartQueryServer,
    "codeQL.restartQueryServerOnExternalConfigChange": restartQueryServer,
    "codeQL.copyVersion": async () => {
      const text = `CodeQL extension version: ${
        extension?.packageJSON.version
      } \nCodeQL CLI version: ${await getCliVersion()} \nPlatform: ${platform()} ${arch()}`;
      await env.clipboard.writeText(text);
      void showAndLogInformationMessage(extLogger, text);
    },
    "codeQL.authenticateToGitHub": async () => {
      /**
       * Credentials for authenticating to GitHub.
       * These are used when making API calls.
       */
      const octokit = await app.credentials.getOctokit();
      const userInfo = await octokit.users.getAuthenticated();
      void showAndLogInformationMessage(
        extLogger,
        `Authenticated to GitHub as user: ${userInfo.data.login}`,
      );
    },
    "codeQL.showLogs": async () => {
      extLogger.show();
    },
  };
}

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
      // This is purposefully using `registerCommandWithErrorHandling` instead of the command manager because these
      // commands are untyped and registered pre-activation.
      errorStubs.push(
        registerCommandWithErrorHandling(command, stubGenerator(command)),
      );
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
  readonly localQueries: LocalQueries;
  readonly variantAnalysisManager: VariantAnalysisManager;
  readonly dispose: () => void;
}

interface DistributionUpdateConfig {
  isUserInitiated: boolean;
  shouldDisplayMessageWhenNoUpdates: boolean;
  allowAutoUpdating: boolean;
}

const shouldUpdateOnNextActivationKey = "shouldUpdateOnNextActivation";

const codeQlVersionRange = DEFAULT_DISTRIBUTION_VERSION_RANGE;

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
): Promise<CodeQLExtensionInterface | undefined> {
  void extLogger.log(`Starting ${extensionId} extension`);
  if (extension === undefined) {
    throw new Error(`Can't find extension ${extensionId}`);
  }

  const distributionConfigListener = new DistributionConfigListener();
  await initializeLogging(ctx);
  const telemetryListener = await initializeTelemetry(extension, ctx);
  addUnhandledRejectionListener();
  install();

  const app = new ExtensionApp(ctx);

  const codelensProvider = new QuickEvalCodeLensProvider();
  languages.registerCodeLensProvider(
    { scheme: "file", language: "ql" },
    codelensProvider,
  );

  ctx.subscriptions.push(distributionConfigListener);
  const distributionManager = new DistributionManager(
    distributionConfigListener,
    codeQlVersionRange,
    ctx,
  );

  registerErrorStubs([checkForUpdatesCommand], (command) => async () => {
    void showAndLogErrorMessage(
      extLogger,
      `Can't execute ${command}: waiting to finish loading CodeQL CLI.`,
    );
  });

  // Checking the vscode version should not block extension activation.
  void assertVSCodeVersionGreaterThan(MIN_VERSION, ctx);

  ctx.subscriptions.push(
    distributionConfigListener.onDidChangeConfiguration(() =>
      installOrUpdateThenTryActivate(
        ctx,
        app,
        distributionManager,
        distributionConfigListener,
        {
          isUserInitiated: true,
          shouldDisplayMessageWhenNoUpdates: false,
          allowAutoUpdating: true,
        },
      ),
    ),
  );
  ctx.subscriptions.push(
    // This is purposefully using `registerCommandWithErrorHandling` directly instead of the command manager
    // because this command is registered pre-activation.
    registerCommandWithErrorHandling(checkForUpdatesCommand, () =>
      installOrUpdateThenTryActivate(
        ctx,
        app,
        distributionManager,
        distributionConfigListener,
        {
          isUserInitiated: true,
          shouldDisplayMessageWhenNoUpdates: true,
          allowAutoUpdating: true,
        },
      ),
    ),
  );

  const variantAnalysisViewSerializer = new VariantAnalysisViewSerializer(
    ctx,
    app,
  );
  Window.registerWebviewPanelSerializer(
    VariantAnalysisView.viewType,
    variantAnalysisViewSerializer,
  );

  const codeQlExtension = await installOrUpdateThenTryActivate(
    ctx,
    app,
    distributionManager,
    distributionConfigListener,
    {
      isUserInitiated: !!ctx.globalState.get(shouldUpdateOnNextActivationKey),
      shouldDisplayMessageWhenNoUpdates: false,

      // only auto update on startup if the user has previously requested an update
      // otherwise, ask user to accept the update
      allowAutoUpdating: !!ctx.globalState.get(shouldUpdateOnNextActivationKey),
    },
  );

  if (codeQlExtension !== undefined) {
    variantAnalysisViewSerializer.onExtensionLoaded(
      codeQlExtension.variantAnalysisManager,
    );
    codeQlExtension.cliServer.addVersionChangedListener((ver) => {
      telemetryListener.cliVersion = ver;
    });

    let unsupportedWarningShown = false;
    codeQlExtension.cliServer.addVersionChangedListener((ver) => {
      if (!ver) {
        return;
      }

      if (unsupportedWarningShown) {
        return;
      }

      if (CliVersionConstraint.OLDEST_SUPPORTED_CLI_VERSION.compare(ver) < 0) {
        return;
      }

      void showAndLogWarningMessage(
        extLogger,
        `You are using an unsupported version of the CodeQL CLI (${ver}). ` +
          `The minimum supported version is ${CliVersionConstraint.OLDEST_SUPPORTED_CLI_VERSION}. ` +
          `Please upgrade to a newer version of the CodeQL CLI.`,
      );
      unsupportedWarningShown = true;
    });
  }

  return codeQlExtension;
}

async function installOrUpdateDistributionWithProgressTitle(
  ctx: ExtensionContext,
  app: ExtensionApp,
  distributionManager: DistributionManager,
  progressTitle: string,
  config: DistributionUpdateConfig,
): Promise<void> {
  const minSecondsSinceLastUpdateCheck = config.isUserInitiated ? 0 : 86400;
  const noUpdatesLoggingFunc = config.shouldDisplayMessageWhenNoUpdates
    ? showAndLogInformationMessage
    : async (logger: BaseLogger, message: string) => void logger.log(message);
  const result =
    await distributionManager.checkForUpdatesToExtensionManagedDistribution(
      minSecondsSinceLastUpdateCheck,
    );

  // We do want to auto update if there is no distribution at all
  const allowAutoUpdating =
    config.allowAutoUpdating || !(await distributionManager.hasDistribution());

  switch (result.kind) {
    case DistributionUpdateCheckResultKind.AlreadyCheckedRecentlyResult:
      void extLogger.log(
        "Didn't perform CodeQL CLI update check since a check was already performed within the previous " +
          `${minSecondsSinceLastUpdateCheck} seconds.`,
      );
      break;
    case DistributionUpdateCheckResultKind.AlreadyUpToDate:
      await noUpdatesLoggingFunc(extLogger, "CodeQL CLI already up to date.");
      break;
    case DistributionUpdateCheckResultKind.InvalidLocation:
      await noUpdatesLoggingFunc(
        extLogger,
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
          await app.commands.execute("workbench.action.reloadWindow");
        }
      } else {
        await withProgress(
          (progress) =>
            distributionManager.installExtensionManagedDistributionRelease(
              result.updatedRelease,
              progress,
            ),
          {
            title: progressTitle,
          },
        );

        await ctx.globalState.update(shouldUpdateOnNextActivationKey, false);
        void showAndLogInformationMessage(
          extLogger,
          `CodeQL CLI updated to version "${result.updatedRelease.name}".`,
        );
      }
      break;
    default:
      assertNever(result);
  }
}

async function installOrUpdateDistribution(
  ctx: ExtensionContext,
  app: ExtensionApp,
  distributionManager: DistributionManager,
  config: DistributionUpdateConfig,
): Promise<void> {
  if (isInstallingOrUpdatingDistribution) {
    throw new Error("Already installing or updating CodeQL CLI");
  }
  isInstallingOrUpdatingDistribution = true;
  const codeQlInstalled =
    (await distributionManager.getCodeQlPathWithoutVersionCheck()) !==
    undefined;
  const willUpdateCodeQl = ctx.globalState.get(shouldUpdateOnNextActivationKey);
  const messageText = willUpdateCodeQl
    ? "Updating CodeQL CLI"
    : codeQlInstalled
    ? "Checking for updates to CodeQL CLI"
    : "Installing CodeQL CLI";

  try {
    await installOrUpdateDistributionWithProgressTitle(
      ctx,
      app,
      distributionManager,
      messageText,
      config,
    );
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
        extLogger,
        `Rate limited while trying to ${taskDescription}. Please try again after ` +
          `your rate limit window resets at ${e.rateLimitResetDate.toLocaleString(
            env.language,
          )}.`,
      );
    } else if (e instanceof GithubApiError) {
      void alertFunction(
        extLogger,
        `Encountered GitHub API error while trying to ${taskDescription}. ${e}`,
      );
    }
    void alertFunction(extLogger, `Unable to ${taskDescription}. ${e}`);
  } finally {
    isInstallingOrUpdatingDistribution = false;
  }
}

async function getDistributionDisplayingDistributionWarnings(
  distributionManager: DistributionManager,
): Promise<FindDistributionResult> {
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
        extLogger,
        `The current version of the CodeQL CLI (${result.version.raw}) ` +
          `is incompatible with this extension. ${fixGuidanceMessage}`,
      );
      break;
    }
    case FindDistributionResultKind.UnknownCompatibilityDistribution:
      void showAndLogWarningMessage(
        extLogger,
        "Compatibility with the configured CodeQL CLI could not be determined. " +
          "You may experience problems using the extension.",
      );
      break;
    case FindDistributionResultKind.NoDistribution:
      void showAndLogErrorMessage(
        extLogger,
        "The CodeQL CLI could not be found.",
      );
      break;
    default:
      assertNever(result);
  }
  return result;
}

async function installOrUpdateThenTryActivate(
  ctx: ExtensionContext,
  app: ExtensionApp,
  distributionManager: DistributionManager,
  distributionConfigListener: DistributionConfigListener,
  config: DistributionUpdateConfig,
): Promise<CodeQLExtensionInterface | undefined> {
  await installOrUpdateDistribution(ctx, app, distributionManager, config);

  try {
    await prepareCodeTour(app.commands);
  } catch (e: unknown) {
    void extLogger.log(
      `Could not open tutorial workspace automatically: ${getErrorMessage(e)}`,
    );
  }

  // Display the warnings even if the extension has already activated.
  const distributionResult =
    await getDistributionDisplayingDistributionWarnings(distributionManager);
  if (
    !beganMainExtensionActivation &&
    distributionResult.kind !== FindDistributionResultKind.NoDistribution
  ) {
    return await activateWithInstalledDistribution(
      ctx,
      app,
      distributionManager,
      distributionConfigListener,
    );
  }

  if (distributionResult.kind === FindDistributionResultKind.NoDistribution) {
    registerErrorStubs([checkForUpdatesCommand], (command) => async () => {
      void extLogger.log(`Can't execute ${command}: missing CodeQL CLI.`);
      const showLogName = "Show Log";
      const installActionName = "Install CodeQL CLI";
      const chosenAction = await Window.showErrorMessage(
        `Can't execute ${command}: missing CodeQL CLI.`,
        showLogName,
        installActionName,
      );
      if (chosenAction === showLogName) {
        extLogger.show();
      } else if (chosenAction === installActionName) {
        await installOrUpdateThenTryActivate(
          ctx,
          app,
          distributionManager,
          distributionConfigListener,
          {
            isUserInitiated: true,
            shouldDisplayMessageWhenNoUpdates: false,
            allowAutoUpdating: true,
          },
        );
      }
    });
  }
  return undefined;
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
  app: ExtensionApp,
  distributionManager: DistributionManager,
  distributionConfigListener: DistributionConfigListener,
): Promise<CodeQLExtensionInterface> {
  beganMainExtensionActivation = true;
  // Remove any error stubs command handlers left over from first part
  // of activation.
  errorStubs.forEach((stub) => stub.dispose());

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
  watchExternalConfigFile(app, ctx);

  const statusBar = new CodeQlStatusBarHandler(
    cliServer,
    distributionConfigListener,
  );
  ctx.subscriptions.push(statusBar);

  void extLogger.log("Initializing query server client.");
  const qs = await createQueryServer(
    app,
    qlConfigurationListener,
    cliServer,
    ctx,
  );

  for (const glob of PACK_GLOBS) {
    const fsWatcher = workspace.createFileSystemWatcher(glob);
    ctx.subscriptions.push(fsWatcher);

    const clearPackCache = async (_uri: Uri) => {
      await qs.clearPackCache();
    };

    fsWatcher.onDidCreate(clearPackCache);
    fsWatcher.onDidChange(clearPackCache);
    fsWatcher.onDidDelete(clearPackCache);
  }

  void extLogger.log("Initializing database manager.");
  const dbm = new DatabaseManager(ctx, app, qs, cliServer, extLogger);

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
  ctx.subscriptions.push(databaseUI);

  QueriesModule.initialize(app, cliServer);

  void extLogger.log("Initializing evaluator log viewer.");
  const evalLogViewer = new EvalLogViewer();
  ctx.subscriptions.push(evalLogViewer);

  void extLogger.log("Initializing query history manager.");
  const queryHistoryConfigurationListener = new QueryHistoryConfigListener();
  ctx.subscriptions.push(queryHistoryConfigurationListener);
  const queryStorageDir = join(ctx.globalStorageUri.fsPath, "queries");
  await ensureDir(queryStorageDir);

  // Store contextual queries in a temporary folder so that they are removed
  // when the application closes. There is no need for the user to interact with them.
  const contextualQueryStorageDir = join(
    tmpDir.name,
    "contextual-query-storage",
  );
  await ensureDir(contextualQueryStorageDir);

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
    dbModule.dbManager,
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
  const queryHistoryDirs: QueryHistoryDirs = {
    localQueriesDirPath: queryStorageDir,
    variantAnalysesDirPath: variantAnalysisStorageDir,
  };

  const qhm = new QueryHistoryManager(
    app,
    qs,
    dbm,
    localQueryResultsView,
    variantAnalysisManager,
    evalLogViewer,
    queryHistoryDirs,
    ctx,
    queryHistoryConfigurationListener,
    labelProvider,
    async (
      from: CompletedLocalQueryInfo,
      to: CompletedLocalQueryInfo,
    ): Promise<void> => showResultsForComparison(compareView, from, to),
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
    async (item: CompletedLocalQueryInfo) =>
      localQueries.showResultsForCompletedQuery(item, WebviewReveal.Forced),
  );
  ctx.subscriptions.push(compareView);

  void extLogger.log("Initializing source archive filesystem provider.");
  archiveFilesystemProvider_activate(ctx);

  const qhelpTmpDir = dirSync({
    prefix: "qhelp_",
    keep: false,
    unsafeCleanup: true,
  });
  ctx.subscriptions.push({ dispose: qhelpTmpDir.removeCallback });

  ctx.subscriptions.push(tmpDirDisposal);

  void extLogger.log("Initializing CodeQL language server.");
  const client = new LanguageClient(
    "codeQL.lsp",
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

  const localQueries = new LocalQueries(
    app,
    qs,
    qhm,
    dbm,
    cliServer,
    databaseUI,
    localQueryResultsView,
    queryStorageDir,
  );
  ctx.subscriptions.push(localQueries);

  void extLogger.log("Initializing debugger factory.");
  ctx.subscriptions.push(
    new QLDebugAdapterDescriptorFactory(queryStorageDir, qs, localQueries),
  );

  void extLogger.log("Initializing debugger UI.");
  const debuggerUI = new DebuggerUI(app, localQueries, dbm);
  ctx.subscriptions.push(debuggerUI);

  const dataExtensionsEditorModule =
    await DataExtensionsEditorModule.initialize(
      ctx,
      app,
      dbm,
      cliServer,
      qs,
      tmpDir.name,
    );

  void extLogger.log("Initializing QLTest interface.");

  const testRunner = new TestRunner(dbm, cliServer);
  ctx.subscriptions.push(testRunner);

  let testManager: TestManagerBase | undefined = undefined;
  if (isCanary()) {
    testManager = new TestManager(app, testRunner, cliServer);
    ctx.subscriptions.push(testManager);
  } else {
    const testExplorerExtension = extensions.getExtension<TestHub>(
      testExplorerExtensionId,
    );
    if (testExplorerExtension) {
      const testHub = testExplorerExtension.exports;
      const testAdapterFactory = new QLTestAdapterFactory(
        testHub,
        testRunner,
        cliServer,
      );
      ctx.subscriptions.push(testAdapterFactory);

      testManager = new TestUIService(app, testHub);
      ctx.subscriptions.push(testManager);
    }
  }

  const testUiCommands = testManager?.getCommands() ?? {};

  const astViewer = new AstViewer();
  const astTemplateProvider = new TemplatePrintAstProvider(
    cliServer,
    qs,
    dbm,
    contextualQueryStorageDir,
  );
  const cfgTemplateProvider = new TemplatePrintCfgProvider(cliServer, dbm);

  ctx.subscriptions.push(astViewer);

  const summaryLanguageSupport = new SummaryLanguageSupport(app);
  ctx.subscriptions.push(summaryLanguageSupport);

  const mockServer = new VSCodeMockGitHubApiServer(app);
  ctx.subscriptions.push(mockServer);

  void extLogger.log("Registering top-level command palette commands.");

  const allCommands: AllExtensionCommands = {
    ...getCommands(app, cliServer, qs, client),
    ...getQueryEditorCommands({
      commandManager: app.commands,
      queryRunner: qs,
      cliServer,
      qhelpTmpDir: qhelpTmpDir.name,
    }),
    ...localQueryResultsView.getCommands(),
    ...qhm.getCommands(),
    ...variantAnalysisManager.getCommands(),
    ...databaseUI.getCommands(),
    ...dbModule.getCommands(),
    ...getAstCfgCommands({
      localQueries,
      astViewer,
      astTemplateProvider,
      cfgTemplateProvider,
    }),
    ...astViewer.getCommands(),
    ...getPackagingCommands({
      cliServer,
    }),
    ...dataExtensionsEditorModule.getCommands(),
    ...evalLogViewer.getCommands(),
    ...summaryLanguageSupport.getCommands(),
    ...testUiCommands,
    ...mockServer.getCommands(),
    ...debuggerUI.getCommands(),
  };

  for (const [commandName, command] of Object.entries(allCommands)) {
    app.commands.register(commandName as keyof AllExtensionCommands, command);
  }

  const queryServerCommands: QueryServerCommands = {
    ...localQueries.getCommands(),
  };

  for (const [commandName, command] of Object.entries(queryServerCommands)) {
    app.queryServerCommands.register(
      commandName as keyof QueryServerCommands,
      command,
    );
  }

  void extLogger.log("Starting language server.");
  await client.start();
  ctx.subscriptions.push({
    dispose: () => {
      void client.stop();
    },
  });
  // Jump-to-definition and find-references
  void extLogger.log("Registering jump-to-definition handlers.");

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

  await app.commands.execute("codeQLDatabases.removeOrphanedDatabases");

  void extLogger.log("Reading query history");
  await qhm.readQueryHistory();

  void extLogger.log("Successfully finished extension initialization.");

  return {
    ctx,
    cliServer,
    localQueries,
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

/**
 * Handle changes to the external config file. This is used to restart the query server
 * when the user changes options.
 * See https://docs.github.com/en/code-security/codeql-cli/using-the-codeql-cli/specifying-command-options-in-a-codeql-configuration-file#using-a-codeql-configuration-file
 */
function watchExternalConfigFile(app: ExtensionApp, ctx: ExtensionContext) {
  const home = homedir();
  if (home) {
    const configPath = join(home, ".config", "codeql", "config");
    const configWatcher = watch(configPath, {
      // These options avoid firing the event twice.
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: true,
    });
    configWatcher.on("all", async () => {
      await app.commands.execute(
        "codeQL.restartQueryServerOnExternalConfigChange",
      );
    });
    ctx.subscriptions.push({
      dispose: () => {
        void configWatcher.close();
      },
    });
  }
}

async function showResultsForComparison(
  compareView: CompareView,
  from: CompletedLocalQueryInfo,
  to: CompletedLocalQueryInfo,
): Promise<void> {
  try {
    await compareView.showResults(from, to);
  } catch (e) {
    void showAndLogExceptionWithTelemetry(
      extLogger,
      redactableError(asError(e))`Failed to show results: ${getErrorMessage(
        e,
      )}`,
    );
  }
}

function addUnhandledRejectionListener() {
  const handler = (error: unknown) => {
    // This listener will be triggered for errors from other extensions as
    // well as errors from this extension. We don't want to flood the user
    // with popups about errors from other extensions, and we don't want to
    // report them in our telemetry.
    //
    // The stack trace gets redacted before being sent as telemetry, but at
    // this point in the code we have the full unredacted information.
    const isFromThisExtension =
      extension && getErrorStack(error).includes(extension.extensionPath);

    if (isFromThisExtension) {
      const message = redactableError(
        asError(error),
      )`Unhandled error: ${getErrorMessage(error)}`;
      // Add a catch so that showAndLogExceptionWithTelemetry fails, we avoid
      // triggering "unhandledRejection" and avoid an infinite loop
      showAndLogExceptionWithTelemetry(extLogger, message).catch(
        (telemetryError: unknown) => {
          void extLogger.log(
            `Failed to send error telemetry: ${getErrorMessage(
              telemetryError,
            )}`,
          );
          void extLogger.log(message.fullMessage);
        },
      );
    }
  };

  // "uncaughtException" will trigger whenever an exception reaches the top level.
  // This covers extension initialization and any code within a `setTimeout`.
  // Notably this does not include exceptions thrown when executing commands,
  // because `registerCommandWithErrorHandling` wraps the command body and
  // handles errors.
  process.addListener("uncaughtException", handler);

  // "unhandledRejection" will trigger whenever any promise is rejected and it is
  // not handled by a "catch" somewhere in the promise chain. This includes when
  // a promise is used with the "void" operator.
  process.addListener("unhandledRejection", handler);
}

async function createQueryServer(
  app: ExtensionApp,
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
      app,
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
      app,
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

const checkForUpdatesCommand: keyof PreActivationCommands =
  "codeQL.checkForUpdatesToCLI" as const;

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
        extLogger,
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
      extLogger,
      `Could not do a version check because of an error: ${getErrorMessage(e)}`,
    );
  }
}
