import type { CancellationToken } from "vscode";
import type { ProgressCallback } from "../common/vscode/progress";
import type {
  RunQueryParams,
  RunQueryResult,
  RunQueriesParams,
  RunQueryInputOutput,
} from "./messages";
import { runQueries, runQuery } from "./messages";
import type { QueryOutputDir } from "../local-queries/query-output-dir";
import type { QueryServerClient } from "./query-server-client";
import type {
  CoreQueryResult,
  CoreQueryResults,
  CoreQueryTarget,
} from "./query-runner";
import type { BaseLogger } from "../common/logging";

/**
 * run-queries.ts
 * --------------
 *
 * Compiling and running QL queries.
 */

/**
 * A collection of evaluation-time information about a query,
 * including the query itself, and where we have decided to put
 * temporary files associated with it, such as the compiled query
 * output and results.
 */

export async function compileAndRunQueryAgainstDatabaseCore(
  qs: QueryServerClient,
  dbPath: string,
  target: CoreQueryTarget,
  generateEvalLog: boolean,
  additionalPacks: string[],
  extensionPacks: string[] | undefined,
  additionalRunQueryArgs: Record<string, unknown>,
  outputDir: QueryOutputDir,
  progress: ProgressCallback,
  token: CancellationToken,
  templates: Record<string, string> | undefined,
  logger: BaseLogger,
): Promise<CoreQueryResults> {
  if (target.queryInputsOutputs.length > 1) {
    // We are running a batch of multiple queries; use the new query server API for that.
    if (target.quickEvalPosition !== undefined) {
      throw new Error(
        "Quick evaluation is not supported when running multiple queries.",
      );
    }
    return compileAndRunQueriesAgainstDatabaseCore(
      qs,
      dbPath,
      target,
      generateEvalLog,
      additionalPacks,
      extensionPacks,
      additionalRunQueryArgs,
      outputDir,
      progress,
      token,
      templates,
      logger,
    );
  }

  const queryInputOutput = target.queryInputsOutputs[0];
  const compilationTarget =
    target.quickEvalPosition !== undefined
      ? {
          quickEval: {
            quickEvalPos: target.quickEvalPosition,
            countOnly: target.quickEvalCountOnly,
          },
        }
      : { query: {} };

  const evalLogPath = generateEvalLog ? outputDir.evalLogPath : undefined;
  const queryToRun: RunQueryParams = {
    db: dbPath,
    additionalPacks,
    externalInputs: {},
    singletonExternalInputs: templates || {},
    queryPath: queryInputOutput.queryPath,
    outputPath: outputDir.getBqrsPath(queryInputOutput.outputBaseName),
    dilPath: outputDir.getDilPath(queryInputOutput.outputBaseName),
    logPath: evalLogPath,
    target: compilationTarget,
    extensionPacks,
    // Add any additional arguments without interpretation.
    ...additionalRunQueryArgs,
  };

  // Update the active query logger every time there is a new request to compile.
  // This isn't ideal because in situations where there are queries running
  // in parallel, each query's log messages are interleaved. Fixing this
  // properly will require a change in the query server.
  qs.activeQueryLogger = logger;
  const result = await qs.sendRequest(runQuery, queryToRun, token, progress);
  return {
    results: new Map<string, CoreQueryResult>([
      [
        queryInputOutput.queryPath,
        {
          resultType: result.resultType,
          message: result.message,
          evaluationTime: result.evaluationTime,
          outputBaseName: queryInputOutput.outputBaseName,
        },
      ],
    ]),
  };
}

async function compileAndRunQueriesAgainstDatabaseCore(
  qs: QueryServerClient,
  dbPath: string,
  target: CoreQueryTarget,
  generateEvalLog: boolean,
  additionalPacks: string[],
  extensionPacks: string[] | undefined,
  additionalRunQueryArgs: Record<string, unknown>,
  outputDir: QueryOutputDir,
  progress: ProgressCallback,
  token: CancellationToken,
  templates: Record<string, string> | undefined,
  logger: BaseLogger,
): Promise<CoreQueryResults> {
  if (!(await qs.supportsRunQueriesMethod())) {
    throw new Error(
      "The CodeQL CLI does not support the 'evaluation/runQueries' query-server command. Please update to the latest version.",
    );
  }
  const inputOutputPaths: RunQueryInputOutput[] = target.queryInputsOutputs.map(
    (qio) => {
      return {
        queryPath: qio.queryPath,
        outputPath: outputDir.getBqrsPath(qio.outputBaseName),
        dilPath: outputDir.getDilPath(qio.outputBaseName),
      };
    },
  );

  const evalLogPath = generateEvalLog ? outputDir.evalLogPath : undefined;
  const queriesToRun: RunQueriesParams = {
    db: dbPath,
    additionalPacks,
    externalInputs: {},
    singletonExternalInputs: templates || {},
    inputOutputPaths,
    logPath: evalLogPath,
    extensionPacks,
    // Add any additional arguments without interpretation.
    ...additionalRunQueryArgs,
  };

  // Update the active query logger every time there is a new request to compile.
  // This isn't ideal because in situations where there are queries running
  // in parallel, each query's log messages are interleaved. Fixing this
  // properly will require a change in the query server.
  qs.activeQueryLogger = logger;
  const queryResults: Record<string, RunQueryResult> = await qs.sendRequest(
    runQueries,
    queriesToRun,
    token,
    progress,
  );
  const coreQueryResults = new Map<string, CoreQueryResult>();
  target.queryInputsOutputs.forEach((qio) => {
    const queryResult = queryResults[qio.queryPath];
    coreQueryResults.set(qio.queryPath, {
      resultType: queryResult.resultType,
      message: queryResult.message,
      evaluationTime: queryResult.evaluationTime,
      outputBaseName: qio.outputBaseName,
    });
  });
  return {
    results: coreQueryResults,
  };
}
