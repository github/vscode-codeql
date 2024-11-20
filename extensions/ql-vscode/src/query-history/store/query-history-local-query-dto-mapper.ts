import type { InitialQueryInfo } from "../../query-results";
import { LocalQueryInfo, CompletedQueryInfo } from "../../query-results";
import { QueryEvaluationInfo } from "../../run-queries-shared";
import { QueryOutputDir } from "../../local-queries/query-output-dir";
import { SortDirectionDto } from "./query-history-local-query-dto";
import type {
  CompletedQueryInfoDto,
  QueryEvaluationInfoDto,
  InitialQueryInfoDto,
  QueryHistoryLocalQueryDto,
  InterpretedResultsSortStateDto,
  SortedResultSetInfoDto,
  RawResultsSortStateDto,
} from "./query-history-local-query-dto";
import type {
  InterpretedResultsSortState,
  RawResultsSortState,
  SortedResultSetInfo,
} from "../../common/interface-types";
import { SortDirection } from "../../common/interface-types";
import { mapQueryLanguageToDomainModel } from "./query-history-language-dto-mapper";

export function mapLocalQueryItemToDomainModel(
  localQuery: QueryHistoryLocalQueryDto,
): LocalQueryInfo {
  return new LocalQueryInfo(
    mapInitialQueryInfoToDomainModel(
      localQuery.initialInfo,
      localQuery.completedQuery?.query?.querySaveDir,
    ),
    undefined,
    localQuery.failureReason,
    localQuery.completedQuery &&
      mapCompletedQueryInfoToDomainModel(localQuery.completedQuery),
    localQuery.evalLogLocation
      ? {
          log: localQuery.evalLogLocation,
          humanReadableSummary: localQuery.evalLogSummaryLocation,
          jsonSummary: localQuery.jsonEvalLogSummaryLocation,
          summarySymbols: localQuery.evalLogSummarySymbolsLocation,
          endSummary: undefined,
        }
      : undefined,
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
    completedQuery.logFileLocation,
    completedQuery.successful ?? false,
    completedQuery.message ?? "",
    sortState,
    completedQuery.resultCount,
    sortedResults,
  );
}

function mapInitialQueryInfoToDomainModel(
  initialInfo: InitialQueryInfoDto,
  // The completedQuerySaveDir is a migration to support old query items that don't have
  // the querySaveDir in the initialInfo. It should be removed once all query
  // items have the querySaveDir in the initialInfo.
  completedQuerySaveDir?: string,
): InitialQueryInfo {
  const querySaveDir =
    initialInfo.outputDir?.querySaveDir ?? completedQuerySaveDir;

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
      language:
        initialInfo.databaseInfo.language === undefined
          ? undefined
          : mapQueryLanguageToDomainModel(initialInfo.databaseInfo.language),
    },
    start: new Date(initialInfo.start),
    id: initialInfo.id,
    outputDir: querySaveDir ? new QueryOutputDir(querySaveDir) : undefined,
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
