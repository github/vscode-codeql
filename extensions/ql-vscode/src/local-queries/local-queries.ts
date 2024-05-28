import type {
  ProgressCallback,
  ProgressUpdate,
} from "../common/vscode/progress";
import {
  UserCancellationException,
  withProgress,
} from "../common/vscode/progress";
import type { CancellationToken, Range, TabInputText } from "vscode";
import { CancellationTokenSource, Uri, window } from "vscode";
import {
  TeeLogger,
  showAndLogErrorMessage,
  showAndLogWarningMessage,
} from "../common/logging";
import { MAX_QUERIES } from "../config";
import { gatherQlFiles } from "../common/files";
import { basename } from "path";
import { showBinaryChoiceDialog } from "../common/vscode/dialog";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { displayQuickQuery } from "./quick-query";
import type { CoreCompletedQuery, QueryRunner } from "../query-server";
import type { QueryHistoryManager } from "../query-history/query-history-manager";
import type {
  DatabaseQuickPickItem,
  DatabaseUI,
} from "../databases/local-databases-ui";
import type { ResultsView } from "./results-view";
import type {
  DatabaseItem,
  DatabaseManager,
} from "../databases/local-databases";
import type { SelectedQuery } from "../run-queries-shared";
import type { QueryOutputDir } from "./query-output-dir";
import {
  createInitialQueryInfo,
  createTimestampFile,
  getQuickEvalContext,
  saveBeforeStart,
  validateQueryUri,
} from "../run-queries-shared";
import type { CompletedLocalQueryInfo } from "../query-results";
import { LocalQueryInfo } from "../query-results";
import type { WebviewReveal } from "./webview";
import { asError, getErrorMessage } from "../common/helpers-pure";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { LocalQueryCommands } from "../common/commands";
import { DisposableObject } from "../common/disposable-object";
import { SkeletonQueryWizard } from "./skeleton-query-wizard";
import { LocalQueryRun } from "./local-query-run";
import { createMultiSelectionCommand } from "../common/vscode/selection-commands";
import { findLanguage } from "../codeql-cli/query-language";
import type { QueryTreeViewItem } from "../queries-panel/query-tree-view-item";
import { tryGetQueryLanguage } from "../common/query-language";
import type { LanguageContextStore } from "../language-context-store";
import type { ExtensionApp } from "../common/vscode/extension-app";
import type { DatabaseFetcher } from "../databases/database-fetcher";

export enum QuickEvalType {
  None,
  QuickEval,
  QuickEvalCount,
}

export class LocalQueries extends DisposableObject {
  private selectedQueryTreeViewItems: readonly QueryTreeViewItem[] = [];

  public constructor(
    private readonly app: ExtensionApp,
    private readonly queryRunner: QueryRunner,
    private readonly queryHistoryManager: QueryHistoryManager,
    private readonly databaseManager: DatabaseManager,
    private readonly databaseFetcher: DatabaseFetcher,
    private readonly cliServer: CodeQLCliServer,
    private readonly databaseUI: DatabaseUI,
    private readonly localQueryResultsView: ResultsView,
    private readonly queryStorageDir: string,
    private readonly languageContextStore: LanguageContextStore,
  ) {
    super();
  }

  public setSelectedQueryTreeViewItems(
    selection: readonly QueryTreeViewItem[],
  ) {
    this.selectedQueryTreeViewItems = selection;
  }

  public getCommands(): LocalQueryCommands {
    return {
      "codeQL.runQuery": this.runQuery.bind(this),
      "codeQL.runQueryContextEditor": this.runQuery.bind(this),
      "codeQL.runQueryOnMultipleDatabases":
        this.runQueryOnMultipleDatabases.bind(this),
      "codeQL.runQueryOnMultipleDatabasesContextEditor":
        this.runQueryOnMultipleDatabases.bind(this),
      "codeQLQueries.runLocalQueryFromQueriesPanel":
        this.runQueryFromQueriesPanel.bind(this),
      "codeQLQueries.runLocalQueryContextMenu":
        this.runQueryFromQueriesPanel.bind(this),
      "codeQLQueries.runLocalQueriesContextMenu":
        this.runQueriesFromQueriesPanel.bind(this),
      "codeQLQueries.runLocalQueriesFromPanel":
        this.runQueriesFromQueriesPanel.bind(this),
      "codeQLQueries.createQuery": this.createSkeletonQuery.bind(this),
      "codeQL.runLocalQueryFromFileTab": this.runQuery.bind(this),
      "codeQL.runQueries": createMultiSelectionCommand(
        this.runQueries.bind(this),
      ),
      "codeQL.quickEval": this.quickEval.bind(this),
      "codeQL.quickEvalCount": this.quickEvalCount.bind(this),
      "codeQL.quickEvalContextEditor": this.quickEval.bind(this),
      "codeQL.codeLensQuickEval": this.codeLensQuickEval.bind(this),
      "codeQL.quickQuery": this.quickQuery.bind(this),
      "codeQL.getCurrentQuery": () => {
        // When invoked as a command, such as when resolving variables in a debug configuration,
        // always allow ".qll" files, because we don't know if the configuration will be for
        // quickeval yet. The debug configuration code will do further validation once it knows for
        // sure.
        return this.getCurrentQuery(true);
      },
      "codeQL.createQuery": this.createSkeletonQuery.bind(this),
      "codeQLQuickQuery.createQuery": this.createSkeletonQuery.bind(this),
    };
  }

  private async runQueryFromQueriesPanel(
    queryTreeViewItem: QueryTreeViewItem,
  ): Promise<void> {
    if (queryTreeViewItem.path !== undefined) {
      await this.runQuery(Uri.file(queryTreeViewItem.path));
    }
  }

  private async runQueriesFromQueriesPanel(
    queryTreeViewItem: QueryTreeViewItem,
  ): Promise<void> {
    const uris = [];
    for (const child of queryTreeViewItem.children) {
      if (child.path !== undefined) {
        uris.push(Uri.file(child.path));
      }
    }
    await this.runQueries(uris);
  }

  private async runQuery(uri: Uri | undefined): Promise<void> {
    await withProgress(
      async (progress, token) => {
        await this.compileAndRunQuery(
          QuickEvalType.None,
          uri,
          progress,
          token,
          undefined,
        );
      },
      {
        title: "Running query",
        cancellable: true,
      },
    );
  }

  private async runQueryOnMultipleDatabases(
    uri: Uri | undefined,
  ): Promise<void> {
    await withProgress(
      async (progress, token) =>
        await this.compileAndRunQueryOnMultipleDatabases(progress, token, uri),
      {
        title: "Running query on selected databases",
        cancellable: true,
      },
    );
  }

  private async runQueries(fileURIs: Uri[]): Promise<void> {
    await withProgress(
      async (progress, token) => {
        const maxQueryCount = MAX_QUERIES.getValue() as number;
        const [files, dirFound] = await gatherQlFiles(
          fileURIs.map((uri) => uri.fsPath),
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
            this.compileAndRunQuery(
              QuickEvalType.None,
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
    );
  }

  private async quickEval(uri: Uri): Promise<void> {
    await withProgress(
      async (progress, token) => {
        await this.compileAndRunQuery(
          QuickEvalType.QuickEval,
          uri,
          progress,
          token,
          undefined,
        );
      },
      {
        title: "Running query",
        cancellable: true,
      },
    );
  }

  private async quickEvalCount(uri: Uri): Promise<void> {
    await withProgress(
      async (progress, token) => {
        await this.compileAndRunQuery(
          QuickEvalType.QuickEvalCount,
          uri,
          progress,
          token,
          undefined,
        );
      },
      {
        title: "Running query",
        cancellable: true,
      },
    );
  }

  private async codeLensQuickEval(uri: Uri, range: Range): Promise<void> {
    await withProgress(
      async (progress, token) =>
        await this.compileAndRunQuery(
          QuickEvalType.QuickEval,
          uri,
          progress,
          token,
          undefined,
          range,
        ),
      {
        title: "Running query",
        cancellable: true,
      },
    );
  }

  private async quickQuery(): Promise<void> {
    await withProgress(
      async (progress) =>
        displayQuickQuery(this.app, this.cliServer, this.databaseUI, progress),
      {
        title: "Run Quick Query",
      },
    );
  }

  /**
   * Gets the current active query. This is the query that is open in the active tab.
   */
  public async getCurrentQuery(allowLibraryFiles: boolean): Promise<string> {
    const input = window.tabGroups.activeTabGroup.activeTab?.input;

    if (input === undefined || !isTabInputText(input)) {
      throw new Error(
        "No query was selected. Please select a query and try again.",
      );
    }

    return validateQueryUri(input.uri, allowLibraryFiles);
  }

  private async createSkeletonQuery(): Promise<void> {
    await withProgress(
      async (progress: ProgressCallback) => {
        const language = this.languageContextStore.selectedLanguage;
        const skeletonQueryWizard = new SkeletonQueryWizard(
          this.cliServer,
          progress,
          this.app,
          this.databaseManager,
          this.databaseFetcher,
          this.selectedQueryTreeViewItems,
          language,
        );
        await skeletonQueryWizard.execute();
      },
      {
        title: "Create Query",
      },
    );
  }

  /**
   * Creates a new `LocalQueryRun` object to track a query evaluation. This creates a timestamp
   * file in the query's output directory, creates a `LocalQueryInfo` object, and registers that
   * object with the query history manager.
   *
   * Once the evaluation is complete, the client must call `complete()` on the `LocalQueryRun`
   * object to update the UI based on the results of the query.
   */
  public async createLocalQueryRun(
    selectedQuery: SelectedQuery,
    dbItem: DatabaseItem,
    outputDir: QueryOutputDir,
    tokenSource: CancellationTokenSource,
  ): Promise<LocalQueryRun> {
    await createTimestampFile(outputDir.querySaveDir);

    if (this.queryRunner.customLogDirectory) {
      void showAndLogWarningMessage(
        this.app.logger,
        `Custom log directories are no longer supported. The "codeQL.runningQueries.customLogDirectory" setting is deprecated. Unset the setting to stop seeing this message. Query logs saved to ${outputDir.logPath}`,
      );
    }

    const initialInfo = await createInitialQueryInfo(
      selectedQuery,
      {
        databaseUri: dbItem.databaseUri.toString(),
        name: dbItem.name,
        language: tryGetQueryLanguage(dbItem.language),
      },
      outputDir,
    );

    // When cancellation is requested from the query history view, we just stop the debug session.
    const queryInfo = new LocalQueryInfo(initialInfo, tokenSource);
    this.queryHistoryManager.addQuery(queryInfo);

    const logger = new TeeLogger(this.queryRunner.logger, outputDir.logPath);
    return new LocalQueryRun(
      outputDir,
      this,
      queryInfo,
      dbItem,
      logger,
      this.queryHistoryManager,
      this.cliServer,
    );
  }

  public async compileAndRunQuery(
    quickEval: QuickEvalType,
    queryUri: Uri | undefined,
    progress: ProgressCallback,
    token: CancellationToken,
    databaseItem: DatabaseItem | undefined,
    range?: Range,
    templates?: Record<string, string>,
  ): Promise<void> {
    await this.compileAndRunQueryInternal(
      quickEval,
      queryUri,
      progress,
      token,
      databaseItem,
      range,
      templates,
    );
  }

  /** Used by tests */
  public async compileAndRunQueryInternal(
    quickEval: QuickEvalType,
    queryUri: Uri | undefined,
    progress: ProgressCallback,
    token: CancellationToken,
    databaseItem: DatabaseItem | undefined,
    range?: Range,
    templates?: Record<string, string>,
  ): Promise<CoreCompletedQuery> {
    await saveBeforeStart();

    let queryPath: string;
    if (queryUri !== undefined) {
      // The query URI is provided by the command, most likely because the command was run from an
      // editor context menu. Use the provided URI, but make sure it's a valid query.
      queryPath = validateQueryUri(queryUri, quickEval !== QuickEvalType.None);
    } else {
      // Use the currently selected query.
      queryPath = await this.getCurrentQuery(quickEval !== QuickEvalType.None);
    }

    const selectedQuery: SelectedQuery = {
      queryPath,
      quickEval: quickEval
        ? await getQuickEvalContext(
            range,
            quickEval === QuickEvalType.QuickEvalCount,
          )
        : undefined,
    };

    // If no databaseItem is specified, use the database currently selected in the Databases UI
    databaseItem =
      databaseItem ?? (await this.databaseUI.getDatabaseItem(progress));
    if (databaseItem === undefined) {
      throw new Error("Can't run query without a selected database");
    }

    const additionalPacks = getOnDiskWorkspaceFolders();
    const extensionPacks = await this.getDefaultExtensionPacks(additionalPacks);

    const coreQueryRun = this.queryRunner.createQueryRun(
      databaseItem.databaseUri.fsPath,
      {
        queryPath: selectedQuery.queryPath,
        quickEvalPosition: selectedQuery.quickEval?.quickEvalPosition,
        quickEvalCountOnly: selectedQuery.quickEval?.quickEvalCount,
      },
      true,
      additionalPacks,
      extensionPacks,
      {},
      this.queryStorageDir,
      undefined,
      templates,
    );

    // handle cancellation from the history view.
    const source = new CancellationTokenSource();
    try {
      token.onCancellationRequested(() => source.cancel());

      const localQueryRun = await this.createLocalQueryRun(
        selectedQuery,
        databaseItem,
        coreQueryRun.outputDir,
        source,
      );

      try {
        const results = await coreQueryRun.evaluate(
          progress,
          source.token,
          localQueryRun.logger,
        );

        await localQueryRun.complete(results, progress);

        return results;
      } catch (e) {
        // It's odd that we have two different ways for a query evaluation to fail: by throwing an
        // exception, and by returning a result with a failure code. This is how the code worked
        // before the refactoring, so it's been preserved, but we should probably figure out how
        // to unify both error handling paths.
        const err = asError(e);
        await localQueryRun.fail(err);

        if (token.isCancellationRequested) {
          throw new UserCancellationException(err.message, true);
        } else {
          throw e;
        }
      }
    } finally {
      source.dispose();
    }
  }

  private async compileAndRunQueryOnMultipleDatabases(
    progress: ProgressCallback,
    token: CancellationToken,
    uri: Uri | undefined,
  ): Promise<void> {
    let filteredDBs = this.databaseManager.databaseItems;
    if (filteredDBs.length === 0) {
      void showAndLogErrorMessage(
        this.app.logger,
        "No databases found. Please add a suitable database to your workspace.",
      );
      return;
    }
    // If possible, only show databases with the right language (otherwise show all databases).
    const queryLanguage = await findLanguage(this.cliServer, uri);
    if (queryLanguage) {
      filteredDBs = this.databaseManager.databaseItems.filter(
        (db) => db.language === queryLanguage,
      );
      if (filteredDBs.length === 0) {
        void showAndLogErrorMessage(
          this.app.logger,
          `No databases found for language ${queryLanguage}. Please add a suitable database to your workspace.`,
        );
        return;
      }
    }
    const quickPickItems = filteredDBs.map<DatabaseQuickPickItem>((dbItem) => ({
      databaseItem: dbItem,
      label: dbItem.name,
      description: dbItem.language,
    }));
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
          await this.compileAndRunQuery(
            QuickEvalType.None,
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
        void this.app.logger.log(`Errors:\n${errors.join("\n")}`);
        void showAndLogWarningMessage(
          this.app.logger,
          `The following databases were skipped:\n${skippedDatabases.join(
            "\n",
          )}.\nFor details about the errors, see the logs.`,
        );
      }
    } else {
      void showAndLogErrorMessage(this.app.logger, "No databases selected.");
    }
  }

  public async showResultsForCompletedQuery(
    query: CompletedLocalQueryInfo,
    forceReveal: WebviewReveal,
  ): Promise<void> {
    await this.localQueryResultsView.showResults(query, forceReveal, false);
  }

  public async getDefaultExtensionPacks(
    additionalPacks: string[],
  ): Promise<string[]> {
    return this.cliServer.useExtensionPacks()
      ? Object.keys(await this.cliServer.resolveQlpacks(additionalPacks, true))
      : [];
  }
}

function isTabInputText(input: unknown): input is TabInputText {
  return (
    input !== null &&
    typeof input === "object" &&
    "uri" in input &&
    input?.uri !== undefined
  );
}
