import * as sarif from "sarif";
import {
  RawResultSet,
  ResultRow,
  ResultSetSchema,
  Column,
  ResolvableLocationValue,
} from "../common/bqrs-cli-types";
import {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
} from "../variant-analysis/shared/variant-analysis";
import {
  RepositoriesFilterSortState,
  RepositoriesFilterSortStateWithIds,
} from "../variant-analysis/shared/variant-analysis-filter-sort";
import { ErrorLike } from "../common/errors";
import { DataFlowPaths } from "../variant-analysis/shared/data-flow-paths";
import { Method, Usage } from "../model-editor/method";
import { ModeledMethod } from "../model-editor/modeled-method";
import {
  MethodModelingPanelViewState,
  ModelEditorViewState,
} from "../model-editor/shared/view-state";
import { Mode } from "../model-editor/shared/mode";
import { QueryLanguage } from "./query-language";

/**
 * This module contains types and code that are shared between
 * the webview and the extension.
 */

export const SELECT_TABLE_NAME = "#select";
export const ALERTS_TABLE_NAME = "alerts";
export const GRAPH_TABLE_NAME = "graph";

export type RawTableResultSet = { t: "RawResultSet" } & RawResultSet;
export type InterpretedResultSet<T> = {
  t: "InterpretedResultSet";
  readonly schema: ResultSetSchema;
  name: string;
  interpretation: InterpretationT<T>;
};

export type ResultSet =
  | RawTableResultSet
  | InterpretedResultSet<InterpretationData>;

/**
 * Only ever show this many rows in a raw result table.
 */
export const RAW_RESULTS_LIMIT = 10000;

export interface DatabaseInfo {
  name: string;
  databaseUri: string;
  language?: QueryLanguage;
}

/** Arbitrary query metadata */
export interface QueryMetadata {
  name?: string;
  description?: string;
  id?: string;
  kind?: string;
  scored?: string;
}

export type SarifInterpretationData = {
  t: "SarifInterpretationData";
  /**
   * sortState being undefined means don't sort, just present results in the order
   * they appear in the sarif file.
   */
  sortState?: InterpretedResultsSortState;
} & sarif.Log;

export type GraphInterpretationData = {
  t: "GraphInterpretationData";
  dot: string[];
};

type InterpretationData = SarifInterpretationData | GraphInterpretationData;

interface InterpretationT<T> {
  sourceLocationPrefix: string;
  numTruncatedResults: number;
  numTotalResults: number;
  data: T;
}

export type Interpretation = InterpretationT<InterpretationData>;

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
interface ResultsUpdatingMsg {
  t: "resultsUpdating";
}

/**
 * Message to set the initial state of the results view with a new
 * query.
 */
interface SetStateMsg {
  t: "setState";
  resultsPath: string;
  origResultsPaths: ResultsPaths;
  sortedResultsMap: SortedResultsMap;
  interpretation: undefined | Interpretation;
  database: DatabaseInfo;
  metadata?: QueryMetadata;
  queryName: string;
  queryPath: string;
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

/**
 * Message indicating that the results view should display interpreted
 * results.
 */
interface ShowInterpretedPageMsg {
  t: "showInterpretedPage";
  interpretation: Interpretation;
  database: DatabaseInfo;
  metadata?: QueryMetadata;
  pageNumber: number;
  numPages: number;
  pageSize: number;
  resultSetNames: string[];
  queryName: string;
  queryPath: string;
}

export const enum NavigationDirection {
  up = "up",
  down = "down",
  left = "left",
  right = "right",
}

/** Move up, down, left, or right in the result viewer. */
export interface NavigateMsg {
  t: "navigate";
  direction: NavigationDirection;
}

/**
 * A message indicating that the results view should untoggle the
 * "Show results in Problems view" checkbox.
 */
interface UntoggleShowProblemsMsg {
  t: "untoggleShowProblems";
}

/**
 * A message sent into the results view.
 */
export type IntoResultsViewMsg =
  | ResultsUpdatingMsg
  | SetStateMsg
  | ShowInterpretedPageMsg
  | NavigateMsg
  | UntoggleShowProblemsMsg;

/**
 * A message sent from the results view.
 */
export type FromResultsViewMsg =
  | CommonFromViewMessages
  | ViewSourceFileMsg
  | ToggleDiagnostics
  | ChangeRawResultsSortMsg
  | ChangeInterpretedResultsSortMsg
  | ChangePage
  | OpenFileMsg;

/**
 * Message from the results view to open a database source
 * file at the provided location.
 */
interface ViewSourceFileMsg {
  t: "viewSourceFile";
  loc: ResolvableLocationValue;
  databaseUri: string;
}

/**
 * Message from the results view to open a file in an editor.
 */
interface OpenFileMsg {
  t: "openFile";
  /* Full path to the file to open. */
  filePath: string;
}

/**
 * Message from the results view to toggle the display of
 * query diagnostics.
 */
interface ToggleDiagnostics {
  t: "toggleDiagnostics";
  databaseUri: string;
  metadata?: QueryMetadata;
  origResultsPaths: ResultsPaths;
  visible: boolean;
  kind?: string;
}

/**
 * Message from a view signal that loading is complete.
 */
interface ViewLoadedMsg {
  t: "viewLoaded";
  viewName: string;
}

interface TelemetryMessage {
  t: "telemetry";
  action: string;
}

interface UnhandledErrorMessage {
  t: "unhandledError";
  error: ErrorLike;
}

type CommonFromViewMessages =
  | ViewLoadedMsg
  | TelemetryMessage
  | UnhandledErrorMessage;

/**
 * Message from the results view to signal a request to change the
 * page.
 */
interface ChangePage {
  t: "changePage";
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

type InterpretedResultsSortColumn = "alert-message";

export interface InterpretedResultsSortState {
  sortBy: InterpretedResultsSortColumn;
  sortDirection: SortDirection;
}

/**
 * Message from the results view to request a sorting change.
 */
interface ChangeRawResultsSortMsg {
  t: "changeSort";
  resultSetName: string;
  /**
   * sortState being undefined means don't sort, just present results in the order
   * they appear in the sarif file.
   */
  sortState?: RawResultsSortState;
}

/**
 * Message from the results view to request a sorting change in interpreted results.
 */
interface ChangeInterpretedResultsSortMsg {
  t: "changeInterpretedSort";
  /**
   * sortState being undefined means don't sort, just present results in the order
   * they appear in the sarif file.
   */
  sortState?: InterpretedResultsSortState;
}

/**
 * Message from the compare view to the extension.
 */
export type FromCompareViewMessage =
  | CommonFromViewMessages
  | ChangeCompareMessage
  | ViewSourceFileMsg
  | OpenQueryMessage;

/**
 * Message from the compare view to request opening a query.
 */
interface OpenQueryMessage {
  readonly t: "openQuery";
  readonly kind: "from" | "to";
}

/**
 * Message from the compare view to request changing the result set to compare.
 */
interface ChangeCompareMessage {
  t: "changeCompare";
  newResultSetName: string;
}

export type ToCompareViewMessage = SetComparisonsMessage;

/**
 * Message to the compare view that specifies the query results to compare.
 */
export interface SetComparisonsMessage {
  readonly t: "setComparisons";
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
  readonly databaseUri: string;
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
  resultSetNames: readonly string[],
): string {
  // Choose first available result set from the array
  return [
    ALERTS_TABLE_NAME,
    GRAPH_TABLE_NAME,
    SELECT_TABLE_NAME,
    resultSetNames[0],
  ].filter((resultSetName) => resultSetNames.includes(resultSetName))[0];
}

export interface ParsedResultSets {
  pageNumber: number;
  pageSize: number;
  numPages: number;
  numInterpretedPages: number;
  selectedTable?: string; // when undefined, means 'show default table'
  resultSetNames: string[];
  resultSet: ResultSet;
}

interface SetVariantAnalysisMessage {
  t: "setVariantAnalysis";
  variantAnalysis: VariantAnalysis;
}

interface SetFilterSortStateMessage {
  t: "setFilterSortState";
  filterSortState: RepositoriesFilterSortState;
}

export type VariantAnalysisState = {
  variantAnalysisId: number;
};

interface SetRepoResultsMessage {
  t: "setRepoResults";
  repoResults: VariantAnalysisScannedRepositoryResult[];
}

interface SetRepoStatesMessage {
  t: "setRepoStates";
  repoStates: VariantAnalysisScannedRepositoryState[];
}

interface RequestRepositoryResultsMessage {
  t: "requestRepositoryResults";
  repositoryFullName: string;
}

interface OpenQueryFileMessage {
  t: "openQueryFile";
}

interface OpenQueryTextMessage {
  t: "openQueryText";
}

interface CopyRepositoryListMessage {
  t: "copyRepositoryList";
  filterSort?: RepositoriesFilterSortStateWithIds;
}

interface ExportResultsMessage {
  t: "exportResults";
  filterSort?: RepositoriesFilterSortStateWithIds;
}

interface OpenLogsMessage {
  t: "openLogs";
}

interface CancelVariantAnalysisMessage {
  t: "cancelVariantAnalysis";
}

interface ShowDataFlowPathsMessage {
  t: "showDataFlowPaths";
  dataFlowPaths: DataFlowPaths;
}

export type ToVariantAnalysisMessage =
  | SetVariantAnalysisMessage
  | SetFilterSortStateMessage
  | SetRepoResultsMessage
  | SetRepoStatesMessage;

export type FromVariantAnalysisMessage =
  | CommonFromViewMessages
  | RequestRepositoryResultsMessage
  | OpenQueryFileMessage
  | OpenQueryTextMessage
  | CopyRepositoryListMessage
  | ExportResultsMessage
  | OpenLogsMessage
  | CancelVariantAnalysisMessage
  | ShowDataFlowPathsMessage;

interface SetDataFlowPathsMessage {
  t: "setDataFlowPaths";
  dataFlowPaths: DataFlowPaths;
}

export type ToDataFlowPathsMessage = SetDataFlowPathsMessage;

export type FromDataFlowPathsMessage = CommonFromViewMessages;

interface SetExtensionPackStateMessage {
  t: "setModelEditorViewState";
  viewState: ModelEditorViewState;
}

interface SetMethodsMessage {
  t: "setMethods";
  methods: Method[];
}

interface SetModeledMethodsMessage {
  t: "setModeledMethods";
  methods: Record<string, ModeledMethod>;
}

interface SetModifiedMethodsMessage {
  t: "setModifiedMethods";
  methodSignatures: string[];
}

interface SetInProgressMethodsMessage {
  t: "setInProgressMethods";
  packageName: string;
  inProgressMethods: string[];
}

interface SwitchModeMessage {
  t: "switchMode";
  mode: Mode;
}

interface JumpToUsageMessage {
  t: "jumpToUsage";
  method: Method;
  usage: Usage;
}

interface OpenDatabaseMessage {
  t: "openDatabase";
}

interface OpenExtensionPackMessage {
  t: "openExtensionPack";
}

interface RefreshMethods {
  t: "refreshMethods";
}

interface SaveModeledMethods {
  t: "saveModeledMethods";
  methodSignatures?: string[];
}

interface GenerateMethodMessage {
  t: "generateMethod";
}

interface GenerateMethodsFromLlmMessage {
  t: "generateMethodsFromLlm";
  packageName: string;
  methods: Method[];
  modeledMethods: Record<string, ModeledMethod>;
}

interface StopGeneratingMethodsFromLlmMessage {
  t: "stopGeneratingMethodsFromLlm";
  packageName: string;
}

interface ModelDependencyMessage {
  t: "modelDependency";
}

interface HideModeledMethodsMessage {
  t: "hideModeledMethods";
  hideModeledMethods: boolean;
}

interface SetModeledMethodMessage {
  t: "setModeledMethod";
  method: ModeledMethod;
}

interface SetInModelingModeMessage {
  t: "setInModelingMode";
  inModelingMode: boolean;
}

interface RevealMethodMessage {
  t: "revealMethod";
  methodSignature: string;
}

export type ToModelEditorMessage =
  | SetExtensionPackStateMessage
  | SetMethodsMessage
  | SetModeledMethodsMessage
  | SetModifiedMethodsMessage
  | SetInProgressMethodsMessage
  | RevealMethodMessage;

export type FromModelEditorMessage =
  | ViewLoadedMsg
  | SwitchModeMessage
  | RefreshMethods
  | OpenDatabaseMessage
  | OpenExtensionPackMessage
  | JumpToUsageMessage
  | SaveModeledMethods
  | GenerateMethodMessage
  | GenerateMethodsFromLlmMessage
  | StopGeneratingMethodsFromLlmMessage
  | ModelDependencyMessage
  | HideModeledMethodsMessage
  | SetModeledMethodMessage;

interface RevealInEditorMessage {
  t: "revealInModelEditor";
  method: Method;
}

interface StartModelingMessage {
  t: "startModeling";
}

export type FromMethodModelingMessage =
  | CommonFromViewMessages
  | SetModeledMethodMessage
  | RevealInEditorMessage
  | StartModelingMessage;

interface SetMethodModelingPanelViewStateMessage {
  t: "setMethodModelingPanelViewState";
  viewState: MethodModelingPanelViewState;
}

interface SetMethodMessage {
  t: "setMethod";
  method: Method | undefined;
}

interface SetMethodModifiedMessage {
  t: "setMethodModified";
  isModified: boolean;
}

interface SetSelectedMethodMessage {
  t: "setSelectedMethod";
  method: Method;
  modeledMethod?: ModeledMethod;
  isModified: boolean;
}

export type ToMethodModelingMessage =
  | SetMethodModelingPanelViewStateMessage
  | SetMethodMessage
  | SetModeledMethodMessage
  | SetMethodModifiedMessage
  | SetSelectedMethodMessage
  | SetInModelingModeMessage;
