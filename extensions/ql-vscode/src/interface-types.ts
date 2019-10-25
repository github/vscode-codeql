import { FivePartLocation } from 'semmle-bqrs';
import * as sarif from 'sarif';

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

export interface IntoResultsViewMsg {
  t: 'setState';
  resultsPath: string;
  sortedResultsMap: SortedResultsMap;
  interpretation: undefined | Interpretation;
  database: DatabaseInfo;
};

export type FromResultsViewMsg = ViewSourceFileMsg | ToggleDiagnostics | ChangeSortMsg;

interface ViewSourceFileMsg {
  t: 'viewSourceFile';
  loc: FivePartLocation;
  databaseUri: string;
};

interface ToggleDiagnostics {
  t: 'toggleDiagnostics';
  databaseUri: string;
  resultsPath: string;
  visible: boolean;
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
