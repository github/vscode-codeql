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

export interface PreviousExecution {
  queryName: string;
  time: string;
  databaseName: string;
  durationSeconds: number;
}

export interface Interpretation {
  sourceLocationPrefix: string;
  numTruncatedResults: number;
  sarif: sarif.Log;
}

export interface ResultsInfo {
  resultsPath: string;
  interpretedResultsPath: string;
}

export interface SortedResultSetInfo {
  resultsPath: string;
  sortState: SortState;
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
  sortedResultsMap: SortedResultsMap;
  interpretation: undefined | Interpretation;
  database: DatabaseInfo;
  kind?: string;
  /**
   * Whether to keep displaying the old results while rendering the new results.
   *
   * This is useful to prevent properties like scroll state being lost when rendering the sorted results after sorting a column.
   */
  shouldKeepOldResultsWhileRendering: boolean;
};

export type IntoResultsViewMsg = ResultsUpdatingMsg | SetStateMsg;

export type FromResultsViewMsg = ViewSourceFileMsg | ToggleDiagnostics | ChangeSortMsg | ResultViewLoaded;

interface ViewSourceFileMsg {
  t: 'viewSourceFile';
  loc: ResolvableLocationValue;
  databaseUri: string;
};

interface ToggleDiagnostics {
  t: 'toggleDiagnostics';
  databaseUri: string;
  resultsPath: string;
  visible: boolean;
  kind?: string;
};

interface ResultViewLoaded {
  t: 'resultViewLoaded';
};

export enum SortDirection {
  asc, desc
}

export interface SortState {
  columnIndex: number;
  direction: SortDirection;
}

interface ChangeSortMsg {
  t: 'changeSort';
  resultSetName: string;
  sortState?: SortState;
}
