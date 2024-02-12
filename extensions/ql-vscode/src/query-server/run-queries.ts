import type { CancellationToken } from "vscode";
import type { ProgressCallback } from "../common/vscode/progress";
import type { RunQueryParams } from "./messages";
import { runQuery } from "./messages";
import type { QueryOutputDir } from "../local-queries/query-output-dir";
import type { QueryServerClient } from "./query-server-client";
import type { CoreQueryResults, CoreQueryTarget } from "./query-runner";
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
  query: CoreQueryTarget,
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
  const target =
    query.quickEvalPosition !== undefined
      ? {
          quickEval: {
            quickEvalPos: query.quickEvalPosition,
            countOnly: query.quickEvalCountOnly,
          },
        }
      : { query: {} };

  const evalLogPath = generateEvalLog ? outputDir.evalLogPath : undefined;
  const queryToRun: RunQueryParams = {
    db: dbPath,
    additionalPacks,
    externalInputs: {},
    singletonExternalInputs: templates || {},
    outputPath: outputDir.bqrsPath,
    queryPath: query.queryPath,
    dilPath: outputDir.dilPath,
    logPath: evalLogPath,
    target,
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
    resultType: result.resultType,
    message: result.message,
    evaluationTime: result.evaluationTime,
  };
}
