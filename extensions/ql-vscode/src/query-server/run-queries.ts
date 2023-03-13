import { CancellationToken } from "vscode";
import { ProgressCallback } from "../commandRunner";
import { createTimestampFile } from "../helpers";
import * as messages from "../pure/new-messages";
import { InitialQueryInfo } from "../query-results";
import {
  findQueryBqrsFile,
  findQueryDilFile,
  findQueryEvalLogFile,
} from "../run-queries-shared";
import * as qsClient from "./queryserver-client";
import { CoreQueryResults, DatabaseDetails } from "../queryRunner";

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
  db: DatabaseDetails,
  initialInfo: InitialQueryInfo,
  generateEvalLog: boolean,
  additionalPacks: string[],
  outputDir: string,
  progress: ProgressCallback,
  token: CancellationToken,
  templates?: Record<string, string>,
): Promise<CoreQueryResults> {
  const target =
    initialInfo.quickEvalPosition !== undefined
      ? {
          quickEval: { quickEvalPos: initialInfo.quickEvalPosition },
        }
      : { query: {} };

  const logPath = generateEvalLog ? findQueryEvalLogFile(outputDir) : undefined;
  const queryToRun: messages.RunQueryParams = {
    db: db.path,
    additionalPacks,
    externalInputs: {},
    singletonExternalInputs: templates || {},
    outputPath: findQueryBqrsFile(outputDir),
    queryPath: initialInfo.queryPath,
    dilPath: findQueryDilFile(outputDir),
    logPath,
    target,
  };
  await createTimestampFile(outputDir);
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
    dispose: () => {
      qs.logger.removeAdditionalLogLocation(undefined);
    },
  };
}
