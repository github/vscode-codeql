import type { Log, Result } from "sarif";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
} from "../variant-analysis/shared/variant-analysis";
import type {
  RepositoriesFilterSortState,
  RepositoriesFilterSortStateWithIds,
} from "../variant-analysis/shared/variant-analysis-filter-sort";
import type { ErrorLike } from "../common/errors";
import type { DataFlowPaths } from "../variant-analysis/shared/data-flow-paths";
import type { Method, MethodSignature } from "../model-editor/method";
import type { ModeledMethod } from "../model-editor/modeled-method";
import type {
  MethodModelingPanelViewState,
  ModelAlertsViewState,
  ModelEditorViewState,
} from "../model-editor/shared/view-state";
import type { Mode } from "../model-editor/shared/mode";
import type { QueryLanguage } from "./query-language";
import type {
  Column,
  RawResultSet,
  Row,
  UrlValueResolvable,
} from "./raw-result-types";
import type { AccessPathSuggestionOptions } from "../model-editor/suggestions";
import type { ModelEvaluationRunState } from "../model-editor/shared/model-evaluation-run-state";

/**
 * This module contains types and code that are shared between
 * the webview and the extension.
 */

export const SELECT_TABLE_NAME = "#select";
export const ALERTS_TABLE_NAME = "alerts";
export const GRAPH_TABLE_NAME = "graph";

type RawTableResultSet = {
  t: "RawResultSet";
  resultSet: RawResultSet;
};

type InterpretedResultSet<T> = {
  t: "InterpretedResultSet";
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
} & Log;

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

export interface UserSettings {
  /** Whether to display links to the dataflow models that generated particular nodes in a flow path. */
  shouldShowProvenance: boolean;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  shouldShowProvenance: false,
};

/** Message indicating that the user's configuration settings have changed. */
interface SetUserSettingsMsg {
  t: "setUserSettings";
  userSettings: UserSettings;
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
  | SetUserSettingsMsg
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
 * Message from the results view to open a source
 * file at the provided location.
 */
interface ViewSourceFileMsg {
  t: "viewSourceFile";
  loc: UrlValueResolvable;
  /** URI of the database whose source archive contains the file, or `undefined` to open a file from
   * the local disk. The latter case is used for opening links to data extension model files. */
  databaseUri: string | undefined;
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

export type ToCompareViewMessage =
  | SetComparisonQueryInfoMessage
  | SetComparisonsMessage
  | StreamingComparisonSetupMessage
  | StreamingComparisonAddResultsMessage
  | StreamingComparisonCompleteMessage
  | SetUserSettingsMsg;

/**
 * Message to the compare view that sets the metadata of the compared queries.
 */
export interface SetComparisonQueryInfoMessage {
  readonly t: "setComparisonQueryInfo";
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
  readonly databaseUri: string;
  readonly commonResultSetNames: string[];
}

/**
 * Message to the compare view that specifies the query results to compare.
 */
export interface SetComparisonsMessage {
  readonly t: "setComparisons";
  readonly currentResultSetName: string;
  readonly result: QueryCompareResult | undefined;
  readonly message: string | undefined;
}

export type QueryCompareResult =
  | RawQueryCompareResult
  | InterpretedQueryCompareResult;

/**
 * from is the set of rows that have changes in the "from" query.
 * to is the set of rows that have changes in the "to" query.
 */
export type RawQueryCompareResult = {
  kind: "raw";
  columns: readonly Column[];
  from: Row[];
  to: Row[];
};

/**
 * from is the set of results that have changes in the "from" query.
 * to is the set of results that have changes in the "to" query.
 */
export type InterpretedQueryCompareResult = {
  kind: "interpreted";
  sourceLocationPrefix: string;
  from: Result[];
  to: Result[];
};

export interface StreamingComparisonSetupMessage {
  readonly t: "streamingComparisonSetup";
  // The id of this streaming comparison
  readonly id: string;
  readonly currentResultSetName: string;
  readonly message: string | undefined;
  // The from and to fields will only contain a chunk of the results
  readonly result: QueryCompareResult;
}

interface StreamingComparisonAddResultsMessage {
  readonly t: "streamingComparisonAddResults";
  readonly id: string;
  // The from and to fields will only contain a chunk of the results
  readonly result: QueryCompareResult;
}

interface StreamingComparisonCompleteMessage {
  readonly t: "streamingComparisonComplete";
  readonly id: string;
}

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

interface SetModeledAndModifiedMethodsMessage {
  t: "setModeledAndModifiedMethods";
  methods: Record<string, ModeledMethod[]>;
  modifiedMethodSignatures: string[];
}

interface SetModifiedMethodsMessage {
  t: "setModifiedMethods";
  methodSignatures: string[];
}

interface SwitchModeMessage {
  t: "switchMode";
  mode: Mode;
}

interface JumpToMethodMessage {
  t: "jumpToMethod";
  methodSignature: string;
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

interface StartModelEvaluationMessage {
  t: "startModelEvaluation";
}

interface StopModelEvaluationMessage {
  t: "stopModelEvaluation";
}

interface OpenModelAlertsViewMessage {
  t: "openModelAlertsView";
}

interface RevealInModelAlertsViewMessage {
  t: "revealInModelAlertsView";
  modeledMethod: ModeledMethod;
}

interface ModelDependencyMessage {
  t: "modelDependency";
}

interface HideModeledMethodsMessage {
  t: "hideModeledMethods";
  hideModeledMethods: boolean;
}

interface SetMultipleModeledMethodsMessage {
  t: "setMultipleModeledMethods";
  methodSignature: string;
  modeledMethods: ModeledMethod[];
}

interface SetInModelingModeMessage {
  t: "setInModelingMode";
  inModelingMode: boolean;
}

interface RevealMethodMessage {
  t: "revealMethod";
  methodSignature: string;
}

interface SetAccessPathSuggestionsMessage {
  t: "setAccessPathSuggestions";
  accessPathSuggestions: AccessPathSuggestionOptions;
}

interface SetModelEvaluationRunMessage {
  t: "setModelEvaluationRun";
  run: ModelEvaluationRunState | undefined;
}

export type ToModelEditorMessage =
  | SetExtensionPackStateMessage
  | SetMethodsMessage
  | SetModeledAndModifiedMethodsMessage
  | SetModifiedMethodsMessage
  | RevealMethodMessage
  | SetAccessPathSuggestionsMessage
  | SetModelEvaluationRunMessage;

export type FromModelEditorMessage =
  | CommonFromViewMessages
  | SwitchModeMessage
  | RefreshMethods
  | OpenDatabaseMessage
  | OpenExtensionPackMessage
  | JumpToMethodMessage
  | SaveModeledMethods
  | GenerateMethodMessage
  | ModelDependencyMessage
  | HideModeledMethodsMessage
  | SetMultipleModeledMethodsMessage
  | StartModelEvaluationMessage
  | StopModelEvaluationMessage
  | OpenModelAlertsViewMessage
  | RevealInModelAlertsViewMessage;

interface RevealInEditorMessage {
  t: "revealInModelEditor";
  method: MethodSignature;
}

interface StartModelingMessage {
  t: "startModeling";
}

export type FromMethodModelingMessage =
  | CommonFromViewMessages
  | SetMultipleModeledMethodsMessage
  | RevealInEditorMessage
  | StartModelingMessage;

interface SetMethodModelingPanelViewStateMessage {
  t: "setMethodModelingPanelViewState";
  viewState: MethodModelingPanelViewState;
}

interface SetMethodModifiedMessage {
  t: "setMethodModified";
  isModified: boolean;
}

interface SetNoMethodSelectedMessage {
  t: "setNoMethodSelected";
}

interface SetSelectedMethodMessage {
  t: "setSelectedMethod";
  method: Method;
  modeledMethods: ModeledMethod[];
  isModified: boolean;
}

export type ToMethodModelingMessage =
  | SetMethodModelingPanelViewStateMessage
  | SetMultipleModeledMethodsMessage
  | SetMethodModifiedMessage
  | SetNoMethodSelectedMessage
  | SetSelectedMethodMessage
  | SetInModelingModeMessage;

interface SetModelAlertsViewStateMessage {
  t: "setModelAlertsViewState";
  viewState: ModelAlertsViewState;
}

interface OpenModelPackMessage {
  t: "openModelPack";
  path: string;
}

interface OpenActionsLogsMessage {
  t: "openActionsLogs";
  variantAnalysisId: number;
}

interface StopEvaluationRunMessage {
  t: "stopEvaluationRun";
}

interface RevealModelMessage {
  t: "revealModel";
  modeledMethod: ModeledMethod;
}

export type ToModelAlertsMessage =
  | SetModelAlertsViewStateMessage
  | SetVariantAnalysisMessage
  | SetRepoResultsMessage
  | RevealModelMessage;

export type FromModelAlertsMessage =
  | CommonFromViewMessages
  | OpenModelPackMessage
  | OpenActionsLogsMessage
  | StopEvaluationRunMessage
  | RevealInEditorMessage;
