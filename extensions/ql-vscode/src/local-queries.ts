import { ProgressCallback, ProgressUpdate, withProgress } from "./progress";
import {
  CancellationToken,
  CancellationTokenSource,
  QuickPickItem,
  Range,
  Uri,
  window,
} from "vscode";
import { BaseLogger, extLogger, Logger, TeeLogger } from "./common";
import { isCanary, MAX_QUERIES } from "./config";
import { gatherQlFiles } from "./pure/files";
import { basename } from "path";
import {
  createTimestampFile,
  findLanguage,
  getOnDiskWorkspaceFolders,
  showAndLogErrorMessage,
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
  showBinaryChoiceDialog,
  tryGetQueryMetadata,
} from "./helpers";
import { displayQuickQuery } from "./quick-query";
import {
  CoreCompletedQuery,
  CoreQueryResults,
  QueryRunner,
} from "./queryRunner";
import { QueryHistoryManager } from "./query-history/query-history-manager";
import { DatabaseUI } from "./local-databases-ui";
import { ResultsView } from "./interface";
import { DatabaseItem, DatabaseManager } from "./local-databases";
import {
  createInitialQueryInfo,
  determineSelectedQuery,
  EvaluatorLogPaths,
  generateEvalLogSummaries,
  logEndSummary,
  QueryEvaluationInfo,
  QueryOutputDir,
  QueryWithResults,
  SelectedQuery,
} from "./run-queries-shared";
import { CompletedLocalQueryInfo, LocalQueryInfo } from "./query-results";
import { WebviewReveal } from "./interface-utils";
import { asError, getErrorMessage } from "./pure/helpers-pure";
import { CodeQLCliServer } from "./cli";
import { LocalQueryCommands } from "./common/commands";
import { App } from "./common/app";
import { DisposableObject } from "./pure/disposable-object";
import { QueryResultType } from "./pure/new-messages";
import { redactableError } from "./pure/errors";
import { SkeletonQueryWizard } from "./skeleton-query-wizard";

interface DatabaseQuickPickItem extends QuickPickItem {
  databaseItem: DatabaseItem;
}

function formatResultMessage(result: CoreQueryResults): string {
  switch (result.resultType) {
    case QueryResultType.CANCELLATION:
      return `cancelled after ${Math.round(
        result.evaluationTime / 1000,
      )} seconds`;
    case QueryResultType.OOM:
      return "out of memory";
    case QueryResultType.SUCCESS:
      return `finished in ${Math.round(result.evaluationTime / 1000)} seconds`;
    case QueryResultType.COMPILATION_ERROR:
      return `compilation failed: ${result.message}`;
    case QueryResultType.OTHER_ERROR:
    default:
      return result.message ? `failed: ${result.message}` : "failed";
  }
}

/**
 * Tracks the evaluation of a local query, including its interactions with the UI.
 *
 * The client creates an instance of `LocalQueryRun` when the evaluation starts, and then invokes
 * the `complete()` function once the query has completed (successfully or otherwise).
 *
 * Having the client tell the `LocalQueryRun` when the evaluation is complete, rather than having
 * the `LocalQueryRun` manage the evaluation itself, may seem a bit clunky. It's done this way
 * because once we move query evaluation into a Debug Adapter, the debugging UI drives the
 * evaluation, and we can only respond to events from the debug adapter.
 */
export class LocalQueryRun {
  public constructor(
    private readonly outputDir: QueryOutputDir,
    private readonly localQueries: LocalQueries,
    private readonly queryInfo: LocalQueryInfo,
    private readonly dbItem: DatabaseItem,
    public readonly logger: Logger, // Public so that other clients, like the debug adapter, know where to send log output
    private readonly queryHistoryManager: QueryHistoryManager,
    private readonly cliServer: CodeQLCliServer,
  ) {}

  /**
   * Updates the UI based on the results of the query evaluation. This creates the evaluator log
   * summaries, updates the query history item for the evaluation with the results and evaluation
   * time, and displays the results view.
   *
   * This function must be called when the evaluation completes, whether the evaluation was
   * successful or not.
   * */
  public async complete(results: CoreQueryResults): Promise<void> {
    const evalLogPaths = await this.summarizeEvalLog(
      results.resultType,
      this.outputDir,
      this.logger,
    );
    if (evalLogPaths !== undefined) {
      this.queryInfo.setEvaluatorLogPaths(evalLogPaths);
    }
    const queryWithResults = await this.getCompletedQueryInfo(results);
    this.queryHistoryManager.completeQuery(this.queryInfo, queryWithResults);
    await this.localQueries.showResultsForCompletedQuery(
      this.queryInfo as CompletedLocalQueryInfo,
      WebviewReveal.Forced,
    );
    // Note we must update the query history view after showing results as the
    // display and sorting might depend on the number of results
    await this.queryHistoryManager.refreshTreeView();
  }

  /**
   * Updates the UI in the case where query evaluation throws an exception.
   */
  public async fail(err: Error): Promise<void> {
    err.message = `Error running query: ${err.message}`;
    this.queryInfo.failureReason = err.message;
    await this.queryHistoryManager.refreshTreeView();
  }

  /**
   * Generate summaries of the structured evaluator log.
   */
  private async summarizeEvalLog(
    resultType: QueryResultType,
    outputDir: QueryOutputDir,
    logger: BaseLogger,
  ): Promise<EvaluatorLogPaths | undefined> {
    const evalLogPaths = await generateEvalLogSummaries(
      this.cliServer,
      outputDir,
    );
    if (evalLogPaths !== undefined) {
      if (evalLogPaths.endSummary !== undefined) {
        void logEndSummary(evalLogPaths.endSummary, logger); // Logged asynchrnously
      }
    } else {
      // Raw evaluator log was not found. Notify the user, unless we know why it wasn't found.
      if (resultType === QueryResultType.SUCCESS) {
        void showAndLogWarningMessage(
          `Failed to write structured evaluator log to ${outputDir.evalLogPath}.`,
        );
      } else {
        // Don't bother notifying the user if there's no log. For some errors, like compilation
        // errors, we don't expect a log. For cancellations and OOM errors, whether or not we have
        // a log depends on how far execution got before termination.
      }
    }

    return evalLogPaths;
  }

  /**
   * Gets a `QueryWithResults` containing information about the evaluation of the query and its
   * result, in the form expected by the query history UI.
   */
  private async getCompletedQueryInfo(
    results: CoreQueryResults,
  ): Promise<QueryWithResults> {
    // Read the query metadata if possible, to use in the UI.
    const metadata = await tryGetQueryMetadata(
      this.cliServer,
      this.queryInfo.initialInfo.queryPath,
    );
    const query = new QueryEvaluationInfo(
      this.outputDir.querySaveDir,
      this.dbItem.databaseUri.fsPath,
      await this.dbItem.hasMetadataFile(),
      this.queryInfo.initialInfo.quickEvalPosition,
      metadata,
    );

    if (results.resultType !== QueryResultType.SUCCESS) {
      const message = results.message
        ? redactableError`Failed to run query: ${results.message}`
        : redactableError`Failed to run query`;
      void showAndLogExceptionWithTelemetry(message);
    }
    const message = formatResultMessage(results);
    const successful = results.resultType === QueryResultType.SUCCESS;
    return {
      query,
      result: {
        evaluationTime: results.evaluationTime,
        queryId: 0,
        resultType: successful
          ? QueryResultType.SUCCESS
          : QueryResultType.OTHER_ERROR,
        runId: 0,
        message,
      },
      message,
      successful,
    };
  }
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
      "codeQL.runQueries": this.runQueries.bind(this),
      "codeQL.quickEval": this.quickEval.bind(this),
      "codeQL.quickEvalContextEditor": this.quickEval.bind(this),
      "codeQL.codeLensQuickEval": this.codeLensQuickEval.bind(this),
      "codeQL.quickQuery": this.quickQuery.bind(this),
      "codeQL.createSkeletonQuery": this.createSkeletonQuery.bind(this),
    };
  }

  private async runQuery(uri: Uri | undefined): Promise<void> {
    await withProgress(
      async (progress, token) => {
        await this.compileAndRunQuery(false, uri, progress, token, undefined);
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

  private async runQueries(_: Uri | undefined, multi: Uri[]): Promise<void> {
    await withProgress(
      async (progress, token) => {
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
            this.compileAndRunQuery(
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
    );
  }

  private async quickEval(uri: Uri): Promise<void> {
    await withProgress(
      async (progress, token) => {
        await this.compileAndRunQuery(true, uri, progress, token, undefined);
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
          true,
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

  private async createSkeletonQuery(): Promise<void> {
    await withProgress(
      async (progress: ProgressCallback, token: CancellationToken) => {
        const credentials = isCanary() ? this.app.credentials : undefined;
        const skeletonQueryWizard = new SkeletonQueryWizard(
          this.cliServer,
          progress,
          credentials,
          extLogger,
          this.databaseManager,
          token,
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
    quickEval: boolean,
    queryUri: Uri | undefined,
    progress: ProgressCallback,
    token: CancellationToken,
    databaseItem: DatabaseItem | undefined,
    range?: Range,
  ): Promise<void> {
    await this.compileAndRunQueryInternal(
      quickEval,
      queryUri,
      progress,
      token,
      databaseItem,
      range,
    );
  }

  /** Used by tests */
  public async compileAndRunQueryInternal(
    quickEval: boolean,
    queryUri: Uri | undefined,
    progress: ProgressCallback,
    token: CancellationToken,
    databaseItem: DatabaseItem | undefined,
    range?: Range,
  ): Promise<CoreCompletedQuery> {
    const selectedQuery = await determineSelectedQuery(
      queryUri,
      quickEval,
      range,
    );

    // If no databaseItem is specified, use the database currently selected in the Databases UI
    databaseItem =
      databaseItem || (await this.databaseUI.getDatabaseItem(progress, token));
    if (databaseItem === undefined) {
      throw new Error("Can't run query without a selected database");
    }

    const additionalPacks = getOnDiskWorkspaceFolders();
    const extensionPacks = (await this.cliServer.useExtensionPacks())
      ? Object.keys(await this.cliServer.resolveQlpacks(additionalPacks, true))
      : undefined;

    const coreQueryRun = this.queryRunner.createQueryRun(
      databaseItem.databaseUri.fsPath,
      {
        queryPath: selectedQuery.queryPath,
        quickEvalPosition: selectedQuery.quickEvalPosition,
      },
      true,
      additionalPacks,
      extensionPacks,
      this.queryStorageDir,
      undefined,
      undefined,
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
  }

  public async showResultsForCompletedQuery(
    query: CompletedLocalQueryInfo,
    forceReveal: WebviewReveal,
  ): Promise<void> {
    await this.localQueryResultsView.showResults(query, forceReveal, false);
  }
}
