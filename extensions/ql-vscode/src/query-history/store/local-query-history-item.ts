export interface LocalQueryHistoryItem {
  initialInfo: LocalQueryHistoryInitialInfo;
  t: "local";
  evalLogLocation: string | undefined;
  evalLogSummaryLocation: string | undefined;
  jsonEvalLogSummaryLocation: string | undefined;
  evalLogSummarySymbolsLocation: string | undefined;
  completedQuery: CompletedQueryQueryHistoryInfo | undefined;
  failureReason: string | undefined;
}

export interface LocalQueryHistoryInitialInfo {
  userSpecifiedLabel?: string;
  queryText: string;
  isQuickQuery: boolean;
  isQuickEval: boolean;
  quickEvalPosition?: LocalQueryHistoryPosition;
  queryPath: string;
  databaseInfo: LocalQueryHistoryDatabaseInfo;
  start: Date;
  id: string;
}

export interface LocalQueryHistoryDatabaseInfo {
  name: string;
  databaseUri: string;
}

export interface LocalQueryHistoryPosition {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  fileName: string;
}

export interface CompletedQueryQueryHistoryInfo {
  query: LocalQueryHistoryEvaluationInfo;
  message?: string;
  successful?: boolean;

  // There once was a typo in the data model, which is why we need to support both
  sucessful?: boolean;
  result: LocalQueryHistoryResult;
  logFileLocation?: string;
  resultCount: number;
  sortedResultsInfo: Record<string, SortedResultSetInfo>;
  interpretedResultsSortState: InterpretedResultsSortState | undefined;
}

export interface SortedResultSetInfo {
  resultsPath: string;
  sortState: RawResultsSortState;
}

export interface RawResultsSortState {
  columnIndex: number;
  sortDirection: SortDirection;
}

export enum SortDirection {
  asc,
  desc,
}

export interface InterpretedResultsSortState {
  sortBy: InterpretedResultsSortColumn;
  sortDirection: SortDirection;
}

export type InterpretedResultsSortColumn = "alert-message";

export interface LocalQueryHistoryResult {
  runId: number;
  queryId: number;
  resultType: number;
  evaluationTime: number;
  message?: string;
  logFileLocation?: string;
}

export interface LocalQueryHistoryEvaluationInfo {
  querySaveDir: string;
  dbItemPath: string;
  databaseHasMetadataFile: boolean;
  quickEvalPosition?: LocalQueryHistoryPosition;
  metadata?: LocalQueryHistoryMetadata;
  resultsPaths: string;
}

export interface LocalQueryHistoryMetadata {
  name?: string;
  description?: string;
  id?: string;
  kind?: string;
  scored?: string;
}
