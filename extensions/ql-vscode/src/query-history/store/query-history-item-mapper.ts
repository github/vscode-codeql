import {
  LocalQueryInfo,
  CompletedQueryInfo,
  InitialQueryInfo,
} from "../../query-results";
import { QueryEvaluationInfo } from "../../run-queries-shared";
import {
  CompletedQueryQueryHistoryInfo,
  LocalQueryHistoryEvaluationInfo,
  LocalQueryHistoryInitialInfo,
  LocalQueryHistoryItem,
} from "./local-query-history-item";

export function mapLocalQueryHistoryItemDataModelToDomainModel(
  localQuery: LocalQueryHistoryItem,
): LocalQueryInfo {
  const localQueryDomainModel: LocalQueryInfo = {
    t: "local",
    initialInfo:
      localQuery.initialInfo &&
      mapLocalQueryHistoryInitialInfoToInitialQueryInfo(localQuery.initialInfo),
    completedQuery:
      localQuery.completedQuery &&
      mapCompleteQueryDataModelToDomainModel(localQuery.completedQuery),
    evalLogLocation: localQuery.evalLogLocation,
    evalLogSummaryLocation: localQuery.evalLogSummaryLocation,
    jsonEvalLogSummaryLocation: localQuery.jsonEvalLogSummaryLocation,
    evalLogSummarySymbolsLocation: localQuery.evalLogSummarySymbolsLocation,
    failureReason: localQuery.failureReason,
  };

  Object.setPrototypeOf(localQueryDomainModel, LocalQueryInfo.prototype);

  if (localQueryDomainModel.completedQuery) {
    // Again, need to explicitly set prototypes.
    Object.setPrototypeOf(
      localQueryDomainModel.completedQuery,
      CompletedQueryInfo.prototype,
    );
    Object.setPrototypeOf(
      localQueryDomainModel.completedQuery.query,
      QueryEvaluationInfo.prototype,
    );
  }

  return localQueryDomainModel;
}

function mapCompleteQueryDataModelToDomainModel(
  completedQuery: CompletedQueryQueryHistoryInfo,
): CompletedQueryInfo {
  const obj = {
    query:
      completedQuery.query &&
      mapLocalQueryHistoryEvaluationInfoToQueryEvaluationInfo(
        completedQuery.query,
      ),
    message: completedQuery.message,
    successful: completedQuery.successful || completedQuery.sucessful,
    result: completedQuery.result && {
      runId: completedQuery.result.runId,
      queryId: completedQuery.result.queryId,
      resultType: completedQuery.result.resultType,
      evaluationTime: completedQuery.result.evaluationTime,
      message: completedQuery.result.message,
      logFileLocation: completedQuery.result.logFileLocation,
    },
    logFileLocation: completedQuery.logFileLocation,
    resultCount: completedQuery.resultCount,
    sortedResultsInfo: completedQuery.sortedResultsInfo,
    interpretedResultsSortState: completedQuery.interpretedResultsSortState,
  };

  Object.setPrototypeOf(obj, CompletedQueryInfo.prototype);

  return obj as unknown as CompletedQueryInfo;
}

function mapLocalQueryHistoryInitialInfoToInitialQueryInfo(
  initialInfo: LocalQueryHistoryInitialInfo,
): InitialQueryInfo {
  return {
    userSpecifiedLabel: initialInfo.userSpecifiedLabel,
    queryText: initialInfo.queryText,
    isQuickQuery: initialInfo.isQuickQuery,
    isQuickEval: initialInfo.isQuickEval,
    quickEvalPosition: initialInfo.quickEvalPosition && {
      line: initialInfo.quickEvalPosition.line,
      column: initialInfo.quickEvalPosition.column,
      endLine: initialInfo.quickEvalPosition.endLine,
      endColumn: initialInfo.quickEvalPosition.endColumn,
      fileName: initialInfo.quickEvalPosition.fileName,
    },
    queryPath: initialInfo.queryPath,
    databaseInfo: initialInfo.databaseInfo && {
      databaseUri: initialInfo.databaseInfo.databaseUri,
      name: initialInfo.databaseInfo.name,
    },
    start: initialInfo.start,
    id: initialInfo.id,
  };
}

function mapLocalQueryHistoryEvaluationInfoToQueryEvaluationInfo(
  evaluationInfo: LocalQueryHistoryEvaluationInfo,
): QueryEvaluationInfo {
  return {
    querySaveDir: evaluationInfo.querySaveDir,
    dbItemPath: evaluationInfo.dbItemPath,
    databaseHasMetadataFile: evaluationInfo.databaseHasMetadataFile,
    quickEvalPosition: evaluationInfo.quickEvalPosition && {
      line: evaluationInfo.quickEvalPosition.line,
      column: evaluationInfo.quickEvalPosition.column,
      endLine: evaluationInfo.quickEvalPosition.endLine,
      endColumn: evaluationInfo.quickEvalPosition.endColumn,
      fileName: evaluationInfo.quickEvalPosition.fileName,
    },
    metadata: evaluationInfo.metadata && {
      name: evaluationInfo.metadata.name,
      description: evaluationInfo.metadata.description,
      id: evaluationInfo.metadata.id,
      kind: evaluationInfo.metadata.kind,
      scored: evaluationInfo.metadata.scored,
    },
  };
}
