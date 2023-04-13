import {
  LocalQueryInfo,
  CompletedQueryInfo,
  InitialQueryInfo,
} from "../../query-results";
import { QueryEvaluationInfo } from "../../run-queries-shared";
import { QueryHistoryInfo } from "../query-history-info";
import {
  CompletedQueryInfoDto,
  QueryEvaluationInfoDto,
  InitialQueryInfoDto,
  QueryHistoryLocalQueryDto,
  SortDirectionDto,
  InterpretedResultsSortStateDto,
  SortedResultSetInfoDto,
  RawResultsSortStateDto,
} from "./query-history-local-query-dto";
import { QueryHistoryItemDto } from "./query-history-dto";
import {
  InterpretedResultsSortState,
  RawResultsSortState,
  SortDirection,
  SortedResultSetInfo,
} from "../../pure/interface-types";
import { mapQueryHistoryVariantAnalysisToDomainModel } from "./variant-analysis-dto-mapper";

export function mapQueryHistoryToDomainModel(
  queries: QueryHistoryItemDto[],
): QueryHistoryInfo[] {
  return queries.map((d) => {
    if (d.t === "variant-analysis") {
      return mapQueryHistoryVariantAnalysisToDomainModel(d);
    } else if (d.t === "local") {
      return mapLocalQueryItemToDomainModel(d);
    }

    throw Error(
      `Unexpected or corrupted query history file. Unknown query history item: ${JSON.stringify(
        d,
      )}`,
    );
  });
}

function mapLocalQueryItemToDomainModel(
  localQuery: QueryHistoryLocalQueryDto,
): LocalQueryInfo {
  return new LocalQueryInfo(
    mapInitialQueryInfoToDomainModel(localQuery.initialInfo),
    undefined,
    localQuery.failureReason,
    localQuery.completedQuery &&
      mapCompletedQueryInfoToDomainModel(localQuery.completedQuery),
    localQuery.evalLogLocation,
    localQuery.evalLogSummaryLocation,
    localQuery.jsonEvalLogSummaryLocation,
    localQuery.evalLogSummarySymbolsLocation,
  );
}

function mapCompletedQueryInfoToDomainModel(
  completedQuery: CompletedQueryInfoDto,
): CompletedQueryInfo {
  const sortState =
    completedQuery.interpretedResultsSortState &&
    mapSortStateToDomainModel(completedQuery.interpretedResultsSortState);

  const sortedResults = Object.fromEntries(
    Object.entries(completedQuery.sortedResultsInfo).map(([key, value]) => {
      return [key, mapSortedResultSetInfoToDomainModel(value)];
    }),
  );

  return new CompletedQueryInfo(
    mapQueryEvaluationInfoToDomainModel(completedQuery.query),
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
    sortState,
    completedQuery.resultCount,
    sortedResults,
  );
}

function mapInitialQueryInfoToDomainModel(
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

function mapQueryEvaluationInfoToDomainModel(
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

function mapSortDirectionToDomainModel(
  sortDirection: SortDirectionDto,
): SortDirection {
  switch (sortDirection) {
    case SortDirectionDto.asc:
      return SortDirection.asc;
    case SortDirectionDto.desc:
      return SortDirection.desc;
  }
}

function mapSortStateToDomainModel(
  sortState: InterpretedResultsSortStateDto,
): InterpretedResultsSortState {
  return {
    sortBy: sortState.sortBy,
    sortDirection: mapSortDirectionToDomainModel(sortState.sortDirection),
  };
}

function mapSortedResultSetInfoToDomainModel(
  sortedResultSetInfo: SortedResultSetInfoDto,
): SortedResultSetInfo {
  return {
    resultsPath: sortedResultSetInfo.resultsPath,
    sortState: mapRawResultsSortStateToDomainModel(
      sortedResultSetInfo.sortState,
    ),
  };
}

function mapRawResultsSortStateToDomainModel(
  sortState: RawResultsSortStateDto,
): RawResultsSortState {
  return {
    columnIndex: sortState.columnIndex,
    sortDirection: mapSortDirectionToDomainModel(sortState.sortDirection),
  };
}
