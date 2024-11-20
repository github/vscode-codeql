import type {
  LocalQueryInfo,
  InitialQueryInfo,
  CompletedQueryInfo,
} from "../../query-results";
import type { QueryEvaluationInfo } from "../../run-queries-shared";
import type {
  QueryHistoryLocalQueryDto,
  InitialQueryInfoDto,
  QueryEvaluationInfoDto,
  CompletedQueryInfoDto,
  SortedResultSetInfoDto,
} from "./query-history-local-query-dto";
import { SortDirectionDto } from "./query-history-local-query-dto";
import type {
  RawResultsSortState,
  SortedResultSetInfo,
} from "../../common/interface-types";
import { SortDirection } from "../../common/interface-types";
import { mapQueryLanguageToDto } from "./query-history-language-domain-mapper";

export function mapLocalQueryInfoToDto(
  query: LocalQueryInfo,
): QueryHistoryLocalQueryDto {
  return {
    initialInfo: mapInitialQueryInfoToDto(query.initialInfo),
    t: "local",
    evalLogLocation: query.evaluatorLogPaths?.log,
    evalLogSummaryLocation: query.evaluatorLogPaths?.humanReadableSummary,
    jsonEvalLogSummaryLocation: query.evaluatorLogPaths?.jsonSummary,
    evalLogSummarySymbolsLocation: query.evaluatorLogPaths?.summarySymbols,
    failureReason: query.failureReason,
    completedQuery:
      query.completedQuery && mapCompletedQueryToDto(query.completedQuery),
  };
}

function mapCompletedQueryToDto(
  query: CompletedQueryInfo,
): CompletedQueryInfoDto {
  const sortedResults = Object.fromEntries(
    Object.entries(query.sortedResultsInfo).map(([key, value]) => {
      return [key, mapSortedResultSetInfoToDto(value)];
    }),
  );

  return {
    query: mapQueryEvaluationInfoToDto(query.query),
    logFileLocation: query.logFileLocation,
    successful: query.successful,
    message: query.message,
    resultCount: query.resultCount,
    sortedResultsInfo: sortedResults,
  };
}

function mapSortDirectionToDto(sortDirection: SortDirection): SortDirectionDto {
  switch (sortDirection) {
    case SortDirection.asc:
      return SortDirectionDto.asc;
    case SortDirection.desc:
      return SortDirectionDto.desc;
  }
}

function mapRawResultsSortStateToDto(
  sortState: RawResultsSortState,
): SortedResultSetInfoDto["sortState"] {
  return {
    columnIndex: sortState.columnIndex,
    sortDirection: mapSortDirectionToDto(sortState.sortDirection),
  };
}

function mapSortedResultSetInfoToDto(
  resultSet: SortedResultSetInfo,
): SortedResultSetInfoDto {
  return {
    resultsPath: resultSet.resultsPath,
    sortState: mapRawResultsSortStateToDto(resultSet.sortState),
  };
}

function mapInitialQueryInfoToDto(
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
      language:
        localQueryInitialInfo.databaseInfo.language === undefined
          ? undefined
          : mapQueryLanguageToDto(localQueryInitialInfo.databaseInfo.language),
    },
    start: localQueryInitialInfo.start,
    id: localQueryInitialInfo.id,
    outputDir: localQueryInitialInfo.outputDir
      ? {
          querySaveDir: localQueryInitialInfo.outputDir.querySaveDir,
        }
      : undefined,
  };
}

function mapQueryEvaluationInfoToDto(
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
