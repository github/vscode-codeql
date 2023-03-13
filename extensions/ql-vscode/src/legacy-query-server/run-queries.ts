import * as tmp from "tmp-promise";
import { basename } from "path";
import { CancellationToken, Uri } from "vscode";
import { LSPErrorCodes, ResponseError } from "vscode-languageclient";

import * as cli from "../cli";
import { DatabaseItem } from "../local-databases";
import {
  createTimestampFile,
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
  tryGetQueryMetadata,
  upgradesTmpDir,
} from "../helpers";
import { ProgressCallback } from "../commandRunner";
import { QueryMetadata } from "../pure/interface-types";
import { extLogger } from "../common";
import * as messages from "../pure/legacy-messages";
import * as newMessages from "../pure/new-messages";
import { InitialQueryInfo } from "../query-results";
import * as qsClient from "./queryserver-client";
import { asError, getErrorMessage } from "../pure/helpers-pure";
import { compileDatabaseUpgradeSequence } from "./upgrades";
import {
  findQueryBqrsFile,
  findQueryEvalLogFile,
  findQueryLogFile,
  findQueryQloFile,
  QueryEvaluationInfo,
} from "../run-queries-shared";
import { redactableError } from "../pure/errors";
import { CoreQueryResults, DatabaseDetails } from "../queryRunner";
import { Position } from "../pure/messages-shared";

async function compileQuery(
  qs: qsClient.QueryServerClient,
  program: messages.QlProgram,
  quickEvalPosition: Position | undefined,
  outputDir: string,
  progress: ProgressCallback,
  token: CancellationToken,
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
      resultPath: findQueryQloFile(outputDir),
      target,
    };

    compiled = await qs.sendRequest(
      messages.compileQuery,
      params,
      token,
      progress,
    );
  } finally {
    void qs.logger.log(" - - - COMPILATION DONE - - - ", {
      additionalLogLocation: findQueryLogFile(outputDir),
    });
  }
  return (compiled?.messages || []).filter(
    (msg) => msg.severity === messages.Severity.ERROR,
  );
}

async function runQuery(
  qs: qsClient.QueryServerClient,
  upgradeQlo: string | undefined,
  availableMlModels: cli.MlModelInfo[],
  db: DatabaseDetails,
  templates: Record<string, string> | undefined,
  generateEvalLog: boolean,
  outputDir: string,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<messages.EvaluationResult> {
  let result: messages.EvaluationResult | null = null;

  const logPath = findQueryLogFile(outputDir);

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
    resultsPath: findQueryBqrsFile(outputDir),
    qlo: Uri.file(findQueryQloFile(outputDir)).toString(),
    compiledUpgrade: upgradeQlo && Uri.file(upgradeQlo).toString(),
    allowUnknownTemplates: true,
    templateValues: createSimpleTemplates(templates),
    availableMlModels: availableMlModelUris,
    id: callbackId,
    timeoutSecs: qs.config.timeoutSecs,
  };

  const dataset: messages.Dataset = {
    dbDir: db.datasetPath,
    workingSet: "default",
  };
  if (
    generateEvalLog &&
    (await qs.cliServer.cliConstraints.supportsPerQueryEvalLog())
  ) {
    await qs.sendRequest(messages.startLog, {
      db: dataset,
      logPath: findQueryEvalLogFile(outputDir),
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
        logPath: findQueryEvalLogFile(outputDir),
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
   * Note that in the {@link deserializeQueryHistory} method, we create a QueryEvaluationInfo instance
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
  db: DatabaseDetails,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<string> {
  // Dependencies may exist outside of the workspace and they are always on the resolved search path.
  const upgradesPath = qlProgram.libraryPath;

  const { scripts, matchesTarget } = await qs.cliServer.resolveUpgrades(
    db.dbSchemePath,
    upgradesPath,
    true,
    queryDbscheme,
  );

  if (!matchesTarget) {
    reportNoUpgradePath(qlProgram, queryDbscheme);
  }
  const result = await compileDatabaseUpgradeSequence(
    qs,
    db,
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
      // messasge here, and let the later code treat is as `OTHER_ERROR`.
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
  db: DatabaseDetails,
  initialInfo: InitialQueryInfo,
  generateEvalLog: boolean,
  additionalPacks: string[],
  outputDir: string,
  progress: ProgressCallback,
  token: CancellationToken,
  templates?: Record<string, string>,
): Promise<CoreQueryResults> {
  // Figure out the library path for the query.
  const packConfig = await qs.cliServer.resolveLibraryPath(
    additionalPacks,
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
  const dbSchemaName = basename(db.dbSchemePath);
  if (querySchemaName !== dbSchemaName) {
    void extLogger.log(
      `Query schema was ${querySchemaName}, but database schema was ${dbSchemaName}.`,
    );
    throw new Error(
      `The query ${basename(
        initialInfo.queryPath,
      )} cannot be run against the selected database (${
        db.name
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
    dbschemePath: db.dbSchemePath,
    queryPath: initialInfo.queryPath,
  };

  // Read the query metadata if possible, to use in the UI.
  const metadata = await tryGetQueryMetadata(qs.cliServer, qlProgram.queryPath);

  let availableMlModels: cli.MlModelInfo[] = [];
  try {
    availableMlModels = (
      await qs.cliServer.resolveMlModels(additionalPacks, initialInfo.queryPath)
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

  const hasMetadataFile = db.hasMetadataFile;
  const query = new QueryInProgress(
    outputDir,
    db.path,
    hasMetadataFile,
    packConfig.dbscheme,
    initialInfo.quickEvalPosition,
    metadata,
    templates,
  );
  await createTimestampFile(outputDir);

  let upgradeDir: tmp.DirectoryResult | undefined;
  try {
    upgradeDir = await tmp.dir({ dir: upgradesTmpDir, unsafeCleanup: true });
    const upgradeQlo = await compileNonDestructiveUpgrade(
      qs,
      upgradeDir,
      packConfig.dbscheme,
      qlProgram,
      db,
      progress,
      token,
    );
    let errors;
    try {
      errors = await compileQuery(
        qs,
        qlProgram,
        initialInfo.quickEvalPosition,
        outputDir,
        progress,
        token,
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
        db,
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

      return {
        ...translateLegacyResult(result),
        dispose: () => {
          qs.logger.removeAdditionalLogLocation(result.logFileLocation);
        },
      };
    } else {
      // Error dialogs are limited in size and scrollability,
      // so we include a general description of the problem,
      // and direct the user to the output window for the detailed compilation messages.
      // However we don't show quick eval errors there so we need to display them anyway.
      void qs.logger.log(
        `Failed to compile query ${initialInfo.queryPath} against database scheme ${qlProgram.dbschemePath}:`,
        { additionalLogLocation: query.queryEvalInfo.logPath },
      );

      const formattedMessages: string[] = [];

      for (const error of errors) {
        const message = error.message || "[no error message available]";
        const formatted = `ERROR: ${message} (${error.position.fileName}:${error.position.line}:${error.position.column}:${error.position.endLine}:${error.position.endColumn})`;
        formattedMessages.push(formatted);
        void qs.logger.log(formatted, {
          additionalLogLocation: query.queryEvalInfo.logPath,
        });
      }

      return {
        evaluationTime: 0,
        resultType: newMessages.QueryResultType.COMPILATION_ERROR,
        message: formattedMessages[0],
        dispose: () => {
          /**/
        },
      };
      /*
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
      return createSyntheticResult("Query had compilation errors");
      */
    }
  } finally {
    try {
      await upgradeDir?.cleanup();
    } catch (e) {
      void qs.logger.log(
        `Could not clean up the upgrades dir. Reason: ${getErrorMessage(e)}`,
        { additionalLogLocation: query.queryEvalInfo.logPath },
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
    dispose: () => {
      /**/
    },
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
