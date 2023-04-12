import { assertNever } from "../../pure/helpers-pure";
import {
  LocalQueryInfo,
  InitialQueryInfo,
  CompletedQueryInfo,
} from "../../query-results";
import { QueryEvaluationInfo } from "../../run-queries-shared";
import { QueryHistoryInfo } from "../query-history-info";
import {
  QueryHistoryLocalQueryDto,
  InitialQueryInfoDto,
  QueryEvaluationInfoDto,
  CompletedQueryInfoDto,
  SortedResultSetInfoDto,
  SortDirectionDto,
} from "./query-history-local-query-dto";
import { QueryHistoryItemDto } from "./query-history-dto";
import { QueryHistoryVariantAnalysisDto } from "./query-history-variant-analysis-dto";
import {
  RawResultsSortState,
  SortDirection,
  SortedResultSetInfo,
} from "../../pure/interface-types";

// Maps Query History Domain Models to Data Models

export function mapQueryHistoryToDataModels(
  queries: QueryHistoryInfo[],
): QueryHistoryItemDto[] {
  return queries.map((q) => {
    if (q.t === "variant-analysis") {
      const query: QueryHistoryVariantAnalysisDto = q;
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
): QueryHistoryLocalQueryDto {
  return {
    initialInfo: mapInitialQueryInfoToDataModel(query.initialInfo),
    t: "local",
    evalLogLocation: query.evalLogLocation,
    evalLogSummaryLocation: query.evalLogSummaryLocation,
    jsonEvalLogSummaryLocation: query.jsonEvalLogSummaryLocation,
    evalLogSummarySymbolsLocation: query.evalLogSummarySymbolsLocation,
    failureReason: query.failureReason,
    completedQuery:
      query.completedQuery &&
      mapCompletedQueryToDataModel(query.completedQuery),
  };
}

function mapCompletedQueryToDataModel(
  query: CompletedQueryInfo,
): CompletedQueryInfoDto {
  const sortedResults = Object.fromEntries(
    Object.entries(query.sortedResultsInfo).map(([key, value]) => {
      return [key, mapSortedResultSetInfoToDataModel(value)];
    }),
  );

  return {
    query: mapQueryEvaluationInfoToDataModel(query.query),
    result: {
      runId: query.result.runId,
      queryId: query.result.queryId,
      resultType: query.result.resultType,
      evaluationTime: query.result.evaluationTime,
      message: query.result.message,
      logFileLocation: query.result.logFileLocation,
    },
    logFileLocation: query.logFileLocation,
    successful: query.successful,
    message: query.message,
    resultCount: query.resultCount,
    sortedResultsInfo: sortedResults,
  };
}

function mapSortDirectionToDomainModel(
  sortDirection: SortDirection,
): SortDirectionDto {
  switch (sortDirection) {
    case SortDirection.asc:
      return SortDirectionDto.asc;
    case SortDirection.desc:
      return SortDirectionDto.desc;
  }
}

function mapRawResultsSortStateToDataModel(
  sortState: RawResultsSortState,
): SortedResultSetInfoDto["sortState"] {
  return {
    columnIndex: sortState.columnIndex,
    sortDirection: mapSortDirectionToDomainModel(sortState.sortDirection),
  };
}

function mapSortedResultSetInfoToDataModel(
  resultSet: SortedResultSetInfo,
): SortedResultSetInfoDto {
  return {
    resultsPath: resultSet.resultsPath,
    sortState: mapRawResultsSortStateToDataModel(resultSet.sortState),
  };
}

function mapInitialQueryInfoToDataModel(
  localQueryInitialInfo: InitialQueryInfo,
): InitialQueryInfoDto {
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
): QueryEvaluationInfoDto {
  return {
    querySaveDir: queryEvaluationInfo.querySaveDir,
    dbItemPath: queryEvaluationInfo.dbItemPath,
    databaseHasMetadataFile: queryEvaluationInfo.databaseHasMetadataFile,
    quickEvalPosition: queryEvaluationInfo.quickEvalPosition,
    metadata: queryEvaluationInfo.metadata,
    resultsPaths: queryEvaluationInfo.resultsPaths,
  };
}
