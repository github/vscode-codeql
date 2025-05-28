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
  targets: CoreQueryTarget[],
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
  if (targets.length > 1) {
    // We are running a batch of multiple queries; use the new query server API for that.
    if (targets.some((target) => target.quickEvalPosition !== undefined)) {
      throw new Error(
        "Quick evaluation is not supported when running multiple queries.",
      );
    }
    return compileAndRunQueriesAgainstDatabaseCore(
      qs,
      dbPath,
      targets,
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

  const target = targets[0];
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
    queryPath: target.queryPath,
    outputPath: outputDir.getBqrsPath(target.outputBaseName),
    dilPath: outputDir.getDilPath(target.outputBaseName),
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
        target.queryPath,
        {
          resultType: result.resultType,
          message: result.message,
          evaluationTime: result.evaluationTime,
          outputBaseName: target.outputBaseName,
        },
      ],
    ]),
  };
}

async function compileAndRunQueriesAgainstDatabaseCore(
  qs: QueryServerClient,
  dbPath: string,
  targets: CoreQueryTarget[],
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
  const inputOutputPaths: RunQueryInputOutput[] = targets.map((target) => {
    return {
      queryPath: target.queryPath,
      outputPath: outputDir.getBqrsPath(target.outputBaseName),
      dilPath: outputDir.getDilPath(target.outputBaseName),
    };
  });

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
  targets.forEach((target) => {
    const queryResult = queryResults[target.queryPath];
    coreQueryResults.set(target.queryPath, {
      resultType: queryResult.resultType,
      message: queryResult.message,
      evaluationTime: queryResult.evaluationTime,
      outputBaseName: target.outputBaseName,
    });
  });
  return {
    results: coreQueryResults,
  };
}
