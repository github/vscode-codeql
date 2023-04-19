import { CancellationToken } from "vscode";
import { ProgressCallback } from "../progress";
import * as messages from "../pure/new-messages";
import { QueryOutputDir } from "../run-queries-shared";
import * as qsClient from "./query-server-client";
import { CoreQueryResults, CoreQueryTarget } from "./queryRunner";
import { Logger } from "../common";

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
  qs: qsClient.QueryServerClient,
  dbPath: string,
  query: CoreQueryTarget,
  generateEvalLog: boolean,
  additionalPacks: string[],
  extensionPacks: string[] | undefined,
  outputDir: QueryOutputDir,
  progress: ProgressCallback,
  token: CancellationToken,
  templates: Record<string, string> | undefined,
  logger: Logger,
): Promise<CoreQueryResults> {
  const target =
    query.quickEvalPosition !== undefined
      ? {
          quickEval: { quickEvalPos: query.quickEvalPosition },
        }
      : { query: {} };

  const evalLogPath = generateEvalLog ? outputDir.evalLogPath : undefined;
  const queryToRun: messages.RunQueryParams = {
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
  };

  // Update the active query logger every time there is a new request to compile.
  // This isn't ideal because in situations where there are queries running
  // in parallel, each query's log messages are interleaved. Fixing this
  // properly will require a change in the query server.
  qs.activeQueryLogger = logger;
  const result = await qs.sendRequest(
    messages.runQuery,
    queryToRun,
    token,
    progress,
  );

  return {
    resultType: result.resultType,
    message: result.message,
    evaluationTime: result.evaluationTime,
  };
}
