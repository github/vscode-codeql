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
import { MAX_QUERIES } from "./config";
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
import { CoreQueryResults, CoreQueryTarget, QueryRunner } from "./queryRunner";
import { QueryHistoryManager } from "./query-history/query-history-manager";
import { DatabaseUI } from "./local-databases-ui";
import { ResultsView } from "./interface";
import { DatabaseItem, DatabaseManager } from "./local-databases";
import {
  createInitialQueryInfo,
  EvaluatorLogPaths,
  generateEvalLogSummaries,
  logEndSummary,
  QueryEvaluationInfo,
  QueryOutputDir,
  QueryWithResults,
} from "./run-queries-shared";
import {
  CompletedLocalQueryInfo,
  InitialQueryInfo,
  LocalQueryInfo,
} from "./query-results";
import { WebviewReveal } from "./interface-utils";
import { asError, getErrorMessage } from "./pure/helpers-pure";
import { CodeQLCliServer } from "./cli";
import { LocalQueryCommands } from "./common/commands";
import { App } from "./common/app";
import { DisposableObject } from "./pure/disposable-object";
import { QueryResultType } from "./pure/new-messages";
import { redactableError } from "./pure/errors";

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

export class LocalQueryRun {
  public constructor(
    private readonly outputDir: QueryOutputDir,
    private readonly localQueries: LocalQueries,
    private readonly queryInfo: LocalQueryInfo,
    private readonly dbItem: DatabaseItem,
    public readonly logger: Logger,
  ) {}

  public async complete(results: CoreQueryResults): Promise<void> {
    const evalLogPaths = await this.localQueries.summarizeEvalLog(
      results.resultType,
      this.outputDir,
      this.logger,
    );
    if (evalLogPaths !== undefined) {
      this.queryInfo.setEvaluatorLogPaths(evalLogPaths);
    }
    const queryWithResults = await this.getCompletedQueryInfo(results);
    this.localQueries.queryHistoryManager.completeQuery(
      this.queryInfo,
      queryWithResults,
    );
    await this.localQueries.showResultsForCompletedQuery(
      this.queryInfo as CompletedLocalQueryInfo,
      WebviewReveal.Forced,
    );
    // Note we must update the query history view after showing results as the
    // display and sorting might depend on the number of results
    await this.localQueries.queryHistoryManager.refreshTreeView();
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
      this.localQueries.cliServer,
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
        ? redactableError`${results.message}`
        : redactableError`Failed to run query`;
      void extLogger.log(message.fullMessage);
      void showAndLogExceptionWithTelemetry(
        redactableError`Failed to run query: ${message}`,
      );
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
    public readonly queryHistoryManager: QueryHistoryManager,
    private readonly databaseManager: DatabaseManager,
    public readonly cliServer: CodeQLCliServer,
    private readonly databaseUI: DatabaseUI,
    private readonly localQueryResultsView: ResultsView,
    private readonly queryStorageDir: string,
  ) {
    super();
  }

  public getCommands(): LocalQueryCommands {
    const runQuery = async (uri: Uri | undefined) =>
      withProgress(
        async (progress, token) => {
          await this.compileAndRunQuery(false, uri, progress, token, undefined);
        },
        {
          title: "Running query",
          cancellable: true,
        },
      );

    const runQueryOnMultipleDatabases = async (uri: Uri | undefined) =>
      withProgress(
        async (progress, token) =>
          await this.compileAndRunQueryOnMultipleDatabases(
            progress,
            token,
            uri,
          ),
        {
          title: "Running query on selected databases",
          cancellable: true,
        },
      );

    const runQueries = async (_: Uri | undefined, multi: Uri[]) =>
      withProgress(
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
          const queryUris = files.map((path) =>
            Uri.parse(`file:${path}`, true),
          );

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

    const quickEval = async (uri: Uri) =>
      withProgress(
        async (progress, token) => {
          await this.compileAndRunQuery(true, uri, progress, token, undefined);
        },
        {
          title: "Running query",
          cancellable: true,
        },
      );

    const codeLensQuickEval = async (uri: Uri, range: Range) =>
      withProgress(
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

    const quickQuery = async () =>
      withProgress(
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

    return {
      "codeQL.runQuery": runQuery,
      "codeQL.runQueryContextEditor": runQuery,
      "codeQL.runQueryOnMultipleDatabases": runQueryOnMultipleDatabases,
      "codeQL.runQueryOnMultipleDatabasesContextEditor":
        runQueryOnMultipleDatabases,
      "codeQL.runQueries": runQueries,
      "codeQL.quickEval": quickEval,
      "codeQL.quickEvalContextEditor": quickEval,
      "codeQL.codeLensQuickEval": codeLensQuickEval,
      "codeQL.quickQuery": quickQuery,
    };
  }

  public async createLocalQueryRun(
    queryPath: string,
    quickEval: boolean,
    range: Range | undefined,
    dbItem: DatabaseItem,
    outputDir: string,
    tokenSource: CancellationTokenSource,
  ): Promise<LocalQueryRun> {
    const queryOutputDir = new QueryOutputDir(outputDir);

    await createTimestampFile(outputDir);

    const initialInfo = await createInitialQueryInfo(
      Uri.file(queryPath),
      {
        databaseUri: dbItem.databaseUri.toString(),
        name: dbItem.name,
      },
      quickEval,
      range,
    );

    // When cancellation is requested from the query history view, we just stop the debug session.
    const queryInfo = new LocalQueryInfo(initialInfo, tokenSource);
    this.queryHistoryManager.addQuery(queryInfo);

    const logger = new TeeLogger(
      this.queryRunner.logger,
      queryOutputDir.logPath,
    );
    return new LocalQueryRun(queryOutputDir, this, queryInfo, dbItem, logger);
  }

  async compileAndRunQuery(
    quickEval: boolean,
    selectedQuery: Uri | undefined,
    progress: ProgressCallback,
    token: CancellationToken,
    databaseItem: DatabaseItem | undefined,
    range?: Range,
  ): Promise<void> {
    if (this.queryRunner !== undefined) {
      // If no databaseItem is specified, use the database currently selected in the Databases UI
      databaseItem =
        databaseItem ||
        (await this.databaseUI.getDatabaseItem(progress, token));
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
      this.queryHistoryManager.addQuery(item);
      try {
        const completedQueryInfo = await this.compileAndRunQueryAgainstDatabase(
          databaseItem,
          initialInfo,
          this.queryStorageDir,
          progress,
          source.token,
          undefined,
          item,
        );
        this.queryHistoryManager.completeQuery(item, completedQueryInfo);
        await this.showResultsForCompletedQuery(
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
        await this.queryHistoryManager.refreshTreeView();
        source.dispose();
      }
    }
  }

  async compileAndRunQueryOnMultipleDatabases(
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

  async showResultsForCompletedQuery(
    query: CompletedLocalQueryInfo,
    forceReveal: WebviewReveal,
  ): Promise<void> {
    await this.localQueryResultsView.showResults(query, forceReveal, false);
  }

  async compileAndRunQueryAgainstDatabase(
    db: DatabaseItem,
    initialInfo: InitialQueryInfo,
    queryStorageDir: string,
    progress: ProgressCallback,
    token: CancellationToken,
    templates?: Record<string, string>,
    queryInfo?: LocalQueryInfo, // May be omitted for queries not initiated by the user. If omitted we won't create a structured log for the query.
  ): Promise<QueryWithResults> {
    const queryTarget: CoreQueryTarget = {
      queryPath: initialInfo.queryPath,
      quickEvalPosition: initialInfo.quickEvalPosition,
    };

    const diskWorkspaceFolders = getOnDiskWorkspaceFolders();
    const queryRun = this.queryRunner.createQueryRun(
      db.databaseUri.fsPath,
      queryTarget,
      queryInfo !== undefined,
      diskWorkspaceFolders,
      queryStorageDir,
      initialInfo.id,
      templates,
    );

    await createTimestampFile(queryRun.outputDir.querySaveDir);

    const logPath = queryRun.outputDir.logPath;
    if (this.queryRunner.customLogDirectory) {
      void showAndLogWarningMessage(
        `Custom log directories are no longer supported. The "codeQL.runningQueries.customLogDirectory" setting is deprecated. Unset the setting to stop seeing this message. Query logs saved to ${logPath}`,
      );
    }

    const logger = new TeeLogger(this.queryRunner.logger, logPath);
    const coreResults = await queryRun.evaluate(progress, token, logger);
    if (queryInfo !== undefined) {
      const evalLogPaths = await this.summarizeEvalLog(
        coreResults.resultType,
        queryRun.outputDir,
        logger,
      );
      if (evalLogPaths !== undefined) {
        queryInfo.setEvaluatorLogPaths(evalLogPaths);
      }
    }

    return await this.getCompletedQueryInfo(
      db,
      queryTarget,
      queryRun.outputDir,
      coreResults,
    );
  }

  /**
   * Generate summaries of the structured evaluator log.
   */
  public async summarizeEvalLog(
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
      switch (resultType) {
        case QueryResultType.COMPILATION_ERROR:
        case QueryResultType.DBSCHEME_MISMATCH_NAME:
        case QueryResultType.DBSCHEME_NO_UPGRADE:
          // In these cases, the evaluator was never invoked anyway, so don't bother warning.
          break;

        default:
          void showAndLogWarningMessage(
            `Failed to write structured evaluator log to ${outputDir.evalLogPath}.`,
          );
          break;
      }
    }

    return evalLogPaths;
  }

  /**
   * Gets a `QueryWithResults` containing information about the evaluation of the query and its
   * result, in the form expected by the query history UI.
   */
  public async getCompletedQueryInfo(
    dbItem: DatabaseItem,
    queryTarget: CoreQueryTarget,
    outputDir: QueryOutputDir,
    results: CoreQueryResults,
  ): Promise<QueryWithResults> {
    // Read the query metadata if possible, to use in the UI.
    const metadata = await tryGetQueryMetadata(
      this.cliServer,
      queryTarget.queryPath,
    );
    const query = new QueryEvaluationInfo(
      outputDir.querySaveDir,
      dbItem.databaseUri.fsPath,
      await dbItem.hasMetadataFile(),
      queryTarget.quickEvalPosition,
      metadata,
    );

    if (results.resultType !== QueryResultType.SUCCESS) {
      const message = results.message
        ? redactableError`${results.message}`
        : redactableError`Failed to run query`;
      void extLogger.log(message.fullMessage);
      void showAndLogExceptionWithTelemetry(
        redactableError`Failed to run query: ${message}`,
      );
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
