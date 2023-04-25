import { join, dirname } from "path";
import {
  Disposable,
  env,
  EventEmitter,
  ExtensionContext,
  ProviderResult,
  Range,
  TreeView,
  Uri,
  ViewColumn,
  window,
  workspace,
} from "vscode";
import { QueryHistoryConfig } from "../config";
import {
  showAndLogErrorMessage,
  showAndLogInformationMessage,
  showAndLogWarningMessage,
  showBinaryChoiceDialog,
  showInformationMessageWithAction,
} from "../helpers";
import { extLogger } from "../common";
import { URLSearchParams } from "url";
import { DisposableObject } from "../pure/disposable-object";
import { ONE_HOUR_IN_MS, TWO_HOURS_IN_MS } from "../pure/time";
import { assertNever, getErrorMessage } from "../pure/helpers-pure";
import { CompletedLocalQueryInfo, LocalQueryInfo } from "../query-results";
import {
  getActionsWorkflowRunUrl,
  getQueryId,
  getQueryText,
  QueryHistoryInfo,
} from "./query-history-info";
import { DatabaseManager } from "../local-databases";
import { registerQueryHistoryScrubber } from "./query-history-scrubber";
import {
  QueryStatus,
  variantAnalysisStatusToQueryStatus,
} from "../query-status";
import { readQueryHistoryFromFile, writeQueryHistoryToFile } from "./store";
import { pathExists } from "fs-extra";
import { CliVersionConstraint } from "../cli";
import { HistoryItemLabelProvider } from "./history-item-label-provider";
import { ResultsView } from "../interface";
import { WebviewReveal } from "../interface-utils";
import { EvalLogViewer } from "../eval-log-viewer";
import EvalLogTreeBuilder from "../eval-log-tree-builder";
import { EvalLogData, parseViewerData } from "../pure/log-summary-parser";
import { QueryWithResults } from "../run-queries-shared";
import { QueryRunner } from "../query-server";
import { VariantAnalysisManager } from "../variant-analysis/variant-analysis-manager";
import { VariantAnalysisHistoryItem } from "./variant-analysis-history-item";
import { getTotalResultCount } from "../variant-analysis/shared/variant-analysis";
import { HistoryTreeDataProvider } from "./history-tree-data-provider";
import { QueryHistoryDirs } from "./query-history-dirs";
import { QueryHistoryCommands } from "../common/commands";
import { App } from "../common/app";
import { tryOpenExternalFile } from "../vscode-utils/external-files";

/**
 * query-history-manager.ts
 * ------------
 * Managing state of previous queries that we've executed.
 *
 * The source of truth of the current state resides inside the
 * `TreeDataProvider` subclass below.
 */

export const SHOW_QUERY_TEXT_MSG = `\
////////////////////////////////////////////////////////////////////////////////////
// This is the text of the entire query file when it was executed for this query  //
// run. The text or dependent libraries may have changed since then.              //
//                                                                                //
// This buffer is readonly. To re-execute this query, you must open the original  //
// query file.                                                                    //
////////////////////////////////////////////////////////////////////////////////////

`;

const SHOW_QUERY_TEXT_QUICK_EVAL_MSG = `\
////////////////////////////////////////////////////////////////////////////////////
// This is the Quick Eval selection of the query file when it was executed for    //
// this query run. The text or dependent libraries may have changed since then.   //
//                                                                                //
// This buffer is readonly. To re-execute this query, you must open the original  //
// query file.                                                                    //
////////////////////////////////////////////////////////////////////////////////////

`;

export enum SortOrder {
  NameAsc = "NameAsc",
  NameDesc = "NameDesc",
  DateAsc = "DateAsc",
  DateDesc = "DateDesc",
  CountAsc = "CountAsc",
  CountDesc = "CountDesc",
}

/**
 * Number of milliseconds two clicks have to arrive apart to be
 * considered a double-click.
 */
const DOUBLE_CLICK_TIME = 500;

const WORKSPACE_QUERY_HISTORY_FILE = "workspace-query-history.json";

export class QueryHistoryManager extends DisposableObject {
  treeDataProvider: HistoryTreeDataProvider;
  treeView: TreeView<QueryHistoryInfo>;
  lastItemClick: { time: Date; item: QueryHistoryInfo } | undefined;
  compareWithItem: LocalQueryInfo | undefined;
  queryHistoryScrubber: Disposable | undefined;
  private queryMetadataStorageLocation;

  private readonly _onDidChangeCurrentQueryItem = super.push(
    new EventEmitter<QueryHistoryInfo | undefined>(),
  );
  readonly onDidChangeCurrentQueryItem =
    this._onDidChangeCurrentQueryItem.event;

  private readonly _onDidCompleteQuery = super.push(
    new EventEmitter<LocalQueryInfo>(),
  );
  readonly onDidCompleteQuery = this._onDidCompleteQuery.event;

  constructor(
    private readonly app: App,
    private readonly qs: QueryRunner,
    private readonly dbm: DatabaseManager,
    private readonly localQueriesResultsView: ResultsView,
    private readonly variantAnalysisManager: VariantAnalysisManager,
    private readonly evalLogViewer: EvalLogViewer,
    private readonly queryHistoryDirs: QueryHistoryDirs,
    ctx: ExtensionContext,
    private readonly queryHistoryConfigListener: QueryHistoryConfig,
    private readonly labelProvider: HistoryItemLabelProvider,
    private readonly doCompareCallback: (
      from: CompletedLocalQueryInfo,
      to: CompletedLocalQueryInfo,
    ) => Promise<void>,
  ) {
    super();

    // Note that we use workspace storage to hold the metadata for the query history.
    // This is because the query history is specific to each workspace.
    // For situations where `ctx.storageUri` is undefined (i.e., there is no workspace),
    // we default to global storage.
    this.queryMetadataStorageLocation = join(
      (ctx.storageUri || ctx.globalStorageUri).fsPath,
      WORKSPACE_QUERY_HISTORY_FILE,
    );

    this.treeDataProvider = this.push(
      new HistoryTreeDataProvider(this.labelProvider),
    );
    this.treeView = this.push(
      window.createTreeView("codeQLQueryHistory", {
        treeDataProvider: this.treeDataProvider,
        canSelectMany: true,
      }),
    );

    // Forward any change of current history item from the tree data.
    this.push(
      this.treeDataProvider.onDidChangeCurrentQueryItem((item) => {
        this._onDidChangeCurrentQueryItem.fire(item);
      }),
    );

    // Lazily update the tree view selection due to limitations of TreeView API (see
    // `updateTreeViewSelectionIfVisible` doc for details)
    this.push(
      this.treeView.onDidChangeVisibility(async (_ev) =>
        this.updateTreeViewSelectionIfVisible(),
      ),
    );
    this.push(
      this.treeView.onDidChangeSelection(async (ev) => {
        if (ev.selection.length === 0) {
          // Don't allow the selection to become empty
          this.updateTreeViewSelectionIfVisible();
        } else {
          this.treeDataProvider.setCurrentItem(ev.selection[0]);
        }
        if (ev.selection.some((item) => item.t !== "local")) {
          // Don't allow comparison of non-local items
          this.updateCompareWith([]);
        } else {
          this.updateCompareWith([...ev.selection] as LocalQueryInfo[]);
        }
      }),
    );

    // There are two configuration items that affect the query history:
    // 1. The ttl for query history items.
    // 2. The default label for query history items.
    // When either of these change, must refresh the tree view.
    this.push(
      queryHistoryConfigListener.onDidChangeConfiguration(() => {
        this.treeDataProvider.refresh();
        this.registerQueryHistoryScrubber(
          queryHistoryConfigListener,
          this,
          ctx,
        );
      }),
    );

    // displays query text in a read-only document
    this.push(
      workspace.registerTextDocumentContentProvider("codeql", {
        provideTextDocumentContent(uri: Uri): ProviderResult<string> {
          const params = new URLSearchParams(uri.query);

          return (
            (JSON.parse(params.get("isQuickEval") || "")
              ? SHOW_QUERY_TEXT_QUICK_EVAL_MSG
              : SHOW_QUERY_TEXT_MSG) + params.get("queryText")
          );
        },
      }),
    );

    this.registerQueryHistoryScrubber(queryHistoryConfigListener, this, ctx);
    this.registerToVariantAnalysisEvents();
  }

  public getCommands(): QueryHistoryCommands {
    return {
      "codeQLQueryHistory.sortByName": this.handleSortByName.bind(this),
      "codeQLQueryHistory.sortByDate": this.handleSortByDate.bind(this),
      "codeQLQueryHistory.sortByCount": this.handleSortByCount.bind(this),

      "codeQLQueryHistory.openQueryContextMenu":
        this.handleOpenQuery.bind(this),
      "codeQLQueryHistory.removeHistoryItemContextMenu":
        this.handleRemoveHistoryItem.bind(this),
      "codeQLQueryHistory.removeHistoryItemContextInline":
        this.handleRemoveHistoryItem.bind(this),
      "codeQLQueryHistory.renameItem": this.handleRenameItem.bind(this),
      "codeQLQueryHistory.compareWith": this.handleCompareWith.bind(this),
      "codeQLQueryHistory.showEvalLog": this.handleShowEvalLog.bind(this),
      "codeQLQueryHistory.showEvalLogSummary":
        this.handleShowEvalLogSummary.bind(this),
      "codeQLQueryHistory.showEvalLogViewer":
        this.handleShowEvalLogViewer.bind(this),
      "codeQLQueryHistory.showQueryLog": this.handleShowQueryLog.bind(this),
      "codeQLQueryHistory.showQueryText": this.handleShowQueryText.bind(this),
      "codeQLQueryHistory.openQueryDirectory":
        this.handleOpenQueryDirectory.bind(this),
      "codeQLQueryHistory.cancel": this.handleCancel.bind(this),
      "codeQLQueryHistory.exportResults": this.handleExportResults.bind(this),
      "codeQLQueryHistory.viewCsvResults": this.handleViewCsvResults.bind(this),
      "codeQLQueryHistory.viewCsvAlerts": this.handleViewCsvAlerts.bind(this),
      "codeQLQueryHistory.viewSarifAlerts":
        this.handleViewSarifAlerts.bind(this),
      "codeQLQueryHistory.viewDil": this.handleViewDil.bind(this),
      "codeQLQueryHistory.itemClicked": this.handleItemClicked.bind(this),
      "codeQLQueryHistory.openOnGithub": this.handleOpenOnGithub.bind(this),
      "codeQLQueryHistory.copyRepoList": this.handleCopyRepoList.bind(this),

      "codeQL.exportSelectedVariantAnalysisResults":
        this.exportSelectedVariantAnalysisResults.bind(this),
    };
  }

  public completeQuery(info: LocalQueryInfo, results: QueryWithResults): void {
    info.completeThisQuery(results);
    this._onDidCompleteQuery.fire(info);
  }

  /**
   * Register and create the history scrubber.
   */
  private registerQueryHistoryScrubber(
    queryHistoryConfigListener: QueryHistoryConfig,
    qhm: QueryHistoryManager,
    ctx: ExtensionContext,
  ) {
    this.queryHistoryScrubber?.dispose();
    // Every hour check if we need to re-run the query history scrubber.
    this.queryHistoryScrubber = this.push(
      registerQueryHistoryScrubber(
        ONE_HOUR_IN_MS,
        TWO_HOURS_IN_MS,
        queryHistoryConfigListener.ttlInMillis,
        this.queryHistoryDirs,
        qhm,
        ctx,
      ),
    );
  }

  private registerToVariantAnalysisEvents() {
    const variantAnalysisAddedSubscription =
      this.variantAnalysisManager.onVariantAnalysisAdded(
        async (variantAnalysis) => {
          this.addQuery({
            t: "variant-analysis",
            status: QueryStatus.InProgress,
            completed: false,
            variantAnalysis,
          });

          await this.refreshTreeView();
        },
      );

    const variantAnalysisStatusUpdateSubscription =
      this.variantAnalysisManager.onVariantAnalysisStatusUpdated(
        async (variantAnalysis) => {
          const items = this.treeDataProvider.allHistory.filter(
            (i) =>
              i.t === "variant-analysis" &&
              i.variantAnalysis.id === variantAnalysis.id,
          );
          const status = variantAnalysisStatusToQueryStatus(
            variantAnalysis.status,
          );

          if (items.length > 0) {
            items.forEach((item) => {
              const variantAnalysisHistoryItem =
                item as VariantAnalysisHistoryItem;
              variantAnalysisHistoryItem.status = status;
              variantAnalysisHistoryItem.failureReason =
                variantAnalysis.failureReason;
              variantAnalysisHistoryItem.resultCount = getTotalResultCount(
                variantAnalysis.scannedRepos,
              );
              variantAnalysisHistoryItem.variantAnalysis = variantAnalysis;
              if (status === QueryStatus.Completed) {
                variantAnalysisHistoryItem.completed = true;
              }
            });
            await this.refreshTreeView();
          } else {
            void extLogger.log(
              "Variant analysis status update event received for unknown variant analysis",
            );
          }
        },
      );

    const variantAnalysisRemovedSubscription =
      this.variantAnalysisManager.onVariantAnalysisRemoved(
        async (variantAnalysis) => {
          const items = this.treeDataProvider.allHistory.filter(
            (i) =>
              i.t === "variant-analysis" &&
              i.variantAnalysis.id === variantAnalysis.id,
          );
          await Promise.all(
            items.map(async (item) => {
              await this.removeVariantAnalysis(
                item as VariantAnalysisHistoryItem,
              );
            }),
          );
        },
      );

    this.push(variantAnalysisAddedSubscription);
    this.push(variantAnalysisStatusUpdateSubscription);
    this.push(variantAnalysisRemovedSubscription);
  }

  async readQueryHistory(): Promise<void> {
    void extLogger.log(
      `Reading cached query history from '${this.queryMetadataStorageLocation}'.`,
    );
    const history = await readQueryHistoryFromFile(
      this.queryMetadataStorageLocation,
    );
    this.treeDataProvider.allHistory = history;
    await Promise.all(
      this.treeDataProvider.allHistory.map(async (item) => {
        if (item.t === "variant-analysis") {
          await this.variantAnalysisManager.rehydrateVariantAnalysis(
            item.variantAnalysis,
          );
        }
      }),
    );
  }

  async writeQueryHistory(): Promise<void> {
    await writeQueryHistoryToFile(
      this.treeDataProvider.allHistory,
      this.queryMetadataStorageLocation,
    );
  }

  async handleOpenQuery(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ): Promise<void> {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }

    if (singleItem.t === "variant-analysis") {
      await this.variantAnalysisManager.openQueryFile(
        singleItem.variantAnalysis.id,
      );
      return;
    }

    let queryPath: string;
    switch (singleItem.t) {
      case "local":
        queryPath = singleItem.initialInfo.queryPath;
        break;
      default:
        assertNever(singleItem);
    }
    const textDocument = await workspace.openTextDocument(Uri.file(queryPath));
    const editor = await window.showTextDocument(textDocument, ViewColumn.One);

    if (singleItem.t === "local") {
      const queryText = singleItem.initialInfo.queryText;
      if (queryText !== undefined && singleItem.initialInfo.isQuickQuery) {
        await editor.edit((edit) =>
          edit.replace(
            textDocument.validateRange(
              new Range(0, 0, textDocument.lineCount, 0),
            ),
            queryText,
          ),
        );
      }
    }
  }

  getCurrentQueryHistoryItem(): QueryHistoryInfo | undefined {
    return this.treeDataProvider.getCurrent();
  }

  async removeDeletedQueries() {
    await Promise.all(
      this.treeDataProvider.allHistory.map(async (item) => {
        if (
          item.t === "local" &&
          item.completedQuery &&
          !(await pathExists(item.completedQuery?.query.querySaveDir))
        ) {
          this.treeDataProvider.remove(item);
        }
      }),
    );
  }

  async handleRemoveHistoryItem(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    multiSelect ||= [singleItem];
    await Promise.all(
      multiSelect.map(async (item) => {
        if (item.t === "local") {
          // Removing in progress local queries is not supported. They must be cancelled first.
          if (item.status !== QueryStatus.InProgress) {
            this.treeDataProvider.remove(item);

            // User has explicitly asked for this query to be removed.
            // We need to delete it from disk as well.
            await item.completedQuery?.query.deleteQuery();
          }
        } else if (item.t === "variant-analysis") {
          await this.removeVariantAnalysis(item);
        } else {
          assertNever(item);
        }
      }),
    );

    await this.writeQueryHistory();
    const current = this.treeDataProvider.getCurrent();
    if (current !== undefined) {
      await this.treeView.reveal(current, { select: true });
      await this.openQueryResults(current);
    }
  }

  private async removeVariantAnalysis(
    item: VariantAnalysisHistoryItem,
  ): Promise<void> {
    // We can remove a Variant Analysis locally, but not remotely.
    // The user must cancel the query on GitHub Actions explicitly.
    if (item.status === QueryStatus.InProgress) {
      const response = await showBinaryChoiceDialog(
        `You are about to delete this query: ${this.labelProvider.getLabel(
          item,
        )}. Are you sure?`,
      );
      if (!response) return;
    }

    this.treeDataProvider.remove(item);
    void extLogger.log(`Deleted ${this.labelProvider.getLabel(item)}.`);

    if (item.status === QueryStatus.InProgress) {
      await this.showToastWithWorkflowRunLink(item);
    }

    await this.variantAnalysisManager.removeVariantAnalysis(
      item.variantAnalysis,
    );
  }

  private async showToastWithWorkflowRunLink(
    item: VariantAnalysisHistoryItem,
  ): Promise<void> {
    const workflowRunUrl = getActionsWorkflowRunUrl(item);
    const message = `Remote query has been removed from history. However, the variant analysis is still running on GitHub Actions. To cancel it, you must go to the [workflow run](${workflowRunUrl}) in your browser.`;

    void showInformationMessageWithAction(message, "Go to workflow run").then(
      async (shouldOpenWorkflowRun) => {
        if (!shouldOpenWorkflowRun) return;
        await env.openExternal(Uri.parse(workflowRunUrl));
      },
    );
  }

  async handleSortByName() {
    if (this.treeDataProvider.sortOrder === SortOrder.NameAsc) {
      this.treeDataProvider.sortOrder = SortOrder.NameDesc;
    } else {
      this.treeDataProvider.sortOrder = SortOrder.NameAsc;
    }
  }

  async handleSortByDate() {
    if (this.treeDataProvider.sortOrder === SortOrder.DateAsc) {
      this.treeDataProvider.sortOrder = SortOrder.DateDesc;
    } else {
      this.treeDataProvider.sortOrder = SortOrder.DateAsc;
    }
  }

  async handleSortByCount() {
    if (this.treeDataProvider.sortOrder === SortOrder.CountAsc) {
      this.treeDataProvider.sortOrder = SortOrder.CountDesc;
    } else {
      this.treeDataProvider.sortOrder = SortOrder.CountAsc;
    }
  }

  async handleRenameItem(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ): Promise<void> {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }

    const response = await window.showInputBox({
      placeHolder: `(use default: ${this.queryHistoryConfigListener.format})`,
      value: singleItem.userSpecifiedLabel ?? "",
      title: "Set query label",
      prompt:
        "Set the query history item label. See the description of the codeQL.queryHistory.format setting for more information.",
    });
    // undefined response means the user cancelled the dialog; don't change anything
    if (response !== undefined) {
      // Interpret empty string response as 'go back to using default'
      singleItem.userSpecifiedLabel = response === "" ? undefined : response;
      await this.refreshTreeView();
    }
  }

  isSuccessfulCompletedLocalQueryInfo(
    item: QueryHistoryInfo,
  ): item is CompletedLocalQueryInfo {
    return item.t === "local" && item.completedQuery?.successful === true;
  }

  async handleCompareWith(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    multiSelect ||= [singleItem];

    if (
      !this.isSuccessfulCompletedLocalQueryInfo(singleItem) ||
      !multiSelect.every(this.isSuccessfulCompletedLocalQueryInfo)
    ) {
      throw new Error(
        "Please only select local queries that have completed successfully.",
      );
    }

    const fromItem = this.getFromQueryToCompare(singleItem, multiSelect);

    let toItem: CompletedLocalQueryInfo | undefined = undefined;
    try {
      toItem = await this.findOtherQueryToCompare(fromItem, multiSelect);
    } catch (e) {
      void showAndLogErrorMessage(
        `Failed to compare queries: ${getErrorMessage(e)}`,
      );
    }

    if (toItem !== undefined) {
      await this.doCompareCallback(fromItem, toItem);
    }
  }

  async handleItemClicked(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }

    this.treeDataProvider.setCurrentItem(singleItem);

    const now = new Date();
    const prevItemClick = this.lastItemClick;
    this.lastItemClick = { time: now, item: singleItem };

    if (
      prevItemClick !== undefined &&
      now.valueOf() - prevItemClick.time.valueOf() < DOUBLE_CLICK_TIME &&
      singleItem === prevItemClick.item
    ) {
      // show original query file on double click
      await this.handleOpenQuery(singleItem, [singleItem]);
    } else if (
      singleItem.t === "variant-analysis" ||
      singleItem.status === QueryStatus.Completed
    ) {
      // show results on single click (if results view is available)
      await this.openQueryResults(singleItem);
    }
  }

  async handleShowQueryLog(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    // Local queries only
    if (!this.assertSingleQuery(multiSelect) || singleItem?.t !== "local") {
      return;
    }

    if (!singleItem.completedQuery) {
      return;
    }

    if (singleItem.completedQuery.logFileLocation) {
      await tryOpenExternalFile(
        this.app.commands,
        singleItem.completedQuery.logFileLocation,
      );
    } else {
      void showAndLogWarningMessage("No log file available");
    }
  }

  async getQueryHistoryItemDirectory(
    queryHistoryItem: QueryHistoryInfo,
  ): Promise<string> {
    if (queryHistoryItem.t === "local") {
      if (queryHistoryItem.completedQuery) {
        return queryHistoryItem.completedQuery.query.querySaveDir;
      }
    } else if (queryHistoryItem.t === "variant-analysis") {
      return this.variantAnalysisManager.getVariantAnalysisStorageLocation(
        queryHistoryItem.variantAnalysis.id,
      );
    } else {
      assertNever(queryHistoryItem);
    }

    throw new Error("Unable to get query directory");
  }

  async handleOpenQueryDirectory(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }

    let externalFilePath: string | undefined;
    if (singleItem.t === "local") {
      if (singleItem.completedQuery) {
        externalFilePath = join(
          singleItem.completedQuery.query.querySaveDir,
          "timestamp",
        );
      }
    } else if (singleItem.t === "variant-analysis") {
      externalFilePath = join(
        this.variantAnalysisManager.getVariantAnalysisStorageLocation(
          singleItem.variantAnalysis.id,
        ),
        "timestamp",
      );
    } else {
      assertNever(singleItem);
    }

    if (externalFilePath) {
      if (!(await pathExists(externalFilePath))) {
        // timestamp file is missing (manually deleted?) try selecting the parent folder.
        // It's less nice, but at least it will work.
        externalFilePath = dirname(externalFilePath);
        if (!(await pathExists(externalFilePath))) {
          throw new Error(
            `Query directory does not exist: ${externalFilePath}`,
          );
        }
      }
      try {
        await this.app.commands.execute(
          "revealFileInOS",
          Uri.file(externalFilePath),
        );
      } catch (e) {
        throw new Error(
          `Failed to open ${externalFilePath}: ${getErrorMessage(e)}`,
        );
      }
    }
  }

  private warnNoEvalLogs() {
    void showAndLogWarningMessage(
      `Evaluator log, summary, and viewer are not available for this run. Perhaps it failed before evaluation, or you are running with a version of CodeQL before ' + ${CliVersionConstraint.CLI_VERSION_WITH_PER_QUERY_EVAL_LOG}?`,
    );
  }

  private warnInProgressEvalLogSummary() {
    void showAndLogWarningMessage(
      'The evaluator log summary is still being generated for this run. Please try again later. The summary generation process is tracked in the "CodeQL Extension Log" view.',
    );
  }

  private warnInProgressEvalLogViewer() {
    void showAndLogWarningMessage(
      "The viewer's data is still being generated for this run. Please try again or re-run the query.",
    );
  }

  async handleShowEvalLog(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    // Only applicable to an individual local query
    if (!this.assertSingleQuery(multiSelect) || singleItem.t !== "local") {
      return;
    }

    if (singleItem.evalLogLocation) {
      await tryOpenExternalFile(this.app.commands, singleItem.evalLogLocation);
    } else {
      this.warnNoEvalLogs();
    }
  }

  async handleShowEvalLogSummary(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    // Only applicable to an individual local query
    if (!this.assertSingleQuery(multiSelect) || singleItem.t !== "local") {
      return;
    }

    if (singleItem.evalLogSummaryLocation) {
      await tryOpenExternalFile(
        this.app.commands,
        singleItem.evalLogSummaryLocation,
      );
      return;
    }

    // Summary log file doesn't exist.
    if (
      singleItem.evalLogLocation &&
      (await pathExists(singleItem.evalLogLocation))
    ) {
      // If raw log does exist, then the summary log is still being generated.
      this.warnInProgressEvalLogSummary();
    } else {
      this.warnNoEvalLogs();
    }
  }

  async handleShowEvalLogViewer(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    // Only applicable to an individual local query
    if (!this.assertSingleQuery(multiSelect) || singleItem.t !== "local") {
      return;
    }

    // If the JSON summary file location wasn't saved, display error
    if (singleItem.jsonEvalLogSummaryLocation === undefined) {
      this.warnInProgressEvalLogViewer();
      return;
    }

    // TODO(angelapwen): Stream the file in.
    try {
      const evalLogData: EvalLogData[] = await parseViewerData(
        singleItem.jsonEvalLogSummaryLocation,
      );
      const evalLogTreeBuilder = new EvalLogTreeBuilder(
        singleItem.getQueryName(),
        evalLogData,
      );
      this.evalLogViewer.updateRoots(await evalLogTreeBuilder.getRoots());
    } catch (e) {
      throw new Error(
        `Could not read evaluator log summary JSON file to generate viewer data at ${singleItem.jsonEvalLogSummaryLocation}.`,
      );
    }
  }

  async handleCancel(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    multiSelect ||= [singleItem];

    const results = multiSelect.map(async (item) => {
      if (item.status === QueryStatus.InProgress) {
        if (item.t === "local") {
          item.cancel();
        } else if (item.t === "variant-analysis") {
          await this.variantAnalysisManager.cancelVariantAnalysis(
            item.variantAnalysis.id,
          );
        } else {
          assertNever(item);
        }
      }
    });

    await Promise.all(results);
  }

  async handleShowQueryText(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] = [],
  ) {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }

    if (singleItem.t === "variant-analysis") {
      await this.variantAnalysisManager.openQueryText(
        singleItem.variantAnalysis.id,
      );
      return;
    }

    const params = new URLSearchParams({
      isQuickEval: String(
        !!(
          singleItem.t === "local" && singleItem.initialInfo.quickEvalPosition
        ),
      ),
      queryText: encodeURIComponent(getQueryText(singleItem)),
    });

    const queryId = getQueryId(singleItem);

    const uri = Uri.parse(`codeql:${queryId}.ql?${params.toString()}`, true);
    const doc = await workspace.openTextDocument(uri);
    await window.showTextDocument(doc, { preview: false });
  }

  async handleViewSarifAlerts(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    // Local queries only
    if (
      !this.assertSingleQuery(multiSelect) ||
      singleItem.t !== "local" ||
      !singleItem.completedQuery
    ) {
      return;
    }

    const query = singleItem.completedQuery.query;
    const hasInterpretedResults = query.canHaveInterpretedResults();
    if (hasInterpretedResults) {
      await tryOpenExternalFile(
        this.app.commands,
        query.resultsPaths.interpretedResultsPath,
      );
    } else {
      const label = this.labelProvider.getLabel(singleItem);
      void showAndLogInformationMessage(
        `Query ${label} has no interpreted results.`,
      );
    }
  }

  async handleViewCsvResults(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    // Local queries only
    if (
      !this.assertSingleQuery(multiSelect) ||
      singleItem.t !== "local" ||
      !singleItem.completedQuery
    ) {
      return;
    }
    const query = singleItem.completedQuery.query;
    if (await query.hasCsv()) {
      void tryOpenExternalFile(this.app.commands, query.csvPath);
      return;
    }
    if (await query.exportCsvResults(this.qs.cliServer, query.csvPath)) {
      void tryOpenExternalFile(this.app.commands, query.csvPath);
    }
  }

  async handleViewCsvAlerts(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    // Local queries only
    if (
      !this.assertSingleQuery(multiSelect) ||
      singleItem.t !== "local" ||
      !singleItem.completedQuery
    ) {
      return;
    }

    await tryOpenExternalFile(
      this.app.commands,
      await singleItem.completedQuery.query.ensureCsvAlerts(
        this.qs.cliServer,
        this.dbm,
      ),
    );
  }

  async handleViewDil(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    // Local queries only
    if (
      !this.assertSingleQuery(multiSelect) ||
      singleItem.t !== "local" ||
      !singleItem.completedQuery
    ) {
      return;
    }

    await tryOpenExternalFile(
      this.app.commands,
      await singleItem.completedQuery.query.ensureDilPath(this.qs.cliServer),
    );
  }

  async handleOpenOnGithub(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    if (
      !this.assertSingleQuery(multiSelect) ||
      singleItem.t !== "variant-analysis"
    ) {
      return;
    }

    const actionsWorkflowRunUrl = getActionsWorkflowRunUrl(singleItem);

    await this.app.commands.execute(
      "vscode.open",
      Uri.parse(actionsWorkflowRunUrl),
    );
  }

  async handleCopyRepoList(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ) {
    // Variant analyses only
    if (
      !this.assertSingleQuery(multiSelect) ||
      singleItem.t !== "variant-analysis"
    ) {
      return;
    }

    await this.app.commands.execute(
      "codeQL.copyVariantAnalysisRepoList",
      singleItem.variantAnalysis.id,
    );
  }

  async handleExportResults(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] | undefined,
  ): Promise<void> {
    // Variant analysis only
    if (
      !this.assertSingleQuery(multiSelect) ||
      singleItem.t !== "variant-analysis"
    ) {
      return;
    }

    await this.variantAnalysisManager.exportResults(
      singleItem.variantAnalysis.id,
    );
  }

  /**
   * Exports the results of the currently-selected variant analysis.
   */
  async exportSelectedVariantAnalysisResults(): Promise<void> {
    const queryHistoryItem = this.getCurrentQueryHistoryItem();
    if (!queryHistoryItem || queryHistoryItem.t !== "variant-analysis") {
      throw new Error(
        "No variant analysis results currently open. To open results, click an item in the query history view.",
      );
    }

    await this.variantAnalysisManager.exportResults(
      queryHistoryItem.variantAnalysis.id,
    );
  }

  addQuery(item: QueryHistoryInfo) {
    this.treeDataProvider.pushQuery(item);
    this.updateTreeViewSelectionIfVisible();
  }

  /**
   * Update the tree view selection if the tree view is visible.
   *
   * If the tree view is not visible, we must wait until it becomes visible before updating the
   * selection. This is because the only mechanism for updating the selection of the tree view
   * has the side-effect of revealing the tree view. This changes the active sidebar to CodeQL,
   * interrupting user workflows such as writing a commit message on the source control sidebar.
   */
  private updateTreeViewSelectionIfVisible() {
    if (this.treeView.visible) {
      const current = this.treeDataProvider.getCurrent();
      if (current !== undefined) {
        // We must fire the onDidChangeTreeData event to ensure the current element can be selected
        // using `reveal` if the tree view was not visible when the current element was added.
        this.treeDataProvider.refresh();
        void this.treeView.reveal(current, { select: true });
      }
    }
  }

  private getFromQueryToCompare(
    singleItem: CompletedLocalQueryInfo,
    multiSelect: CompletedLocalQueryInfo[],
  ): CompletedLocalQueryInfo {
    if (
      this.compareWithItem &&
      this.isSuccessfulCompletedLocalQueryInfo(this.compareWithItem) &&
      multiSelect.includes(this.compareWithItem)
    ) {
      return this.compareWithItem;
    } else {
      return singleItem;
    }
  }

  private async findOtherQueryToCompare(
    fromItem: CompletedLocalQueryInfo,
    allSelectedItems: CompletedLocalQueryInfo[],
  ): Promise<CompletedLocalQueryInfo | undefined> {
    const dbName = fromItem.initialInfo.databaseInfo.name;

    // If exactly 2 items are selected, return the one that
    // isn't being used as the "from" item.
    if (allSelectedItems.length === 2) {
      const otherItem =
        fromItem === allSelectedItems[0]
          ? allSelectedItems[1]
          : allSelectedItems[0];
      if (otherItem.initialInfo.databaseInfo.name !== dbName) {
        throw new Error("Query databases must be the same.");
      }
      return otherItem;
    }

    if (allSelectedItems.length > 2) {
      throw new Error("Please select no more than 2 queries.");
    }

    // Otherwise, present a dialog so the user can choose the item they want to use.
    const comparableQueryLabels = this.treeDataProvider.allHistory
      .filter(this.isSuccessfulCompletedLocalQueryInfo)
      .filter(
        (otherItem) =>
          otherItem !== fromItem &&
          otherItem.initialInfo.databaseInfo.name === dbName,
      )
      .map((item) => ({
        label: this.labelProvider.getLabel(item),
        description: item.initialInfo.databaseInfo.name,
        detail: item.completedQuery.statusString,
        query: item,
      }));
    if (comparableQueryLabels.length < 1) {
      throw new Error("No other queries available to compare with.");
    }
    const choice = await window.showQuickPick(comparableQueryLabels);

    return choice?.query;
  }

  private assertSingleQuery(
    multiSelect: QueryHistoryInfo[] = [],
    message = "Please select a single query.",
  ) {
    if (multiSelect.length > 1) {
      void showAndLogErrorMessage(message);
      return false;
    }
    return true;
  }

  /**
   * Updates the compare with source query. This ensures that all compare command invocations
   * when exactly 2 queries are selected always have the proper _from_ query. Always use
   * compareWithItem as the _from_ query.
   *
   * The heuristic is this:
   *
   * 1. If selection is empty or has length > 2 delete compareWithItem.
   * 2. If selection is length 1, then set that item to compareWithItem.
   * 3. If selection is length 2, then make sure compareWithItem is one of the selected items
   *    if not, then delete compareWithItem. If it is then, do nothing.
   *
   * This ensures that compareWithItem is always the first item selected if there are only
   * two selected items.
   *
   * @param newSelection the new selection after the most recent selection change
   */
  private updateCompareWith(newSelection: LocalQueryInfo[]) {
    if (newSelection.length === 1) {
      this.compareWithItem = newSelection[0];
    } else if (
      newSelection.length !== 2 ||
      !this.compareWithItem ||
      !newSelection.includes(this.compareWithItem)
    ) {
      this.compareWithItem = undefined;
    }
  }

  async refreshTreeView(): Promise<void> {
    this.treeDataProvider.refresh();
    await this.writeQueryHistory();
  }

  private async openQueryResults(item: QueryHistoryInfo) {
    if (item.t === "local") {
      await this.localQueriesResultsView.showResults(
        item as CompletedLocalQueryInfo,
        WebviewReveal.Forced,
        false,
      );
    } else if (item.t === "variant-analysis") {
      await this.variantAnalysisManager.showView(item.variantAnalysis.id);
    } else {
      assertNever(item);
    }
  }
}
