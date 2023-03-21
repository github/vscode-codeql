import * as tmp from "tmp-promise";
import { basename, join } from "path";
import { CancellationToken, Uri } from "vscode";
import { LSPErrorCodes, ResponseError } from "vscode-languageclient";

import * as cli from "../cli";
import { DatabaseItem } from "../local-databases";
import {
  getOnDiskWorkspaceFolders,
  showAndLogErrorMessage,
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
  tryGetQueryMetadata,
  upgradesTmpDir,
} from "../helpers";
import { ProgressCallback } from "../progress";
import { QueryMetadata } from "../pure/interface-types";
import { extLogger, Logger, TeeLogger } from "../common";
import * as messages from "../pure/legacy-messages";
import { InitialQueryInfo, LocalQueryInfo } from "../query-results";
import * as qsClient from "./queryserver-client";
import { asError, getErrorMessage } from "../pure/helpers-pure";
import { compileDatabaseUpgradeSequence } from "./upgrades";
import { QueryEvaluationInfo, QueryWithResults } from "../run-queries-shared";
import { redactableError } from "../pure/errors";

/**
 * A collection of evaluation-time information about a query,
 * including the query itself, and where we have decided to put
 * temporary files associated with it, such as the compiled query
 * output and results.
 */
export class QueryInProgress {
  public queryEvalInfo: QueryEvaluationInfo;
  /**
   * Note that in the {@link readFromQueryHistoryFile} method, we create a QueryEvaluationInfo instance
   * by explicitly setting the prototype in order to avoid calling this constructor.
   */
  constructor(
    readonly querySaveDir: string,
    readonly dbItemPath: string,
    databaseHasMetadataFile: boolean,
    readonly queryDbscheme: string, // the dbscheme file the query expects, based on library path resolution
    readonly quickEvalPosition?: messages.Position,
    readonly metadata?: QueryMetadata,
    readonly templates?: Record<string, string>,
  ) {
    this.queryEvalInfo = new QueryEvaluationInfo(
      querySaveDir,
      dbItemPath,
      databaseHasMetadataFile,
      quickEvalPosition,
      metadata,
    );
    /**/
  }

  get compiledQueryPath() {
    return this.queryEvalInfo.compileQueryPath;
  }

  async run(
    qs: qsClient.QueryServerClient,
    upgradeQlo: string | undefined,
    availableMlModels: cli.MlModelInfo[],
    dbItem: DatabaseItem,
    progress: ProgressCallback,
    token: CancellationToken,
    logger: Logger,
    queryInfo: LocalQueryInfo | undefined,
  ): Promise<messages.EvaluationResult> {
    if (!dbItem.contents || dbItem.error) {
      throw new Error("Can't run query on invalid database.");
    }

    let result: messages.EvaluationResult | null = null;

    const callbackId = qs.registerCallback((res) => {
      result = {
        ...res,
        logFileLocation: this.queryEvalInfo.logPath,
      };
    });

    const availableMlModelUris: messages.MlModel[] = availableMlModels.map(
      (model) => ({ uri: Uri.file(model.path).toString(true) }),
    );

    const queryToRun: messages.QueryToRun = {
      resultsPath: this.queryEvalInfo.resultsPaths.resultsPath,
      qlo: Uri.file(this.compiledQueryPath).toString(),
      compiledUpgrade: upgradeQlo && Uri.file(upgradeQlo).toString(),
      allowUnknownTemplates: true,
      templateValues: createSimpleTemplates(this.templates),
      availableMlModels: availableMlModelUris,
      id: callbackId,
      timeoutSecs: qs.config.timeoutSecs,
    };

    const dataset: messages.Dataset = {
      dbDir: dbItem.contents.datasetUri.fsPath,
      workingSet: "default",
    };
    if (
      queryInfo &&
      (await qs.cliServer.cliConstraints.supportsPerQueryEvalLog())
    ) {
      await qs.sendRequest(messages.startLog, {
        db: dataset,
        logPath: this.queryEvalInfo.evalLogPath,
      });
    }
    const params: messages.EvaluateQueriesParams = {
      db: dataset,
      evaluateId: callbackId,
      queries: [queryToRun],
      stopOnError: false,
      useSequenceHint: false,
    };
    try {
      await qs.sendRequest(messages.runQueries, params, token, progress);
      if (qs.config.customLogDirectory) {
        void showAndLogWarningMessage(
          `Custom log directories are no longer supported. The "codeQL.runningQueries.customLogDirectory" setting is deprecated. Unset the setting to stop seeing this message. Query logs saved to ${this.queryEvalInfo.logPath}.`,
        );
      }
    } finally {
      qs.unRegisterCallback(callbackId);
      if (
        queryInfo &&
        (await qs.cliServer.cliConstraints.supportsPerQueryEvalLog())
      ) {
        await qs.sendRequest(messages.endLog, {
          db: dataset,
          logPath: this.queryEvalInfo.evalLogPath,
        });
        if (await this.queryEvalInfo.hasEvalLog()) {
          await this.queryEvalInfo.addQueryLogs(
            queryInfo,
            qs.cliServer,
            logger,
          );
        } else {
          void showAndLogWarningMessage(
            `Failed to write structured evaluator log to ${this.queryEvalInfo.evalLogPath}.`,
          );
        }
      }
    }
    return (
      result || {
        evaluationTime: 0,
        message: "No result from server",
        queryId: -1,
        runId: callbackId,
        resultType: messages.QueryResultType.OTHER_ERROR,
      }
    );
  }

  async compile(
    qs: qsClient.QueryServerClient,
    program: messages.QlProgram,
    progress: ProgressCallback,
    token: CancellationToken,
    logger: Logger,
  ): Promise<messages.CompilationMessage[]> {
    let compiled: messages.CheckQueryResult | undefined;
    try {
      const target = this.quickEvalPosition
        ? {
            quickEval: { quickEvalPos: this.quickEvalPosition },
          }
        : { query: {} };
      const params: messages.CompileQueryParams = {
        compilationOptions: {
          computeNoLocationUrls: true,
          failOnWarnings: false,
          fastCompilation: false,
          includeDilInQlo: true,
          localChecking: false,
          noComputeGetUrl: false,
          noComputeToString: false,
          computeDefaultStrings: true,
          emitDebugInfo: true,
        },
        extraOptions: {
          timeoutSecs: qs.config.timeoutSecs,
        },
        queryToCheck: program,
        resultPath: this.compiledQueryPath,
        target,
      };

      // Update the active query logger every time there is a new request to compile.
      // This isn't ideal because in situations where there are queries running
      // in parallel, each query's log messages are interleaved. Fixing this
      // properly will require a change in the query server.
      qs.activeQueryLogger = logger;
      compiled = await qs.sendRequest(
        messages.compileQuery,
        params,
        token,
        progress,
      );
    } finally {
      void logger.log(" - - - COMPILATION DONE - - - ");
    }
    return (compiled?.messages || []).filter(
      (msg) => msg.severity === messages.Severity.ERROR,
    );
  }
}

export async function clearCacheInDatabase(
  qs: qsClient.QueryServerClient,
  dbItem: DatabaseItem,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<messages.ClearCacheResult> {
  if (dbItem.contents === undefined) {
    throw new Error("Can't clear the cache in an invalid database.");
  }

  const db: messages.Dataset = {
    dbDir: dbItem.contents.datasetUri.fsPath,
    workingSet: "default",
  };

  const params: messages.ClearCacheParams = {
    dryRun: false,
    db,
  };

  return qs.sendRequest(messages.clearCache, params, token, progress);
}

function reportNoUpgradePath(
  qlProgram: messages.QlProgram,
  query: QueryInProgress,
): void {
  throw new Error(
    `Query ${qlProgram.queryPath} expects database scheme ${query.queryDbscheme}, but the current database has a different scheme, and no database upgrades are available. The current database scheme may be newer than the CodeQL query libraries in your workspace.\n\nPlease try using a newer version of the query libraries.`,
  );
}

/**
 * Compile a non-destructive upgrade.
 */
async function compileNonDestructiveUpgrade(
  qs: qsClient.QueryServerClient,
  upgradeTemp: tmp.DirectoryResult,
  query: QueryInProgress,
  qlProgram: messages.QlProgram,
  dbItem: DatabaseItem,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<string> {
  if (!dbItem?.contents?.dbSchemeUri) {
    throw new Error("Database is invalid, and cannot be upgraded.");
  }

  // Dependencies may exist outside of the workspace and they are always on the resolved search path.
  const upgradesPath = qlProgram.libraryPath;

  const { scripts, matchesTarget } = await qs.cliServer.resolveUpgrades(
    dbItem.contents.dbSchemeUri.fsPath,
    upgradesPath,
    true,
    query.queryDbscheme,
  );

  if (!matchesTarget) {
    reportNoUpgradePath(qlProgram, query);
  }
  const result = await compileDatabaseUpgradeSequence(
    qs,
    dbItem,
    scripts,
    upgradeTemp,
    progress,
    token,
  );
  if (result.compiledUpgrade === undefined) {
    const error = result.error || "[no error message available]";
    throw new Error(error);
  }
  // We can upgrade to the actual target
  qlProgram.dbschemePath = query.queryDbscheme;
  // We are new enough that we will always support single file upgrades.
  return result.compiledUpgrade;
}

export async function compileAndRunQueryAgainstDatabase(
  cliServer: cli.CodeQLCliServer,
  qs: qsClient.QueryServerClient,
  dbItem: DatabaseItem,
  initialInfo: InitialQueryInfo,
  queryStorageDir: string,
  progress: ProgressCallback,
  token: CancellationToken,
  templates?: Record<string, string>,
  queryInfo?: LocalQueryInfo, // May be omitted for queries not initiated by the user. If omitted we won't create a structured log for the query.
): Promise<QueryWithResults> {
  if (!dbItem.contents || !dbItem.contents.dbSchemeUri) {
    throw new Error(
      `Database ${dbItem.databaseUri} does not have a CodeQL database scheme.`,
    );
  }

  // Get the workspace folder paths.
  const diskWorkspaceFolders = getOnDiskWorkspaceFolders();
  // Figure out the library path for the query.
  const packConfig = await cliServer.resolveLibraryPath(
    diskWorkspaceFolders,
    initialInfo.queryPath,
  );

  if (!packConfig.dbscheme) {
    throw new Error(
      "Could not find a database scheme for this query. Please check that you have a valid qlpack.yml or codeql-pack.yml file for this query, which refers to a database scheme either in the `dbscheme` field or through one of its dependencies.",
    );
  }

  // Check whether the query has an entirely different schema from the
  // database. (Queries that merely need the database to be upgraded
  // won't trigger this check)
  // This test will produce confusing results if we ever change the name of the database schema files.
  const querySchemaName = basename(packConfig.dbscheme);
  const dbSchemaName = basename(dbItem.contents.dbSchemeUri.fsPath);
  if (querySchemaName !== dbSchemaName) {
    void extLogger.log(
      `Query schema was ${querySchemaName}, but database schema was ${dbSchemaName}.`,
    );
    throw new Error(
      `The query ${basename(
        initialInfo.queryPath,
      )} cannot be run against the selected database (${
        dbItem.name
      }): their target languages are different. Please select a different database and try again.`,
    );
  }

  const qlProgram: messages.QlProgram = {
    // The project of the current document determines which library path
    // we use. The `libraryPath` field in this server message is relative
    // to the workspace root, not to the project root.
    libraryPath: packConfig.libraryPath,
    // Since we are compiling and running a query against a database,
    // we use the database's DB scheme here instead of the DB scheme
    // from the current document's project.
    dbschemePath: dbItem.contents.dbSchemeUri.fsPath,
    queryPath: initialInfo.queryPath,
  };

  // Read the query metadata if possible, to use in the UI.
  const metadata = await tryGetQueryMetadata(cliServer, qlProgram.queryPath);

  let availableMlModels: cli.MlModelInfo[] = [];
  try {
    availableMlModels = (
      await cliServer.resolveMlModels(
        diskWorkspaceFolders,
        initialInfo.queryPath,
      )
    ).models;
    if (availableMlModels.length) {
      void extLogger.log(
        `Found available ML models at the following paths: ${availableMlModels
          .map((x) => `'${x.path}'`)
          .join(", ")}.`,
      );
    } else {
      void extLogger.log("Did not find any available ML models.");
    }
  } catch (e) {
    void showAndLogExceptionWithTelemetry(
      redactableError(
        asError(e),
      )`Couldn't resolve available ML models for ${qlProgram.queryPath}. Running the query without any ML models: ${e}.`,
    );
  }

  const hasMetadataFile = await dbItem.hasMetadataFile();
  const query = new QueryInProgress(
    join(queryStorageDir, initialInfo.id),
    dbItem.databaseUri.fsPath,
    hasMetadataFile,
    packConfig.dbscheme,
    initialInfo.quickEvalPosition,
    metadata,
    templates,
  );
  const logger = new TeeLogger(qs.logger, query.queryEvalInfo.logPath);

  await query.queryEvalInfo.createTimestampFile();

  let upgradeDir: tmp.DirectoryResult | undefined;
  try {
    upgradeDir = await tmp.dir({ dir: upgradesTmpDir, unsafeCleanup: true });
    const upgradeQlo = await compileNonDestructiveUpgrade(
      qs,
      upgradeDir,
      query,
      qlProgram,
      dbItem,
      progress,
      token,
    );
    let errors;
    try {
      errors = await query.compile(qs, qlProgram, progress, token, logger);
    } catch (e) {
      if (
        e instanceof ResponseError &&
        e.code === LSPErrorCodes.RequestCancelled
      ) {
        return createSyntheticResult(query, "Query cancelled");
      } else {
        throw e;
      }
    }

    if (errors.length === 0) {
      const result = await query.run(
        qs,
        upgradeQlo,
        availableMlModels,
        dbItem,
        progress,
        token,
        logger,
        queryInfo,
      );
      if (result.resultType !== messages.QueryResultType.SUCCESS) {
        const error = result.message
          ? redactableError`${result.message}`
          : redactableError`Failed to run query`;
        void extLogger.log(error.fullMessage);
        void showAndLogExceptionWithTelemetry(error);
      }
      const message = formatLegacyMessage(result);

      return {
        query: query.queryEvalInfo,
        message,
        result,
        successful: result.resultType === messages.QueryResultType.SUCCESS,
        logFileLocation: result.logFileLocation,
      };
    } else {
      // Error dialogs are limited in size and scrollability,
      // so we include a general description of the problem,
      // and direct the user to the output window for the detailed compilation messages.
      // However we don't show quick eval errors there so we need to display them anyway.
      void logger.log(
        `Failed to compile query ${initialInfo.queryPath} against database scheme ${qlProgram.dbschemePath}:`,
      );

      const formattedMessages: string[] = [];

      for (const error of errors) {
        const message = error.message || "[no error message available]";
        const formatted = `ERROR: ${message} (${error.position.fileName}:${error.position.line}:${error.position.column}:${error.position.endLine}:${error.position.endColumn})`;
        formattedMessages.push(formatted);
        void logger.log(formatted);
      }
      if (initialInfo.isQuickEval && formattedMessages.length <= 2) {
        // If there are more than 2 error messages, they will not be displayed well in a popup
        // and will be trimmed by the function displaying the error popup. Accordingly, we only
        // try to show the errors if there are 2 or less, otherwise we direct the user to the log.
        void showAndLogErrorMessage(
          `Quick evaluation compilation failed: ${formattedMessages.join(
            "\n",
          )}`,
        );
      } else {
        void showAndLogErrorMessage(
          (initialInfo.isQuickEval ? "Quick evaluation" : "Query") +
            compilationFailedErrorTail,
        );
      }
      return createSyntheticResult(query, "Query had compilation errors");
    }
  } finally {
    try {
      await upgradeDir?.cleanup();
    } catch (e) {
      void logger.log(
        `Could not clean up the upgrades dir. Reason: ${getErrorMessage(e)}`,
      );
    }
  }
}

const compilationFailedErrorTail =
  " compilation failed. Please make sure there are no errors in the query, the database is up to date," +
  " and the query and database use the same target language. For more details on the error, go to View > Output," +
  " and choose CodeQL Query Server from the dropdown.";

export function formatLegacyMessage(result: messages.EvaluationResult) {
  switch (result.resultType) {
    case messages.QueryResultType.CANCELLATION:
      return `cancelled after ${Math.round(
        result.evaluationTime / 1000,
      )} seconds`;
    case messages.QueryResultType.OOM:
      return "out of memory";
    case messages.QueryResultType.SUCCESS:
      return `finished in ${Math.round(result.evaluationTime / 1000)} seconds`;
    case messages.QueryResultType.TIMEOUT:
      return `timed out after ${Math.round(
        result.evaluationTime / 1000,
      )} seconds`;
    case messages.QueryResultType.OTHER_ERROR:
    default:
      return result.message ? `failed: ${result.message}` : "failed";
  }
}

/**
 * Create a synthetic result for a query that failed to compile.
 */
function createSyntheticResult(
  query: QueryInProgress,
  message: string,
): QueryWithResults {
  return {
    query: query.queryEvalInfo,
    message,
    result: {
      evaluationTime: 0,
      queryId: 0,
      resultType: messages.QueryResultType.OTHER_ERROR,
      message,
      runId: 0,
    },
    successful: false,
  };
}

function createSimpleTemplates(
  templates: Record<string, string> | undefined,
): messages.TemplateDefinitions | undefined {
  if (!templates) {
    return undefined;
  }
  const result: messages.TemplateDefinitions = {};
  for (const key of Object.keys(templates)) {
    result[key] = {
      values: {
        tuples: [[{ stringValue: templates[key] }]],
      },
    };
  }
  return result;
}
