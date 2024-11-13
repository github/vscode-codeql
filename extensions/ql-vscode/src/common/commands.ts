import type { CommandManager } from "../packages/commands";
import type { Uri, Range, TextDocumentShowOptions, TestItem } from "vscode";
import type { AstItem } from "../language-support";
import type { DbTreeViewItem } from "../databases/ui/db-tree-view-item";
import type { DatabaseItem } from "../databases/local-databases";
import type { QueryHistoryInfo } from "../query-history/query-history-info";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisScannedRepositoryResult,
} from "../variant-analysis/shared/variant-analysis";
import type { QLDebugConfiguration } from "../debugger/debug-configuration";
import type { QueryTreeViewItem } from "../queries-panel/query-tree-view-item";
import type { LanguageSelectionTreeViewItem } from "../language-selection-panel/language-selection-data-provider";
import type { Method, Usage } from "../model-editor/method";

// A command function matching the signature that VS Code calls when
// a command is invoked from a context menu on a TreeView with
// canSelectMany set to true.
//
// singleItem will always be defined and corresponds to the item that
// was hovered or right-clicked. If precisely one item was selected then
// multiSelect will be undefined. If more than one item is selected then
// multiSelect will contain all selected items, including singleItem.
export type TreeViewContextMultiSelectionCommandFunction<Item> = (
  singleItem: Item,
  multiSelect: Item[] | undefined,
) => Promise<void>;

// A command function matching the signature that VS Code calls when
// a command is invoked from a context menu on a TreeView with
// canSelectMany set to false.
//
// It is guaranteed that precisely one item will be selected.
export type TreeViewContextSingleSelectionCommandFunction<Item> = (
  singleItem: Item,
) => Promise<void>;

// A command function matching the signature that VS Code calls when
// a command is invoked from a context menu on the file explorer.
//
// singleItem corresponds to the item that was right-clicked.
// multiSelect will always been defined and non-empty and contains
// all selected items, including singleItem.
export type ExplorerSelectionCommandFunction<Item> = (
  singleItem: Item,
  multiSelect: Item[],
) => Promise<void>;

/**
 * Contains type definitions for all commands used by the extension.
 *
 * To add a new command first define its type here, then provide
 * the implementation in the corresponding `getCommands` function.
 */

// Builtin commands where the implementation is provided by VS Code and not by this extension.
// See https://code.visualstudio.com/api/references/commands
type BuiltInVsCodeCommands = {
  // The codeQLDatabases.focus command is provided by VS Code because we've registered the custom view
  "codeQLDatabases.focus": () => Promise<void>;
  "markdown.showPreviewToSide": (uri: Uri) => Promise<void>;
  "workbench.action.closeActiveEditor": () => Promise<void>;
  revealFileInOS: (uri: Uri) => Promise<void>;
  setContext: (
    key: `${"codeql" | "codeQL"}${string}`,
    value: unknown,
  ) => Promise<void>;
  "workbench.action.reloadWindow": () => Promise<void>;
  "vscode.diff": (
    leftSideResource: Uri,
    rightSideResource: Uri,
    title?: string,
    columnOrOptions?: TextDocumentShowOptions,
  ) => Promise<void>;
  "vscode.open": (uri: Uri) => Promise<void>;
  "vscode.openFolder": (uri: Uri) => Promise<void>;
  revealInExplorer: (uri: Uri) => Promise<void>;
  // We type the `config` property specifically as a CodeQL debug configuration, since that's the
  // only kinds we specify anyway.
  "workbench.action.debug.start": (options?: {
    config?: Partial<QLDebugConfiguration>;
    noDebug?: boolean;
  }) => Promise<void>;
  "workbench.action.debug.stepInto": () => Promise<void>;
  "workbench.action.debug.stepOver": () => Promise<void>;
  "workbench.action.debug.stepOut": () => Promise<void>;
};

// Commands that are available before the extension is fully activated.
// These commands are *not* registered using the command manager, but can
// be invoked using the command manager.
export type PreActivationCommands = {
  "codeQL.checkForUpdatesToCLI": () => Promise<void>;
};

// Base commands not tied directly to a module like e.g. variant analysis.
export type BaseCommands = {
  "codeQL.openDocumentation": () => Promise<void>;
  "codeQL.showLogs": () => Promise<void>;
  "codeQL.authenticateToGitHub": () => Promise<void>;

  "codeQL.copyVersion": () => Promise<void>;
  "codeQL.restartQueryServer": () => Promise<void>;
  "codeQL.restartQueryServerOnConfigChange": () => Promise<void>;
  "codeQL.restartLegacyQueryServerOnConfigChange": () => Promise<void>;
  "codeQL.restartQueryServerOnExternalConfigChange": () => Promise<void>;
};

// Commands used when working with queries in the editor
export type QueryEditorCommands = {
  "codeQL.openReferencedFile": (selectedQuery: Uri) => Promise<void>;
  "codeQL.openReferencedFileContextEditor": (
    selectedQuery: Uri,
  ) => Promise<void>;
  "codeQL.openReferencedFileContextExplorer": (
    selectedQuery: Uri,
  ) => Promise<void>;
  "codeQL.previewQueryHelp": (selectedQuery: Uri) => Promise<void>;
  "codeQL.previewQueryHelpContextEditor": (selectedQuery: Uri) => Promise<void>;
  "codeQL.previewQueryHelpContextExplorer": (
    selectedQuery: Uri,
  ) => Promise<void>;
};

// Commands used for running local queries
export type LocalQueryCommands = {
  "codeQL.runQuery": (uri?: Uri) => Promise<void>;
  "codeQL.runQueryContextEditor": (uri?: Uri) => Promise<void>;
  "codeQL.runQueryOnMultipleDatabases": (uri?: Uri) => Promise<void>;
  "codeQL.runQueryOnMultipleDatabasesContextEditor": (
    uri?: Uri,
  ) => Promise<void>;
  "codeQLQueries.runLocalQueryFromQueriesPanel": TreeViewContextSingleSelectionCommandFunction<QueryTreeViewItem>;
  "codeQLQueries.runLocalQueryContextMenu": TreeViewContextSingleSelectionCommandFunction<QueryTreeViewItem>;
  "codeQLQueries.runLocalQueriesContextMenu": TreeViewContextSingleSelectionCommandFunction<QueryTreeViewItem>;
  "codeQLQueries.runLocalQueriesFromPanel": TreeViewContextSingleSelectionCommandFunction<QueryTreeViewItem>;
  "codeQLQueries.createQuery": () => Promise<void>;
  "codeQL.runLocalQueryFromFileTab": (uri: Uri) => Promise<void>;
  "codeQL.runQueries": ExplorerSelectionCommandFunction<Uri>;
  "codeQL.quickEval": (uri: Uri) => Promise<void>;
  "codeQL.quickEvalCount": (uri: Uri) => Promise<void>;
  "codeQL.quickEvalContextEditor": (uri: Uri) => Promise<void>;
  "codeQL.codeLensQuickEval": (uri: Uri, range: Range) => Promise<void>;
  "codeQL.quickQuery": () => Promise<void>;
  "codeQL.getCurrentQuery": () => Promise<string>;
  "codeQL.createQuery": () => Promise<void>;
  "codeQLQuickQuery.createQuery": () => Promise<void>;
};

// Debugger commands
export type DebuggerCommands = {
  "codeQL.debugQuery": (uri: Uri | undefined) => Promise<void>;
  "codeQL.debugQueryContextEditor": (uri: Uri) => Promise<void>;
  "codeQL.startDebuggingSelection": () => Promise<void>;
  "codeQL.startDebuggingSelectionContextEditor": () => Promise<void>;
  "codeQL.continueDebuggingSelection": () => Promise<void>;
  "codeQL.continueDebuggingSelectionContextEditor": () => Promise<void>;
};

export type ResultsViewCommands = {
  "codeQLQueryResults.up": () => Promise<void>;
  "codeQLQueryResults.down": () => Promise<void>;
  "codeQLQueryResults.left": () => Promise<void>;
  "codeQLQueryResults.right": () => Promise<void>;
  "codeQLQueryResults.nextPathStep": () => Promise<void>;
  "codeQLQueryResults.previousPathStep": () => Promise<void>;
};

// Commands used for the query history panel
export type QueryHistoryCommands = {
  // Commands in the "navigation" group
  "codeQLQueryHistory.sortByName": () => Promise<void>;
  "codeQLQueryHistory.sortByDate": () => Promise<void>;
  "codeQLQueryHistory.sortByCount": () => Promise<void>;

  // Commands in the context menu or in the hover menu
  "codeQLQueryHistory.openQueryContextMenu": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.removeHistoryItemContextMenu": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.removeHistoryItemContextInline": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.renameItem": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.compareWith": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.showEvalLog": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.showEvalLogSummary": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.showEvalLogViewer": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.showQueryLog": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.showQueryText": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.openQueryDirectory": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.cancel": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.exportResults": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.viewCsvResults": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.viewCsvAlerts": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.viewSarifAlerts": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.viewDil": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.itemClicked": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.openOnGithub": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.copyRepoList": TreeViewContextMultiSelectionCommandFunction<QueryHistoryInfo>;

  // Commands in the command palette
  "codeQL.exportSelectedVariantAnalysisResults": () => Promise<void>;
};

// Commands user for the language selector panel
export type LanguageSelectionCommands = {
  "codeQLLanguageSelection.setSelectedItem": (
    item: LanguageSelectionTreeViewItem,
  ) => Promise<void>;
};

// Commands used for the local databases panel
export type LocalDatabasesCommands = {
  // Command palette commands
  "codeQL.chooseDatabaseFolder": () => Promise<void>;
  "codeQL.chooseDatabaseFoldersParent": () => Promise<void>;
  "codeQL.chooseDatabaseArchive": () => Promise<void>;
  "codeQL.chooseDatabaseInternet": () => Promise<void>;
  "codeQL.chooseDatabaseGithub": () => Promise<void>;
  "codeQL.upgradeCurrentDatabase": () => Promise<void>;
  "codeQL.clearCache": () => Promise<void>;
  "codeQL.trimCache": () => Promise<void>;

  // Explorer context menu
  "codeQL.setCurrentDatabase": (uri: Uri) => Promise<void>;
  "codeQL.importTestDatabase": (uri: Uri) => Promise<void>;

  // Database panel view title commands
  "codeQLDatabases.chooseDatabaseFolder": () => Promise<void>;
  "codeQLDatabases.chooseDatabaseArchive": () => Promise<void>;
  "codeQLDatabases.chooseDatabaseInternet": () => Promise<void>;
  "codeQLDatabases.chooseDatabaseGithub": () => Promise<void>;
  "codeQLDatabases.sortByName": () => Promise<void>;
  "codeQLDatabases.sortByLanguage": () => Promise<void>;
  "codeQLDatabases.sortByDateAdded": () => Promise<void>;

  // Database panel context menu
  "codeQLDatabases.setCurrentDatabase": (
    databaseItem: DatabaseItem,
  ) => Promise<void>;

  // Database panel selection commands
  "codeQLDatabases.removeDatabase": TreeViewContextMultiSelectionCommandFunction<DatabaseItem>;
  "codeQLDatabases.upgradeDatabase": TreeViewContextMultiSelectionCommandFunction<DatabaseItem>;
  "codeQLDatabases.renameDatabase": TreeViewContextMultiSelectionCommandFunction<DatabaseItem>;
  "codeQLDatabases.openDatabaseFolder": TreeViewContextMultiSelectionCommandFunction<DatabaseItem>;
  "codeQLDatabases.addDatabaseSource": TreeViewContextMultiSelectionCommandFunction<DatabaseItem>;

  // Codespace template commands
  "codeQL.setDefaultTourDatabase": () => Promise<void>;

  // Internal commands
  "codeQLDatabases.removeOrphanedDatabases": () => Promise<void>;
  "codeQL.getCurrentDatabase": () => Promise<string | undefined>;
};

// Commands tied to variant analysis
export type VariantAnalysisCommands = {
  "codeQL.autoDownloadVariantAnalysisResult": (
    scannedRepo: VariantAnalysisScannedRepository,
    variantAnalysisSummary: VariantAnalysis,
  ) => Promise<void>;
  "codeQL.loadVariantAnalysisRepoResults": (
    variantAnalysisId: number,
    repositoryFullName: string,
  ) => Promise<VariantAnalysisScannedRepositoryResult>;
  "codeQL.monitorNewVariantAnalysis": (
    variantAnalysis: VariantAnalysis,
  ) => Promise<void>;
  "codeQL.monitorRehydratedVariantAnalysis": (
    variantAnalysis: VariantAnalysis,
  ) => Promise<void>;
  "codeQL.monitorReauthenticatedVariantAnalysis": (
    variantAnalysis: VariantAnalysis,
  ) => Promise<void>;
  "codeQL.openVariantAnalysisLogs": (
    variantAnalysisId: number,
  ) => Promise<void>;
  "codeQLModelAlerts.openVariantAnalysisLogs": (
    variantAnalysisId: number,
  ) => Promise<void>;
  "codeQL.openVariantAnalysisView": (
    variantAnalysisId: number,
  ) => Promise<void>;
  "codeQL.runVariantAnalysis": () => Promise<void>;
  "codeQL.runVariantAnalysisContextEditor": (uri: Uri) => Promise<void>;
  "codeQL.runVariantAnalysisContextExplorer": ExplorerSelectionCommandFunction<Uri>;
  "codeQLQueries.runVariantAnalysisContextMenu": TreeViewContextSingleSelectionCommandFunction<QueryTreeViewItem>;
  "codeQL.runVariantAnalysisPublishedPack": () => Promise<void>;
};

export type DatabasePanelCommands = {
  "codeQLVariantAnalysisRepositories.openConfigFile": () => Promise<void>;
  "codeQLVariantAnalysisRepositories.addNewDatabase": () => Promise<void>;
  "codeQLVariantAnalysisRepositories.addNewList": () => Promise<void>;
  "codeQLVariantAnalysisRepositories.setupControllerRepository": () => Promise<void>;

  "codeQLVariantAnalysisRepositories.setSelectedItem": TreeViewContextSingleSelectionCommandFunction<DbTreeViewItem>;
  "codeQLVariantAnalysisRepositories.setSelectedItemContextMenu": TreeViewContextSingleSelectionCommandFunction<DbTreeViewItem>;
  "codeQLVariantAnalysisRepositories.openOnGitHubContextMenu": TreeViewContextSingleSelectionCommandFunction<DbTreeViewItem>;
  "codeQLVariantAnalysisRepositories.renameItemContextMenu": TreeViewContextSingleSelectionCommandFunction<DbTreeViewItem>;
  "codeQLVariantAnalysisRepositories.removeItemContextMenu": TreeViewContextSingleSelectionCommandFunction<DbTreeViewItem>;
  "codeQLVariantAnalysisRepositories.importFromCodeSearch": TreeViewContextSingleSelectionCommandFunction<DbTreeViewItem>;
};

export type AstCfgCommands = {
  "codeQL.viewAst": (selectedFile: Uri) => Promise<void>;
  "codeQL.viewAstContextExplorer": (selectedFile: Uri) => Promise<void>;
  "codeQL.viewAstContextEditor": (selectedFile: Uri) => Promise<void>;
  "codeQL.viewCfg": () => Promise<void>;
  "codeQL.viewCfgContextExplorer": () => Promise<void>;
  "codeQL.viewCfgContextEditor": () => Promise<void>;
};

export type AstViewerCommands = {
  "codeQLAstViewer.clear": () => Promise<void>;
  "codeQLAstViewer.gotoCode": (item: AstItem) => Promise<void>;
};

export type PackagingCommands = {
  "codeQL.installPackDependencies": () => Promise<void>;
  "codeQL.downloadPacks": () => Promise<void>;
};

export type ModelEditorCommands = {
  "codeQL.openModelEditor": () => Promise<void>;
  "codeQL.openModelEditorFromModelingPanel": () => Promise<void>;
  "codeQLModelEditor.jumpToMethod": (
    method: Method,
    usage: Usage,
    databaseItem: DatabaseItem,
  ) => Promise<void>;
};

export type EvalLogViewerCommands = {
  "codeQLEvalLogViewer.clear": () => Promise<void>;
};

export type SummaryLanguageSupportCommands = {
  "codeQL.gotoQL": () => Promise<void>;
  "codeQL.gotoQLContextEditor": () => Promise<void>;
};

export type TestUICommands = {
  "codeQLTests.showOutputDifferences": (node: TestItem) => Promise<void>;
  "codeQLTests.acceptOutput": (node: TestItem) => Promise<void>;
  "codeQLTests.acceptOutputContextTestItem": (node: TestItem) => Promise<void>;
};

export type MockGitHubApiServerCommands = {
  "codeQL.mockGitHubApiServer.startRecording": () => Promise<void>;
  "codeQL.mockGitHubApiServer.saveScenario": () => Promise<void>;
  "codeQL.mockGitHubApiServer.cancelRecording": () => Promise<void>;
  "codeQL.mockGitHubApiServer.loadScenario": (
    scenario?: string,
  ) => Promise<void>;
  "codeQL.mockGitHubApiServer.unloadScenario": () => Promise<void>;
};

// All commands where the implementation is provided by this activated extension.
export type AllExtensionCommands = BaseCommands &
  QueryEditorCommands &
  ResultsViewCommands &
  QueryHistoryCommands &
  LanguageSelectionCommands &
  LocalDatabasesCommands &
  DebuggerCommands &
  VariantAnalysisCommands &
  DatabasePanelCommands &
  AstCfgCommands &
  AstViewerCommands &
  PackagingCommands &
  ModelEditorCommands &
  EvalLogViewerCommands &
  SummaryLanguageSupportCommands &
  Partial<TestUICommands> &
  MockGitHubApiServerCommands;

export type AllCommands = AllExtensionCommands &
  PreActivationCommands &
  BuiltInVsCodeCommands;

export type AppCommandManager = CommandManager<AllCommands>;

// Separate command manager because it uses a different logger
export type QueryServerCommands = LocalQueryCommands;
export type QueryServerCommandManager = CommandManager<QueryServerCommands>;
