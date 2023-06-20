import {
  ProgressCallback,
  ProgressUpdate,
  withProgress,
} from "../common/vscode/progress";
import {
  CancellationToken,
  CancellationTokenSource,
  QuickPickItem,
  Range,
  Uri,
  window,
  workspace,
} from "vscode";
import {
  TeeLogger,
  showAndLogErrorMessage,
  showAndLogWarningMessage,
} from "../common/logging";
import { isCanary, MAX_QUERIES } from "../config";
import { gatherQlFiles } from "../common/files";
import { basename } from "path";
import { showBinaryChoiceDialog } from "../common/vscode/dialog";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { displayQuickQuery } from "./quick-query";
import { CoreCompletedQuery, QueryRunner } from "../query-server";
import { QueryHistoryManager } from "../query-history/query-history-manager";
import { DatabaseUI } from "../databases/local-databases-ui";
import { ResultsView } from "./results-view";
import { DatabaseItem, DatabaseManager } from "../databases/local-databases";
import {
  createInitialQueryInfo,
  createTimestampFile,
  getQuickEvalContext,
  promptUserToSaveChanges,
  QueryOutputDir,
  SelectedQuery,
  validateQueryUri,
} from "../run-queries-shared";
import { CompletedLocalQueryInfo, LocalQueryInfo } from "../query-results";
import { WebviewReveal } from "./webview";
import { asError, getErrorMessage } from "../common/helpers-pure";
import { CliVersionConstraint, CodeQLCliServer } from "../codeql-cli/cli";
import { LocalQueryCommands } from "../common/commands";
import { App } from "../common/app";
import { DisposableObject } from "../common/disposable-object";
import { SkeletonQueryWizard } from "../skeleton-query-wizard";
import { LocalQueryRun } from "./local-query-run";
import { createMultiSelectionCommand } from "../common/vscode/selection-commands";
import { findLanguage } from "../codeql-cli/query-language";
import { QueryTreeViewItem } from "../queries-panel/query-tree-view-item";

interface DatabaseQuickPickItem extends QuickPickItem {
  databaseItem: DatabaseItem;
}

/**
 * If either the query file or the quickeval file is dirty, give the user the chance to save them.
 */
async function promptToSaveQueryIfNeeded(query: SelectedQuery): Promise<void> {
  // There seems to be no way to ask VS Code to find an existing text document by name, without
  // automatically opening the document if it is not found.
  const queryUri = Uri.file(query.queryPath).toString();
  const quickEvalUri =
    query.quickEval !== undefined
      ? Uri.file(query.quickEval.quickEvalPosition.fileName).toString()
      : undefined;
  for (const openDocument of workspace.textDocuments) {
    const documentUri = openDocument.uri.toString();
    if (documentUri === queryUri || documentUri === quickEvalUri) {
      await promptUserToSaveChanges(openDocument);
    }
  }
}

export enum QuickEvalType {
  None,
  QuickEval,
  QuickEvalCount,
}

export class LocalQueries extends DisposableObject {
  public constructor(
    private readonly app: App,
    private readonly queryRunner: QueryRunner,
    private readonly queryHistoryManager: QueryHistoryManager,
    private readonly databaseManager: DatabaseManager,
    private readonly cliServer: CodeQLCliServer,
    private readonly databaseUI: DatabaseUI,
    private readonly localQueryResultsView: ResultsView,
    private readonly queryStorageDir: string,
  ) {
    super();
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
    };
  }

  private async runQueryFromQueriesPanel(
    queryTreeViewItem: QueryTreeViewItem,
  ): Promise<void> {
    await this.runQuery(Uri.file(queryTreeViewItem.path));
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
        if (!(await this.cliServer.cliConstraints.supportsQuickEvalCount())) {
          throw new Error(
            `Quick evaluation count is only supported by CodeQL CLI v${CliVersionConstraint.CLI_VERSION_WITH_QUICK_EVAL_COUNT} or later.`,
          );
        }
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
      async (progress, token) =>
        displayQuickQuery(
          this.app,
          this.cliServer,
          this.databaseUI,
          progress,
          token,
        ),
      {
        title: "Run Quick Query",
      },
    );
  }

  /**
   * Gets the current active query.
   *
   * For now, the "active query" is just whatever query is in the active text editor. Once we have a
   * propery "queries" panel, we can provide a way to select the current query there.
   */
  public async getCurrentQuery(allowLibraryFiles: boolean): Promise<string> {
    const editor = window.activeTextEditor;
    if (editor === undefined) {
      throw new Error(
        "No query was selected. Please select a query and try again.",
      );
    }

    return validateQueryUri(editor.document.uri, allowLibraryFiles);
  }

  private async createSkeletonQuery(): Promise<void> {
    await withProgress(
      async (progress: ProgressCallback) => {
        const credentials = isCanary() ? this.app.credentials : undefined;
        const contextStoragePath =
          this.app.workspaceStoragePath || this.app.globalStoragePath;
        const skeletonQueryWizard = new SkeletonQueryWizard(
          this.cliServer,
          progress,
          credentials,
          this.app.logger,
          this.databaseManager,
          contextStoragePath,
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

    const initialInfo = await createInitialQueryInfo(selectedQuery, {
      databaseUri: dbItem.databaseUri.toString(),
      name: dbItem.name,
    });

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
      databaseItem ?? (await this.databaseUI.getDatabaseItem(progress, token));
    if (databaseItem === undefined) {
      throw new Error("Can't run query without a selected database");
    }

    const additionalPacks = getOnDiskWorkspaceFolders();
    const extensionPacks = await this.getDefaultExtensionPacks(additionalPacks);

    await promptToSaveQueryIfNeeded(selectedQuery);

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

        await localQueryRun.complete(results);

        return results;
      } catch (e) {
        // It's odd that we have two different ways for a query evaluation to fail: by throwing an
        // exception, and by returning a result with a failure code. This is how the code worked
        // before the refactoring, so it's been preserved, but we should probably figure out how
        // to unify both error handling paths.
        const err = asError(e);
        await localQueryRun.fail(err);
        throw e;
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
    return (await this.cliServer.useExtensionPacks())
      ? Object.keys(await this.cliServer.resolveQlpacks(additionalPacks, true))
      : [];
  }
}
