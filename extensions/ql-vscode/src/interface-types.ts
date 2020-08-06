import * as sarif from 'sarif';
import { RawResultSet, ResultRow, ResultSetSchema, Column, ResolvableLocationValue } from './bqrs-cli-types';

/**
 * This module contains types and code that are shared between
 * the webview and the extension.
 */

export const SELECT_TABLE_NAME = '#select';
export const ALERTS_TABLE_NAME = 'alerts';

export type RawTableResultSet = { t: 'RawResultSet' } & RawResultSet;
export type PathTableResultSet = {
  t: 'SarifResultSet';
  readonly schema: ResultSetSchema;
  name: string;
} & Interpretation;

export type ResultSet = RawTableResultSet | PathTableResultSet;

/**
 * Only ever show this many rows in a raw result table.
 */
export const RAW_RESULTS_LIMIT = 10000;

/**
 * Show this many rows in a raw result table at a time.
 */
export const RAW_RESULTS_PAGE_SIZE = 100;

/**
 * Show this many rows in an interpreted results table at a time.
 */
export const INTERPRETED_RESULTS_PAGE_SIZE = 100;

export interface DatabaseInfo {
  name: string;
  databaseUri: string;
}

/** Arbitrary query metadata */
export interface QueryMetadata {
  name?: string;
  description?: string;
  id?: string;
  kind?: string;
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
  numTotalResults: number;
  /**
   * sortState being undefined means don't sort, just present results in the order
   * they appear in the sarif file.
   */
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
  metadata?: QueryMetadata;
  /**
   * Whether to keep displaying the old results while rendering the new results.
   *
   * This is useful to prevent properties like scroll state being lost when rendering the sorted results after sorting a column.
   */
  shouldKeepOldResultsWhileRendering: boolean;

  /**
   * An experimental way of providing results from the extension.
   * Should be in the WebviewParsedResultSets branch of the type
   * unless config.EXPERIMENTAL_BQRS_SETTING is set to true.
   */
  parsedResultSets: ParsedResultSets;
}

export interface ShowInterpretedPageMsg {
  t: 'showInterpretedPage';
  interpretation: Interpretation;
  database: DatabaseInfo;
  metadata?: QueryMetadata;
  pageNumber: number;
  numPages: number;
  resultSetNames: string[];
}

/** Advance to the next or previous path no in the path viewer */
export interface NavigatePathMsg {
  t: 'navigatePath';

  /** 1 for next, -1 for previous */
  direction: number;
}

export type IntoResultsViewMsg =
  | ResultsUpdatingMsg
  | SetStateMsg
  | ShowInterpretedPageMsg
  | NavigatePathMsg;

export type FromResultsViewMsg =
  | ViewSourceFileMsg
  | ToggleDiagnostics
  | ChangeRawResultsSortMsg
  | ChangeInterpretedResultsSortMsg
  | ResultViewLoaded
  | ChangePage;

export interface ViewSourceFileMsg {
  t: 'viewSourceFile';
  loc: ResolvableLocationValue;
  databaseUri: string;
}

interface ToggleDiagnostics {
  t: 'toggleDiagnostics';
  databaseUri: string;
  metadata?: QueryMetadata;
  origResultsPaths: ResultsPaths;
  visible: boolean;
  kind?: string;
}

interface ResultViewLoaded {
  t: 'resultViewLoaded';
}

interface ChangePage {
  t: 'changePage';
  pageNumber: number; // 0-indexed, displayed to the user as 1-indexed
  selectedTable: string;
}

export enum SortDirection {
  asc,
  desc,
}

export interface RawResultsSortState {
  columnIndex: number;
  sortDirection: SortDirection;
}

export type InterpretedResultsSortColumn = 'alert-message';

export interface InterpretedResultsSortState {
  sortBy: InterpretedResultsSortColumn;
  sortDirection: SortDirection;
}

interface ChangeRawResultsSortMsg {
  t: 'changeSort';
  resultSetName: string;
  /**
   * sortState being undefined means don't sort, just present results in the order
   * they appear in the sarif file.
   */
  sortState?: RawResultsSortState;
}

interface ChangeInterpretedResultsSortMsg {
  t: 'changeInterpretedSort';
  /**
   * sortState being undefined means don't sort, just present results in the order
   * they appear in the sarif file.
   */
  sortState?: InterpretedResultsSortState;
}

export type FromCompareViewMessage =
  | CompareViewLoadedMessage
  | ChangeCompareMessage
  | ViewSourceFileMsg
  | OpenQueryMessage;

interface CompareViewLoadedMessage {
  t: 'compareViewLoaded';
}

export interface OpenQueryMessage {
  readonly t: 'openQuery';
  readonly kind: 'from' | 'to';
}

interface ChangeCompareMessage {
  t: 'changeCompare';
  newResultSetName: string;
}

export type ToCompareViewMessage = SetComparisonsMessage;

export interface SetComparisonsMessage {
  readonly t: 'setComparisons';
  readonly stats: {
    fromQuery?: {
      name: string;
      status: string;
      time: string;
    };
    toQuery?: {
      name: string;
      status: string;
      time: string;
    };
  };
  readonly columns: readonly Column[];
  readonly commonResultSetNames: string[];
  readonly currentResultSetName: string;
  readonly rows: QueryCompareResult | undefined;
  readonly message: string | undefined;
  readonly datebaseUri: string;
}

export enum DiffKind {
  Add = 'Add',
  Remove = 'Remove',
  Change = 'Change',
}

/**
 * from is the set of rows that have changes in the "from" query.
 * to is the set of rows that have changes in the "to" query.
 * They are in the same order, so element 1 in "from" corresponds to
 * element 1 in "to".
 *
 * If an array element is null, that means that the element was removed
 * (or added) in the comparison.
 */
export type QueryCompareResult = {
  from: ResultRow[];
  to: ResultRow[];
};

/**
 * Extract the name of the default result. Prefer returning
 * 'alerts', or '#select'. Otherwise return the first in the list.
 *
 * Note that this is the only function in this module. It must be
 * placed here since it is shared across the webview boundary.
 *
 * We should consider moving to a separate module to ensure this
 * one is types only.
 *
 * @param resultSetNames
 */
export function getDefaultResultSetName(
  resultSetNames: readonly string[]
): string {
  // Choose first available result set from the array
  return [
    ALERTS_TABLE_NAME,
    SELECT_TABLE_NAME,
    resultSetNames[0],
  ].filter((resultSetName) => resultSetNames.includes(resultSetName))[0];
}

export interface ParsedResultSets {
  pageNumber: number;
  numPages: number;
  numInterpretedPages: number;
  selectedTable?: string; // when undefined, means 'show default table'
  resultSetNames: string[];
  resultSet: ResultSet;
}
