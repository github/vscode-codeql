import {
  LocalQueryInfo,
  CompletedQueryInfo,
  InitialQueryInfo,
} from "../../query-results";
import { QueryEvaluationInfo } from "../../run-queries-shared";
import { QueryHistoryInfo } from "../query-history-info";
import { VariantAnalysisHistoryItem } from "../variant-analysis-history-item";
import {
  CompletedQueryInfoDto,
  QueryEvaluationInfoDto,
  InitialQueryInfoDto,
  QueryHistoryLocalQueryDto,
} from "./query-history-local-query-dto";
import { QueryHistoryDataItem } from "./query-history-data";

// Maps Query History Data Models to Domain Models

export function mapQueryHistoryToDomainModels(
  queries: QueryHistoryDataItem[],
): QueryHistoryInfo[] {
  return queries.map((d) => {
    if (d.t === "variant-analysis") {
      const query: VariantAnalysisHistoryItem = d;
      return query;
    } else if (d.t === "local") {
      return mapLocalQueryDataItemToDomainModel(d);
    }

    throw Error(
      `Unexpected or corrupted query history file. Unknown query history item: ${JSON.stringify(
        d,
      )}`,
    );
  });
}

function mapLocalQueryDataItemToDomainModel(
  localQuery: QueryHistoryLocalQueryDto,
): LocalQueryInfo {
  return new LocalQueryInfo(
    mapInitialQueryInfoDataToDomainModel(localQuery.initialInfo),
    undefined,
    localQuery.failureReason,
    localQuery.completedQuery &&
      mapCompletedQueryInfoDataToDomainModel(localQuery.completedQuery),
    localQuery.evalLogLocation,
    localQuery.evalLogSummaryLocation,
    localQuery.jsonEvalLogSummaryLocation,
    localQuery.evalLogSummarySymbolsLocation,
  );
}

function mapCompletedQueryInfoDataToDomainModel(
  completedQuery: CompletedQueryInfoDto,
): CompletedQueryInfo {
  return new CompletedQueryInfo(
    mapQueryEvaluationInfoDataToDomainModel(completedQuery.query),
    {
      runId: completedQuery.result.runId,
      queryId: completedQuery.result.queryId,
      resultType: completedQuery.result.resultType,
      evaluationTime: completedQuery.result.evaluationTime,
      message: completedQuery.result.message,
      logFileLocation: completedQuery.result.logFileLocation,
    },
    completedQuery.logFileLocation,
    completedQuery.successful ?? completedQuery.sucessful,
    completedQuery.message,
    completedQuery.interpretedResultsSortState,
    completedQuery.resultCount,
    completedQuery.sortedResultsInfo,
  );
}

function mapInitialQueryInfoDataToDomainModel(
  initialInfo: InitialQueryInfoDto,
): InitialQueryInfo {
  return {
    userSpecifiedLabel: initialInfo.userSpecifiedLabel,
    queryText: initialInfo.queryText,
    isQuickQuery: initialInfo.isQuickQuery,
    isQuickEval: initialInfo.isQuickEval,
    quickEvalPosition: initialInfo.quickEvalPosition,
    queryPath: initialInfo.queryPath,
    databaseInfo: {
      databaseUri: initialInfo.databaseInfo.databaseUri,
      name: initialInfo.databaseInfo.name,
    },
    start: new Date(initialInfo.start),
    id: initialInfo.id,
  };
}

function mapQueryEvaluationInfoDataToDomainModel(
  evaluationInfo: QueryEvaluationInfoDto,
): QueryEvaluationInfo {
  return new QueryEvaluationInfo(
    evaluationInfo.querySaveDir,
    evaluationInfo.dbItemPath,
    evaluationInfo.databaseHasMetadataFile,
    evaluationInfo.quickEvalPosition,
    evaluationInfo.metadata,
  );
}
