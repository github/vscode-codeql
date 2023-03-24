import { CancellationToken } from "vscode";
import { CodeQLCliServer } from "./cli";
import { ProgressCallback } from "./progress";
import { DatabaseItem } from "./local-databases";
import { InitialQueryInfo, LocalQueryInfo } from "./query-results";
import {
  EvaluatorLogPaths,
  generateEvalLogSummaries,
  logEndSummary,
  QueryEvaluationInfo,
  QueryOutputDir,
  QueryWithResults,
} from "./run-queries-shared";
import { Position, QueryResultType } from "./pure/new-messages";
import {
  createTimestampFile,
  getOnDiskWorkspaceFolders,
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
  tryGetQueryMetadata,
} from "./helpers";
import { basename, join } from "path";
import { BaseLogger, extLogger, Logger, TeeLogger } from "./common";
import { redactableError } from "./pure/errors";
import { nanoid } from "nanoid";

export interface CoreQueryTarget {
  /** The full path to the query. */
  queryPath: string;
  /**
   * Optional position of text to be used as QuickEval target. This need not be in the same file as
   * `query`.
   */
  quickEvalPosition?: Position;
}

export interface CoreQueryResults {
  readonly resultType: QueryResultType;
  readonly message: string | undefined;
  readonly evaluationTime: number;
}

export interface CoreQueryRun {
  readonly queryTarget: CoreQueryTarget;
  readonly dbPath: string;
  readonly id: string;
  readonly outputDir: QueryOutputDir;

  evaluate(
    progress: ProgressCallback,
    token: CancellationToken,
    logger: BaseLogger,
  ): Promise<CoreCompletedQuery>;
}

/** Includes both the results of the query and the initial information from `CoreQueryRun`. */
export type CoreCompletedQuery = CoreQueryResults &
  Omit<CoreQueryRun, "evaluate">;

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

export abstract class QueryRunner {
  abstract restartQueryServer(
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void>;

  abstract cliServer: CodeQLCliServer;
  abstract customLogDirectory: string | undefined;
  abstract logger: Logger;

  abstract onStart(
    arg0: (
      progress: ProgressCallback,
      token: CancellationToken,
    ) => Promise<void>,
  ): void;
  abstract clearCacheInDatabase(
    dbItem: DatabaseItem,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void>;

  public async compileAndRunQueryAgainstDatabase(
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
    const queryRun = this.createQueryRun(
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
    if (this.customLogDirectory) {
      void showAndLogWarningMessage(
        `Custom log directories are no longer supported. The "codeQL.runningQueries.customLogDirectory" setting is deprecated. Unset the setting to stop seeing this message. Query logs saved to ${logPath}`,
      );
    }

    const logger = new TeeLogger(this.logger, logPath);
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

  /**
   * Create a `CoreQueryRun` object. This creates an object whose `evaluate()` function can be
   * called to actually evaluate the query. The returned object also contains information about the
   * query evaluation that is known even before evaluation starts, including the unique ID of the
   * evaluation and the path to its output directory.
   */
  public createQueryRun(
    dbPath: string,
    query: CoreQueryTarget,
    generateEvalLog: boolean,
    additionalPacks: string[],
    queryStorageDir: string,
    id: string | undefined,
    templates: Record<string, string> | undefined,
  ): CoreQueryRun {
    const actualId = id ?? `${basename(query.queryPath)}-${nanoid()}`;
    const outputDir = new QueryOutputDir(join(queryStorageDir, actualId));

    return {
      queryTarget: query,
      dbPath,
      id: actualId,
      outputDir,
      evaluate: async (
        progress: ProgressCallback,
        token: CancellationToken,
        logger: BaseLogger,
      ): Promise<CoreCompletedQuery> => {
        return {
          id: actualId,
          outputDir,
          dbPath,
          queryTarget: query,
          ...(await this.compileAndRunQueryAgainstDatabaseCore(
            dbPath,
            query,
            additionalPacks,
            generateEvalLog,
            outputDir,
            progress,
            token,
            templates,
            logger,
          )),
        };
      },
    };
  }

  /**
   * Overridden in subclasses to evaluate the query via the query server and return the results.
   */
  protected abstract compileAndRunQueryAgainstDatabaseCore(
    dbPath: string,
    query: CoreQueryTarget,
    additionalPacks: string[],
    generateEvalLog: boolean,
    outputDir: QueryOutputDir,
    progress: ProgressCallback,
    token: CancellationToken,
    templates: Record<string, string> | undefined,
    logger: BaseLogger,
  ): Promise<CoreQueryResults>;

  abstract deregisterDatabase(
    progress: ProgressCallback,
    token: CancellationToken,
    dbItem: DatabaseItem,
  ): Promise<void>;

  abstract registerDatabase(
    progress: ProgressCallback,
    token: CancellationToken,
    dbItem: DatabaseItem,
  ): Promise<void>;

  abstract upgradeDatabaseExplicit(
    dbItem: DatabaseItem,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void>;

  abstract clearPackCache(): Promise<void>;
}
