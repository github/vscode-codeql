// Contains models and consts for the data we want to store in the query history store.
// Changes to these models should be done carefully and account for backwards compatibility of data.

import type { QueryLanguageDto } from "./query-history-dto";

export interface QueryHistoryLocalQueryDto {
  initialInfo: InitialQueryInfoDto;
  t: "local";
  evalLogLocation?: string;
  evalLogSummaryLocation?: string;
  jsonEvalLogSummaryLocation?: string;
  evalLogSummarySymbolsLocation?: string;
  completedQuery?: CompletedQueryInfoDto;
  failureReason?: string;
}

export interface InitialQueryInfoDto {
  userSpecifiedLabel?: string;
  queryText: string;
  isQuickQuery: boolean;
  isQuickEval: boolean;
  quickEvalPosition?: PositionDto;
  queryPath: string;
  databaseInfo: DatabaseInfoDto;
  start: Date;
  id: string;
  outputDir?: QueryOutputDirDto; // Undefined for backwards compatibility
}

interface QueryOutputDirDto {
  querySaveDir: string;
}

interface DatabaseInfoDto {
  name: string;
  databaseUri: string;
  language?: QueryLanguageDto;
}

interface PositionDto {
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  fileName: string;
}

export interface CompletedQueryInfoDto {
  query: QueryEvaluationInfoDto;
  message?: string;
  successful?: boolean;

  // There once was a typo in the data model, which is why we need to support both
  sucessful?: boolean;
  logFileLocation?: string;
  resultCount: number;
  sortedResultsInfo: Record<string, SortedResultSetInfoDto>;
  interpretedResultsSortState?: InterpretedResultsSortStateDto;
}

export interface InterpretedResultsSortStateDto {
  sortBy: InterpretedResultsSortColumnDto;
  sortDirection: SortDirectionDto;
}

type InterpretedResultsSortColumnDto = "alert-message";

export interface SortedResultSetInfoDto {
  resultsPath: string;
  sortState: RawResultsSortStateDto;
}

export interface RawResultsSortStateDto {
  columnIndex: number;
  sortDirection: SortDirectionDto;
}

export enum SortDirectionDto {
  asc,
  desc,
}

export interface QueryEvaluationInfoDto {
  querySaveDir: string;
  dbItemPath: string;
  databaseHasMetadataFile: boolean;
  quickEvalPosition?: PositionDto;
  metadata?: QueryMetadataDto;
  resultsPaths: {
    resultsPath: string;
    interpretedResultsPath: string;
  };
}

interface QueryMetadataDto {
  name?: string;
  description?: string;
  id?: string;
  kind?: string;
  scored?: string;
}
