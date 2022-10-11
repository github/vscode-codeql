import * as path from 'path';
import {
  CancellationToken
} from 'vscode';
import * as cli from '../cli';
import { ProgressCallback } from '../commandRunner';
import { DatabaseItem } from '../databases';
import {
  getOnDiskWorkspaceFolders,
  showAndLogErrorMessage,
  showAndLogWarningMessage,
  tryGetQueryMetadata
} from '../helpers';
import { logger } from '../logging';
import * as messages from '../pure/new-messages';
import * as legacyMessages from '../pure/legacy-messages';
import { InitialQueryInfo, LocalQueryInfo } from '../query-results';
import { QueryEvaluationInfo, QueryWithResults } from '../run-queries-shared';
import * as qsClient from './queryserver-client';


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
    throw new Error(`Database ${dbItem.databaseUri} does not have a CodeQL database scheme.`);
  }

  // Read the query metadata if possible, to use in the UI.
  const metadata = await tryGetQueryMetadata(cliServer, initialInfo.queryPath);

  const hasMetadataFile = (await dbItem.hasMetadataFile());
  const query = new QueryEvaluationInfo(
    path.join(queryStorageDir, initialInfo.id),
    dbItem.databaseUri.fsPath,
    hasMetadataFile,
    initialInfo.quickEvalPosition,
    metadata,
  );

  if (!dbItem.contents || dbItem.error) {
    throw new Error('Can\'t run query on invalid database.');
  }
  const target = query.quickEvalPosition ? {
    quickEval: { quickEvalPos: query.quickEvalPosition }
  } : { query: {} };

  const diskWorkspaceFolders = getOnDiskWorkspaceFolders();
  const db = dbItem.databaseUri.fsPath;
  const logPath = queryInfo ? query.evalLogPath : undefined;
  const queryToRun: messages.RunQueryParams = {
    db,
    additionalPacks: diskWorkspaceFolders,
    externalInputs: {},
    singletonExternalInputs: templates || {},
    outputPath: query.resultsPaths.resultsPath,
    queryPath: initialInfo.queryPath,
    logPath,
    target,
  };
  await query.createTimestampFile();
  let result: messages.RunQueryResult | undefined;
  try {
    result = await qs.sendRequest(messages.runQuery, queryToRun, token, progress);
    if (qs.config.customLogDirectory) {
      void showAndLogWarningMessage(
        `Custom log directories are no longer supported. The "codeQL.runningQueries.customLogDirectory" setting is deprecated. Unset the setting to stop seeing this message. Query logs saved to ${query.logPath}.`
      );
    }
  } finally {
    if (queryInfo) {
      if (await query.hasEvalLog()) {
        await query.addQueryLogs(queryInfo, qs.cliServer, qs.logger);
      } else {
        void showAndLogWarningMessage(`Failed to write structured evaluator log to ${query.evalLogPath}.`);
      }
    }
  }

  if (result.resultType !== messages.QueryResultType.SUCCESS) {
    const message = result.message || 'Failed to run query';
    void logger.log(message);
    void showAndLogErrorMessage(message);
  }
  let message;
  switch (result.resultType) {
    case messages.QueryResultType.CANCELLATION:
      message = `cancelled after ${Math.round(result.evaluationTime / 1000)} seconds`;
      break;
    case messages.QueryResultType.OOM:
      message = 'out of memory';
      break;
    case messages.QueryResultType.SUCCESS:
      message = `finished in ${Math.round(result.evaluationTime / 1000)} seconds`;
      break;
    case messages.QueryResultType.COMPILATION_ERROR:
      message = `compilation failed: ${result.message}`;
      break;
    case messages.QueryResultType.OTHER_ERROR:
    default:
      message = result.message ? `failed: ${result.message}` : 'failed';
      break;
  }
  const sucessful = result.resultType === messages.QueryResultType.SUCCESS;
  return {
    query,
    result: {
      evaluationTime: result.evaluationTime,
      queryId: 0,
      resultType: sucessful ? legacyMessages.QueryResultType.SUCCESS : legacyMessages.QueryResultType.OTHER_ERROR,
      runId: 0,
      message
    },
    message,
    sucessful,
    dispose: () => {
      qs.logger.removeAdditionalLogLocation(undefined);
    }
  };
}
