import type { CommandManager } from "../packages/commands";
import type { Uri, Range, TextDocumentShowOptions } from "vscode";
import type { AstItem } from "../astViewer";
import type { DbTreeViewItem } from "../databases/ui/db-tree-view-item";
import type { DatabaseItem } from "../local-databases";
import type { QueryHistoryInfo } from "../query-history/query-history-info";
import type { RepositoriesFilterSortStateWithIds } from "../pure/variant-analysis-filter-sort";
import type { TestTreeNode } from "../test-tree-node";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisScannedRepositoryResult,
} from "../variant-analysis/shared/variant-analysis";

// A command function matching the signature that VS Code calls when
// a command on a selection is invoked.
export type SelectionCommandFunction<Item> = (
  singleItem: Item,
  multiSelect: Item[],
) => Promise<void>;

// A command function matching the signature that VS Code calls when
// a command on a selection is invoked when canSelectMany is false.
export type SingleSelectionCommandFunction<Item> = (
  singleItem: Item,
) => Promise<void>;

/**
 * Contains type definitions for all commands used by the extension.
 *
 * To add a new command first define its type here, then provide
 * the implementation in the corresponding `getCommands` function.
 */

// Builtin commands where the implementation is provided by VS Code and not by this extension.
// See https://code.visualstudio.com/api/references/commands
export type BuiltInVsCodeCommands = {
  // The codeQLDatabases.focus command is provided by VS Code because we've registered the custom view
  "codeQLDatabases.focus": () => Promise<void>;
  "markdown.showPreviewToSide": (uri: Uri) => Promise<void>;
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
};

// Commands used for running local queries
export type LocalQueryCommands = {
  "codeQL.runQuery": (uri?: Uri) => Promise<void>;
  "codeQL.runQueryContextEditor": (uri?: Uri) => Promise<void>;
  "codeQL.runQueryOnMultipleDatabases": (uri?: Uri) => Promise<void>;
  "codeQL.runQueryOnMultipleDatabasesContextEditor": (
    uri?: Uri,
  ) => Promise<void>;
  "codeQL.runQueries": SelectionCommandFunction<Uri>;
  "codeQL.quickEval": (uri: Uri) => Promise<void>;
  "codeQL.quickEvalContextEditor": (uri: Uri) => Promise<void>;
  "codeQL.codeLensQuickEval": (uri: Uri, range: Range) => Promise<void>;
  "codeQL.quickQuery": () => Promise<void>;
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
  "codeQLQueryHistory.openQueryTitleMenu": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.openQueryContextMenu": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.removeHistoryItemTitleMenu": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.removeHistoryItemContextMenu": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.removeHistoryItemContextInline": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.renameItem": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.compareWith": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.showEvalLog": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.showEvalLogSummary": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.showEvalLogViewer": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.showQueryLog": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.showQueryText": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.openQueryDirectory": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.cancel": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.exportResults": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.viewCsvResults": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.viewCsvAlerts": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.viewSarifAlerts": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.viewDil": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.itemClicked": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.openOnGithub": SelectionCommandFunction<QueryHistoryInfo>;
  "codeQLQueryHistory.copyRepoList": SelectionCommandFunction<QueryHistoryInfo>;

  // Commands in the command palette
  "codeQL.exportSelectedVariantAnalysisResults": () => Promise<void>;
};

// Commands used for the local databases panel
export type LocalDatabasesCommands = {
  // Command palette commands
  "codeQL.chooseDatabaseFolder": () => Promise<void>;
  "codeQL.chooseDatabaseArchive": () => Promise<void>;
  "codeQL.chooseDatabaseInternet": () => Promise<void>;
  "codeQL.chooseDatabaseGithub": () => Promise<void>;
  "codeQL.upgradeCurrentDatabase": () => Promise<void>;
  "codeQL.clearCache": () => Promise<void>;

  // Explorer context menu
  "codeQL.setCurrentDatabase": (uri: Uri) => Promise<void>;

  // Database panel view title commands
  "codeQLDatabases.chooseDatabaseFolder": () => Promise<void>;
  "codeQLDatabases.chooseDatabaseArchive": () => Promise<void>;
  "codeQLDatabases.chooseDatabaseInternet": () => Promise<void>;
  "codeQLDatabases.chooseDatabaseGithub": () => Promise<void>;
  "codeQLDatabases.sortByName": () => Promise<void>;
  "codeQLDatabases.sortByDateAdded": () => Promise<void>;

  // Database panel context menu
  "codeQLDatabases.setCurrentDatabase": (
    databaseItem: DatabaseItem,
  ) => Promise<void>;

  // Database panel selection commands
  "codeQLDatabases.removeDatabase": SelectionCommandFunction<DatabaseItem>;
  "codeQLDatabases.upgradeDatabase": SelectionCommandFunction<DatabaseItem>;
  "codeQLDatabases.renameDatabase": SelectionCommandFunction<DatabaseItem>;
  "codeQLDatabases.openDatabaseFolder": SelectionCommandFunction<DatabaseItem>;
  "codeQLDatabases.addDatabaseSource": SelectionCommandFunction<DatabaseItem>;

  // Codespace template commands
  "codeQL.setDefaultTourDatabase": () => Promise<void>;

  // Internal commands
  "codeQLDatabases.removeOrphanedDatabases": () => Promise<void>;
};

// Commands tied to variant analysis
export type VariantAnalysisCommands = {
  "codeQL.autoDownloadVariantAnalysisResult": (
    scannedRepo: VariantAnalysisScannedRepository,
    variantAnalysisSummary: VariantAnalysis,
  ) => Promise<void>;
  "codeQL.copyVariantAnalysisRepoList": (
    variantAnalysisId: number,
    filterSort?: RepositoriesFilterSortStateWithIds,
  ) => Promise<void>;
  "codeQL.loadVariantAnalysisRepoResults": (
    variantAnalysisId: number,
    repositoryFullName: string,
  ) => Promise<VariantAnalysisScannedRepositoryResult>;
  "codeQL.monitorVariantAnalysis": (
    variantAnalysis: VariantAnalysis,
  ) => Promise<void>;
  "codeQL.openVariantAnalysisLogs": (
    variantAnalysisId: number,
  ) => Promise<void>;
  "codeQL.openVariantAnalysisView": (
    variantAnalysisId: number,
  ) => Promise<void>;
  "codeQL.runVariantAnalysis": (uri?: Uri) => Promise<void>;
  "codeQL.runVariantAnalysisContextEditor": (uri?: Uri) => Promise<void>;
};

export type DatabasePanelCommands = {
  "codeQLVariantAnalysisRepositories.openConfigFile": () => Promise<void>;
  "codeQLVariantAnalysisRepositories.addNewDatabase": () => Promise<void>;
  "codeQLVariantAnalysisRepositories.addNewList": () => Promise<void>;
  "codeQLVariantAnalysisRepositories.setupControllerRepository": () => Promise<void>;

  "codeQLVariantAnalysisRepositories.setSelectedItem": SingleSelectionCommandFunction<DbTreeViewItem>;
  "codeQLVariantAnalysisRepositories.setSelectedItemContextMenu": SingleSelectionCommandFunction<DbTreeViewItem>;
  "codeQLVariantAnalysisRepositories.openOnGitHubContextMenu": SingleSelectionCommandFunction<DbTreeViewItem>;
  "codeQLVariantAnalysisRepositories.renameItemContextMenu": SingleSelectionCommandFunction<DbTreeViewItem>;
  "codeQLVariantAnalysisRepositories.removeItemContextMenu": SingleSelectionCommandFunction<DbTreeViewItem>;
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

export type DataExtensionsEditorCommands = {
  "codeQL.openDataExtensionsEditor": () => Promise<void>;
};

export type EvalLogViewerCommands = {
  "codeQLEvalLogViewer.clear": () => Promise<void>;
};

export type SummaryLanguageSupportCommands = {
  "codeQL.gotoQL": () => Promise<void>;
};

export type TestUICommands = {
  "codeQLTests.showOutputDifferences": (node: TestTreeNode) => Promise<void>;
  "codeQLTests.acceptOutput": (node: TestTreeNode) => Promise<void>;
};

export type MockGitHubApiServerCommands = {
  "codeQL.mockGitHubApiServer.startRecording": () => Promise<void>;
  "codeQL.mockGitHubApiServer.saveScenario": () => Promise<void>;
  "codeQL.mockGitHubApiServer.cancelRecording": () => Promise<void>;
  "codeQL.mockGitHubApiServer.loadScenario": () => Promise<void>;
  "codeQL.mockGitHubApiServer.unloadScenario": () => Promise<void>;
};

// All commands where the implementation is provided by this activated extension.
export type AllExtensionCommands = BaseCommands &
  QueryEditorCommands &
  ResultsViewCommands &
  QueryHistoryCommands &
  LocalDatabasesCommands &
  VariantAnalysisCommands &
  DatabasePanelCommands &
  AstCfgCommands &
  AstViewerCommands &
  PackagingCommands &
  DataExtensionsEditorCommands &
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
