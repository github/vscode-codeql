import * as tmp from "tmp-promise";
import { basename } from "path";
import { CancellationToken, Uri } from "vscode";
import { LSPErrorCodes, ResponseError } from "vscode-languageclient";

import * as cli from "../cli";
import {
  DatabaseContentsWithDbScheme,
  DatabaseItem,
  DatabaseResolver,
} from "../local-databases";
import {
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
  upgradesTmpDir,
} from "../helpers";
import { ProgressCallback } from "../progress";
import { QueryMetadata } from "../pure/interface-types";
import { extLogger, Logger } from "../common";
import * as messages from "../pure/legacy-messages";
import * as newMessages from "../pure/new-messages";
import * as qsClient from "./queryserver-client";
import { asError, getErrorMessage } from "../pure/helpers-pure";
import { compileDatabaseUpgradeSequence } from "./upgrades";
import { QueryEvaluationInfo, QueryOutputDir } from "../run-queries-shared";
import { redactableError } from "../pure/errors";
import { CoreQueryResults, CoreQueryTarget } from "../queryRunner";
import { Position } from "../pure/messages-shared";

export async function compileQuery(
  qs: qsClient.QueryServerClient,
  program: messages.QlProgram,
  quickEvalPosition: Position | undefined,
  outputDir: QueryOutputDir,
  progress: ProgressCallback,
  token: CancellationToken,
  logger: Logger,
): Promise<messages.CompilationMessage[]> {
  let compiled: messages.CheckQueryResult | undefined;
  try {
    const target: messages.CompilationTarget = quickEvalPosition
      ? {
          quickEval: { quickEvalPos: quickEvalPosition },
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
      resultPath: outputDir.compileQueryPath,
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

async function runQuery(
  qs: qsClient.QueryServerClient,
  upgradeQlo: string | undefined,
  availableMlModels: cli.MlModelInfo[],
  dbContents: DatabaseContentsWithDbScheme,
  templates: Record<string, string> | undefined,
  generateEvalLog: boolean,
  outputDir: QueryOutputDir,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<messages.EvaluationResult> {
  let result: messages.EvaluationResult | null = null;

  const logPath = outputDir.logPath;

  const callbackId = qs.registerCallback((res) => {
    result = {
      ...res,
      logFileLocation: logPath,
    };
  });

  const availableMlModelUris: messages.MlModel[] = availableMlModels.map(
    (model) => ({ uri: Uri.file(model.path).toString(true) }),
  );

  const queryToRun: messages.QueryToRun = {
    resultsPath: outputDir.bqrsPath,
    qlo: Uri.file(outputDir.compileQueryPath).toString(),
    compiledUpgrade: upgradeQlo && Uri.file(upgradeQlo).toString(),
    allowUnknownTemplates: true,
    templateValues: createSimpleTemplates(templates),
    availableMlModels: availableMlModelUris,
    id: callbackId,
    timeoutSecs: qs.config.timeoutSecs,
  };

  const dataset: messages.Dataset = {
    dbDir: dbContents.datasetUri.fsPath,
    workingSet: "default",
  };
  if (
    generateEvalLog &&
    (await qs.cliServer.cliConstraints.supportsPerQueryEvalLog())
  ) {
    await qs.sendRequest(messages.startLog, {
      db: dataset,
      logPath: outputDir.evalLogPath,
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
        `Custom log directories are no longer supported. The "codeQL.runningQueries.customLogDirectory" setting is deprecated. Unset the setting to stop seeing this message. Query logs saved to ${logPath}.`,
      );
    }
  } finally {
    qs.unRegisterCallback(callbackId);
    if (
      generateEvalLog &&
      (await qs.cliServer.cliConstraints.supportsPerQueryEvalLog())
    ) {
      await qs.sendRequest(messages.endLog, {
        db: dataset,
        logPath: outputDir.evalLogPath,
      });
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

/**
 * A collection of evaluation-time information about a query,
 * including the query itself, and where we have decided to put
 * temporary files associated with it, such as the compiled query
 * output and results.
 */
export class QueryInProgress {
  public queryEvalInfo: QueryEvaluationInfo;
  /**
   * Note that in the {@link readQueryHistoryFromFile} method, we create a QueryEvaluationInfo instance
   * by explicitly setting the prototype in order to avoid calling this constructor.
   */
  constructor(
    readonly querySaveDir: string,
    readonly dbItemPath: string,
    databaseHasMetadataFile: boolean,
    readonly queryDbscheme: string, // the dbscheme file the query expects, ba`sed on library path resolution
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
  queryDbscheme: string,
): void {
  throw new Error(
    `Query ${qlProgram.queryPath} expects database scheme ${queryDbscheme}, but the current database has a different scheme, and no database upgrades are available. The current database scheme may be newer than the CodeQL query libraries in your workspace.\n\nPlease try using a newer version of the query libraries.`,
  );
}

/**
 * Compile a non-destructive upgrade.
 */
async function compileNonDestructiveUpgrade(
  qs: qsClient.QueryServerClient,
  upgradeTemp: tmp.DirectoryResult,
  queryDbscheme: string,
  qlProgram: messages.QlProgram,
  dbContents: DatabaseContentsWithDbScheme,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<string> {
  // Dependencies may exist outside of the workspace and they are always on the resolved search path.
  const upgradesPath = qlProgram.libraryPath;

  const { scripts, matchesTarget } = await qs.cliServer.resolveUpgrades(
    dbContents.dbSchemeUri.fsPath,
    upgradesPath,
    true,
    queryDbscheme,
  );

  if (!matchesTarget) {
    reportNoUpgradePath(qlProgram, queryDbscheme);
  }
  const result = await compileDatabaseUpgradeSequence(
    qs,
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
  qlProgram.dbschemePath = queryDbscheme;
  // We are new enough that we will always support single file upgrades.
  return result.compiledUpgrade;
}

function translateLegacyResult(
  legacyResult: messages.EvaluationResult,
): Omit<CoreQueryResults, "dispose"> {
  let newResultType: newMessages.QueryResultType;
  let newMessage = legacyResult.message;
  switch (legacyResult.resultType) {
    case messages.QueryResultType.SUCCESS:
      newResultType = newMessages.QueryResultType.SUCCESS;
      break;
    case messages.QueryResultType.CANCELLATION:
      newResultType = newMessages.QueryResultType.CANCELLATION;
      break;
    case messages.QueryResultType.OOM:
      newResultType = newMessages.QueryResultType.OOM;
      break;
    case messages.QueryResultType.TIMEOUT:
      // This is the only legacy result type that doesn't exist for the new query server. Format the
      // message here, and let the later code treat it as `OTHER_ERROR`.
      newResultType = newMessages.QueryResultType.OTHER_ERROR;
      newMessage = `timed out after ${Math.round(
        legacyResult.evaluationTime / 1000,
      )} seconds`;
      break;
    case messages.QueryResultType.OTHER_ERROR:
    default:
      newResultType = newMessages.QueryResultType.OTHER_ERROR;
      break;
  }

  return {
    resultType: newResultType,
    message: newMessage,
    evaluationTime: legacyResult.evaluationTime,
  };
}

export async function compileAndRunQueryAgainstDatabaseCore(
  qs: qsClient.QueryServerClient,
  dbPath: string,
  query: CoreQueryTarget,
  generateEvalLog: boolean,
  additionalPacks: string[],
  outputDir: QueryOutputDir,
  progress: ProgressCallback,
  token: CancellationToken,
  templates: Record<string, string> | undefined,
  logger: Logger,
): Promise<CoreQueryResults> {
  const dbContents = await DatabaseResolver.resolveDatabaseContents(
    Uri.file(dbPath),
  );

  // Figure out the library path for the query.
  const packConfig = await qs.cliServer.resolveLibraryPath(
    additionalPacks,
    query.queryPath,
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
  const dbSchemaName = basename(dbContents.dbSchemeUri?.fsPath);
  if (querySchemaName !== dbSchemaName) {
    void extLogger.log(
      `Query schema was ${querySchemaName}, but database schema was ${dbSchemaName}.`,
    );
    throw new Error(
      `The query ${basename(
        query.queryPath,
      )} cannot be run against the selected database: their target languages are different. Please select a different database and try again.`,
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
    dbschemePath: dbContents.dbSchemeUri.fsPath,
    queryPath: query.queryPath,
  };

  let availableMlModels: cli.MlModelInfo[] = [];
  try {
    availableMlModels = (
      await qs.cliServer.resolveMlModels(additionalPacks, query.queryPath)
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

  let upgradeDir: tmp.DirectoryResult | undefined;
  try {
    upgradeDir = await tmp.dir({ dir: upgradesTmpDir, unsafeCleanup: true });
    const upgradeQlo = await compileNonDestructiveUpgrade(
      qs,
      upgradeDir,
      packConfig.dbscheme,
      qlProgram,
      dbContents,
      progress,
      token,
    );
    let errors;
    try {
      errors = await compileQuery(
        qs,
        qlProgram,
        query.quickEvalPosition,
        outputDir,
        progress,
        token,
        logger,
      );
    } catch (e) {
      if (
        e instanceof ResponseError &&
        e.code === LSPErrorCodes.RequestCancelled
      ) {
        return createSyntheticResult("Query cancelled");
      } else {
        throw e;
      }
    }

    if (errors.length === 0) {
      const result = await runQuery(
        qs,
        upgradeQlo,
        availableMlModels,
        dbContents,
        templates,
        generateEvalLog,
        outputDir,
        progress,
        token,
      );

      if (result.resultType !== messages.QueryResultType.SUCCESS) {
        const error = result.message
          ? redactableError`${result.message}`
          : redactableError`Failed to run query`;
        void extLogger.log(error.fullMessage);
        void showAndLogExceptionWithTelemetry(error);
      }

      return translateLegacyResult(result);
    } else {
      // Error dialogs are limited in size and scrollability,
      // so we include a general description of the problem,
      // and direct the user to the output window for the detailed compilation messages.
      // However we don't show quick eval errors there so we need to display them anyway.
      void logger.log(
        `Failed to compile query ${query.queryPath} against database scheme ${qlProgram.dbschemePath}:`,
      );

      const formattedMessages: string[] = [];

      for (const error of errors) {
        const message = error.message || "[no error message available]";
        const formatted = `ERROR: ${message} (${error.position.fileName}:${error.position.line}:${error.position.column}:${error.position.endLine}:${error.position.endColumn})`;
        formattedMessages.push(formatted);
        void logger.log(formatted);
      }

      return {
        evaluationTime: 0,
        resultType: newMessages.QueryResultType.COMPILATION_ERROR,
        message: formattedMessages[0],
      };
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
function createSyntheticResult(message: string): CoreQueryResults {
  return {
    evaluationTime: 0,
    resultType: newMessages.QueryResultType.OTHER_ERROR,
    message,
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
