export interface LocalQueryDataItem {
  initialInfo: InitialQueryInfoData;
  t: "local";
  evalLogLocation?: string;
  evalLogSummaryLocation?: string;
  jsonEvalLogSummaryLocation?: string;
  evalLogSummarySymbolsLocation?: string;
  completedQuery?: CompletedQueryInfoData;
  failureReason?: string;
}

export interface InitialQueryInfoData {
  userSpecifiedLabel?: string;
  queryText: string;
  isQuickQuery: boolean;
  isQuickEval: boolean;
  quickEvalPosition?: PositionData;
  queryPath: string;
  databaseInfo: DatabaseInfoData;
  start: Date;
  id: string;
}

interface DatabaseInfoData {
  name: string;
  databaseUri: string;
}

interface PositionData {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  fileName: string;
}

export interface CompletedQueryInfoData {
  query: QueryEvaluationInfoData;
  message?: string;
  successful?: boolean;

  // There once was a typo in the data model, which is why we need to support both
  sucessful?: boolean;
  result: EvaluationResultData;
  logFileLocation?: string;
  resultCount: number;
  sortedResultsInfo: Record<string, SortedResultSetInfo>;
  interpretedResultsSortState?: InterpretedResultsSortState;
}

interface InterpretedResultsSortState {
  sortBy: InterpretedResultsSortColumn;
  sortDirection: SortDirection;
}

type InterpretedResultsSortColumn = "alert-message";

interface SortedResultSetInfo {
  resultsPath: string;
  sortState: RawResultsSortState;
}

interface RawResultsSortState {
  columnIndex: number;
  sortDirection: SortDirection;
}

enum SortDirection {
  asc,
  desc,
}

interface EvaluationResultData {
  runId: number;
  queryId: number;
  resultType: number;
  evaluationTime: number;
  message?: string;
  logFileLocation?: string;
}

export interface QueryEvaluationInfoData {
  querySaveDir: string;
  dbItemPath: string;
  databaseHasMetadataFile: boolean;
  quickEvalPosition?: PositionData;
  metadata?: QueryMetadataData;
  resultsPaths: {
    resultsPath: string;
    interpretedResultsPath: string;
  };
}

interface QueryMetadataData {
  name?: string;
  description?: string;
  id?: string;
  kind?: string;
  scored?: string;
}
