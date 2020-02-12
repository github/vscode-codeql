import * as sarif from 'sarif';
import { ResolvableLocationValue } from 'semmle-bqrs';

/**
 * Only ever show this many results per run in interpreted results.
 */
export const INTERPRETED_RESULTS_PER_RUN_LIMIT = 100;

/**
 * Only ever show this many rows in a raw result table.
 */
export const RAW_RESULTS_LIMIT = 10000;

export interface DatabaseInfo {
  name: string;
  databaseUri: string;
}

/** Arbitrary query metadata */
export interface QueryMetadata {
  name?: string,
  description?: string,
  id?: string,
  kind?: string
}

export interface PreviousExecution {
  queryName: string;
  time: string;
  databaseName: string;
  durationSeconds: number;
}

export interface Interpretation {
  sourceLocationPrefix: string;
  numTruncatedResults: number;
  sortState?: InterpretedResultsSortState;
  sarif: sarif.Log;
}

export interface ResultsPaths {
  resultsPath: string;
  interpretedResultsPath: string;
}

export interface SortedResultSetInfo {
  resultsPath: string;
  sortState: RawResultsSortState;
}

export type SortedResultsMap = { [resultSet: string]: SortedResultSetInfo };

/**
 * A message to indicate that the results are being updated.
 *
 * As a result of receiving this message, listeners might want to display a loading indicator.
 */
export interface ResultsUpdatingMsg {
  t: 'resultsUpdating';
}

export interface SetStateMsg {
  t: 'setState';
  resultsPath: string;
  origResultsPaths: ResultsPaths;
  sortedResultsMap: SortedResultsMap;
  interpretation: undefined | Interpretation;
  database: DatabaseInfo;
  metadata?: QueryMetadata
  /**
   * Whether to keep displaying the old results while rendering the new results.
   *
   * This is useful to prevent properties like scroll state being lost when rendering the sorted results after sorting a column.
   */
  shouldKeepOldResultsWhileRendering: boolean;
};

/** Advance to the next or previous path no in the path viewer */
export interface NavigatePathMsg {
  t: 'navigatePath',

  /** 1 for next, -1 for previous */
  direction: number;
}

export type IntoResultsViewMsg = ResultsUpdatingMsg | SetStateMsg | NavigatePathMsg;

export type FromResultsViewMsg =
  | ViewSourceFileMsg
  | ToggleDiagnostics
  | ChangeRawResultsSortMsg
  | ChangeInterpretedResultsSortMsg
  | ResultViewLoaded;

interface ViewSourceFileMsg {
  t: 'viewSourceFile';
  loc: ResolvableLocationValue;
  databaseUri: string;
};

interface ToggleDiagnostics {
  t: 'toggleDiagnostics';
  databaseUri: string;
  metadata?: QueryMetadata
  origResultsPaths: ResultsPaths;
  visible: boolean;
  kind?: string;
};

interface ResultViewLoaded {
  t: 'resultViewLoaded';
};

export enum SortDirection {
  asc, desc
}

export interface RawResultsSortState {
  columnIndex: number;
  direction: SortDirection;
}

export type InterpretedResultsSortColumn =
  'alert-message';

export interface InterpretedResultsSortState {
  sortBy: InterpretedResultsSortColumn;
  sortDirection: SortDirection;
}

interface ChangeRawResultsSortMsg {
  t: 'changeSort';
  resultSetName: string;
  sortState?: RawResultsSortState;
}

interface ChangeInterpretedResultsSortMsg {
  t: 'changeInterpretedSort';
  sortState?: InterpretedResultsSortState;
}
