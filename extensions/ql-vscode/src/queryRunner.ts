import { CancellationToken } from "vscode";
import { CodeQLCliServer } from "./cli";
import { ProgressCallback } from "./commandRunner";
import { DatabaseItem } from "./local-databases";
import { InitialQueryInfo, LocalQueryInfo } from "./query-results";
import {
  findQueryEvalLogFile,
  findQueryLogFile,
  generateEvalLogSummaries,
  logEndSummary,
  QueryEvaluationInfo,
  QueryWithResults,
} from "./run-queries-shared";
import { QueryResultType } from "./pure/new-messages";
import {
  getOnDiskWorkspaceFolders,
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
  tryGetQueryMetadata,
} from "./helpers";
import { join } from "path";
import { extLogger, Logger } from "./common";
import { redactableError } from "./pure/errors";

export interface DatabaseDetails {
  path: string;
  hasMetadataFile: boolean;
  dbSchemePath: string;
  datasetPath: string;
  name: string;
}

export interface CoreQueryResults {
  readonly resultType: QueryResultType;
  readonly message: string | undefined;
  readonly evaluationTime: number;
  readonly dispose: () => void;
}

export async function validateDatabase(
  dbItem: DatabaseItem,
): Promise<DatabaseDetails> {
  if (!dbItem.contents || !dbItem.contents.dbSchemeUri) {
    throw new Error(
      `Database ${dbItem.databaseUri} does not have a CodeQL database scheme.`,
    );
  }

  if (dbItem.error) {
    throw new Error("Can't run query on invalid database.");
  }

  return {
    path: dbItem.databaseUri.fsPath,
    hasMetadataFile: await dbItem.hasMetadataFile(),
    dbSchemePath: dbItem.contents.dbSchemeUri.fsPath,
    datasetPath: dbItem.contents.datasetUri.fsPath,
    name: dbItem.name,
  };
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
    db: DatabaseDetails,
    initialInfo: InitialQueryInfo,
    queryStorageDir: string,
    progress: ProgressCallback,
    token: CancellationToken,
    templates?: Record<string, string>,
    queryInfo?: LocalQueryInfo, // May be omitted for queries not initiated by the user. If omitted we won't create a structured log for the query.
  ): Promise<QueryWithResults> {
    const outputDir = join(queryStorageDir, initialInfo.id);
    let coreResults: CoreQueryResults;
    try {
      const diskWorkspaceFolders = getOnDiskWorkspaceFolders();
      coreResults = await this.compileAndRunQueryAgainstDatabaseCore(
        db,
        initialInfo,
        queryInfo !== undefined,
        diskWorkspaceFolders,
        outputDir,
        progress,
        token,
        templates,
      );
      if (this.customLogDirectory) {
        void showAndLogWarningMessage(
          `Custom log directories are no longer supported. The "codeQL.runningQueries.customLogDirectory" setting is deprecated. Unset the setting to stop seeing this message. Query logs saved to ${findQueryLogFile(
            outputDir,
          )}.`,
        );
      }
    } finally {
      if (queryInfo) {
        const logPaths = await generateEvalLogSummaries(
          this.cliServer,
          outputDir,
        );
        if (logPaths !== undefined) {
          if (logPaths.endSummary !== undefined) {
            void logEndSummary(
              logPaths.endSummary,
              this.logger,
              findQueryLogFile(outputDir),
            ); // Logged asynchrnously
          }
          queryInfo.setEvaluatorLogPaths(logPaths);
        } else {
          void showAndLogWarningMessage(
            `Failed to write structured evaluator log to ${findQueryEvalLogFile(
              outputDir,
            )}.`,
          );
        }
      }
    }

    // Read the query metadata if possible, to use in the UI.
    const metadata = await tryGetQueryMetadata(
      this.cliServer,
      initialInfo.queryPath,
    );
    const query = new QueryEvaluationInfo(
      outputDir,
      db.path,
      db.hasMetadataFile,
      initialInfo.quickEvalPosition,
      metadata,
    );

    if (coreResults.resultType !== QueryResultType.SUCCESS) {
      const message = coreResults.message
        ? redactableError`${coreResults.message}`
        : redactableError`Failed to run query`;
      void extLogger.log(message.fullMessage);
      void showAndLogExceptionWithTelemetry(
        redactableError`Failed to run query: ${message}`,
      );
    }
    const message = formatResultMessage(coreResults);
    const successful = coreResults.resultType === QueryResultType.SUCCESS;
    return {
      query,
      result: {
        evaluationTime: coreResults.evaluationTime,
        queryId: 0,
        resultType: successful
          ? QueryResultType.SUCCESS
          : QueryResultType.OTHER_ERROR,
        runId: 0,
        message,
      },
      message,
      successful,
      dispose: coreResults.dispose,
    };
  }

  protected abstract compileAndRunQueryAgainstDatabaseCore(
    db: DatabaseDetails,
    initialInfo: InitialQueryInfo,
    generateEvalLog: boolean,
    additionalPacks: string[],
    outputDir: string,
    progress: ProgressCallback,
    token: CancellationToken,
    templates?: Record<string, string>,
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
