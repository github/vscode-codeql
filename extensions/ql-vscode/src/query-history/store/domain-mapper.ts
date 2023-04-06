import { assertNever } from "../../pure/helpers-pure";
import { LocalQueryInfo, InitialQueryInfo } from "../../query-results";
import { QueryEvaluationInfo } from "../../run-queries-shared";
import { QueryHistoryInfo } from "../query-history-info";
import {
  LocalQueryDataItem,
  InitialQueryInfoData,
  QueryEvaluationInfoData,
} from "./local-query-data-item";
import { QueryHistoryDataItem } from "./query-history-data";
import { VariantAnalysisDataItem } from "./variant-analysis-data-item";

// Maps Query History Domain Models to Data Models

export function mapQueryHistoryToDataModels(
  queries: QueryHistoryInfo[],
): QueryHistoryDataItem[] {
  return queries.map((q) => {
    if (q.t === "variant-analysis") {
      const query: VariantAnalysisDataItem = q;
      return query;
    } else if (q.t === "local") {
      return mapLocalQueryInfoToDataModel(q);
    } else {
      assertNever(q);
    }
  });
}

function mapLocalQueryInfoToDataModel(
  query: LocalQueryInfo,
): LocalQueryDataItem {
  return {
    initialInfo: mapInitialQueryInfoToDataModel(query.initialInfo),
    t: "local",
    evalLogLocation: query.evalLogLocation,
    evalLogSummaryLocation: query.evalLogSummaryLocation,
    jsonEvalLogSummaryLocation: query.jsonEvalLogSummaryLocation,
    evalLogSummarySymbolsLocation: query.evalLogSummarySymbolsLocation,
    failureReason: query.failureReason,
    completedQuery: query.completedQuery && {
      query: mapQueryEvaluationInfoToDataModel(query.completedQuery.query),
      result: {
        runId: query.completedQuery.result.runId,
        queryId: query.completedQuery.result.queryId,
        resultType: query.completedQuery.result.resultType,
        evaluationTime: query.completedQuery.result.evaluationTime,
        message: query.completedQuery.result.message,
        logFileLocation: query.completedQuery.result.logFileLocation,
      },
      logFileLocation: query.completedQuery.logFileLocation,
      successful: query.completedQuery.successful,
      message: query.completedQuery.message,
      resultCount: query.completedQuery.resultCount,
      sortedResultsInfo: query.completedQuery.sortedResultsInfo,
    },
  };
}

function mapInitialQueryInfoToDataModel(
  localQueryInitialInfo: InitialQueryInfo,
): InitialQueryInfoData {
  return {
    userSpecifiedLabel: localQueryInitialInfo.userSpecifiedLabel,
    queryText: localQueryInitialInfo.queryText,
    isQuickQuery: localQueryInitialInfo.isQuickQuery,
    isQuickEval: localQueryInitialInfo.isQuickEval,
    quickEvalPosition: localQueryInitialInfo.quickEvalPosition,
    queryPath: localQueryInitialInfo.queryPath,
    databaseInfo: {
      databaseUri: localQueryInitialInfo.databaseInfo.databaseUri,
      name: localQueryInitialInfo.databaseInfo.name,
    },
    start: localQueryInitialInfo.start,
    id: localQueryInitialInfo.id,
  };
}

function mapQueryEvaluationInfoToDataModel(
  queryEvaluationInfo: QueryEvaluationInfo,
): QueryEvaluationInfoData {
  return {
    querySaveDir: queryEvaluationInfo.querySaveDir,
    dbItemPath: queryEvaluationInfo.dbItemPath,
    databaseHasMetadataFile: queryEvaluationInfo.databaseHasMetadataFile,
    quickEvalPosition: queryEvaluationInfo.quickEvalPosition,
    metadata: queryEvaluationInfo.metadata,
    resultsPaths: queryEvaluationInfo.resultsPaths,
  };
}
