import * as path from 'path';
import {
  commands,
  Disposable,
  env,
  Event,
  EventEmitter,
  ExtensionContext,
  ProviderResult,
  Range,
  ThemeIcon,
  TreeItem,
  TreeView,
  Uri,
  ViewColumn,
  window,
  workspace,
} from 'vscode';
import { QueryHistoryConfig } from './config';
import {
  showAndLogErrorMessage,
  showAndLogInformationMessage,
  showAndLogWarningMessage,
  showBinaryChoiceDialog
} from './helpers';
import { logger } from './logging';
import { URLSearchParams } from 'url';
import { QueryServerClient } from './queryserver-client';
import { DisposableObject } from './pure/disposable-object';
import { commandRunner } from './commandRunner';
import { assertNever, ONE_HOUR_IN_MS, TWO_HOURS_IN_MS } from './pure/helpers-pure';
import { CompletedLocalQueryInfo, LocalQueryInfo as LocalQueryInfo, QueryHistoryInfo } from './query-results';
import { DatabaseManager } from './databases';
import { registerQueryHistoryScubber } from './query-history-scrubber';
import { QueryStatus } from './query-status';
import { slurpQueryHistory, splatQueryHistory } from './query-serialization';

/**
 * query-history.ts
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

/**
 * Path to icon to display next to a failed query history item.
 */
const FAILED_QUERY_HISTORY_ITEM_ICON = 'media/red-x.svg';

/**
 * Path to icon to display next to a successful local run.
 */
const LOCAL_SUCCESS_QUERY_HISTORY_ITEM_ICON = 'media/drive.svg';

/**
 * Path to icon to display next to a successful remote run.
 */
const REMOTE_SUCCESS_QUERY_HISTORY_ITEM_ICON = 'media/globe.svg';

export enum SortOrder {
  NameAsc = 'NameAsc',
  NameDesc = 'NameDesc',
  DateAsc = 'DateAsc',
  DateDesc = 'DateDesc',
  CountAsc = 'CountAsc',
  CountDesc = 'CountDesc',
}

/**
 * Number of milliseconds two clicks have to arrive apart to be
 * considered a double-click.
 */
const DOUBLE_CLICK_TIME = 500;

const WORKSPACE_QUERY_HISTORY_FILE = 'workspace-query-history.json';

/**
 * Tree data provider for the query history view.
 */
export class HistoryTreeDataProvider extends DisposableObject {
  private _sortOrder = SortOrder.DateAsc;

  private _onDidChangeTreeData = super.push(new EventEmitter<QueryHistoryInfo | undefined>());

  readonly onDidChangeTreeData: Event<QueryHistoryInfo | undefined> = this
    ._onDidChangeTreeData.event;

  private history: QueryHistoryInfo[] = [];

  private failedIconPath: string;

  private localSuccessIconPath: string;

  private remoteSuccessIconPath: string;

  private current: QueryHistoryInfo | undefined;

  constructor(extensionPath: string) {
    super();
    this.failedIconPath = path.join(
      extensionPath,
      FAILED_QUERY_HISTORY_ITEM_ICON
    );
    this.localSuccessIconPath = path.join(
      extensionPath,
      LOCAL_SUCCESS_QUERY_HISTORY_ITEM_ICON
    );
    this.remoteSuccessIconPath = path.join(
      extensionPath,
      REMOTE_SUCCESS_QUERY_HISTORY_ITEM_ICON
    );
  }

  async getTreeItem(element: QueryHistoryInfo): Promise<TreeItem> {
    const treeItem = new TreeItem(element.label);

    treeItem.command = {
      title: 'Query History Item',
      command: 'codeQLQueryHistory.itemClicked',
      arguments: [element],
      tooltip: element.failureReason || element.label
    };

    // Populate the icon and the context value. We use the context value to
    // control which commands are visible in the context menu.
    let hasResults;
    switch (element.status) {
      case QueryStatus.InProgress:
        treeItem.iconPath = new ThemeIcon('sync~spin');
        treeItem.contextValue = 'inProgressResultsItem';
        break;
      case QueryStatus.Completed:
        if (element.t === 'local') {
          hasResults = await element.completedQuery?.query.hasInterpretedResults();
          treeItem.iconPath = this.localSuccessIconPath;
          treeItem.contextValue = hasResults
            ? 'interpretedResultsItem'
            : 'rawResultsItem';
        } else {
          treeItem.iconPath = this.remoteSuccessIconPath;
          treeItem.contextValue = 'remoteResultsItem';
        }
        break;
      case QueryStatus.Failed:
        treeItem.iconPath = this.failedIconPath;
        treeItem.contextValue = 'cancelledResultsItem';
        break;
      default:
        assertNever(element.status);
    }

    return treeItem;
  }

  getChildren(
    element?: QueryHistoryInfo
  ): ProviderResult<QueryHistoryInfo[]> {
    return element ? [] : this.history.sort((h1, h2) => {

      // TODO remote queries are not implemented yet.
      if (h1.t !== 'local' && h2.t !== 'local') {
        return 0;
      }
      if (h1.t !== 'local') {
        return -1;
      }
      if (h2.t !== 'local') {
        return 1;
      }

      const resultCount1 = h1.completedQuery?.resultCount ?? -1;
      const resultCount2 = h2.completedQuery?.resultCount ?? -1;

      switch (this.sortOrder) {
        case SortOrder.NameAsc:
          return h1.label.localeCompare(h2.label, env.language);
        case SortOrder.NameDesc:
          return h2.label.localeCompare(h1.label, env.language);
        case SortOrder.DateAsc:
          return h1.initialInfo.start.getTime() - h2.initialInfo.start.getTime();
        case SortOrder.DateDesc:
          return h2.initialInfo.start.getTime() - h1.initialInfo.start.getTime();
        case SortOrder.CountAsc:
          // If the result counts are equal, sort by name.
          return resultCount1 - resultCount2 === 0
            ? h1.label.localeCompare(h2.label, env.language)
            : resultCount1 - resultCount2;
        case SortOrder.CountDesc:
          // If the result counts are equal, sort by name.
          return resultCount2 - resultCount1 === 0
            ? h2.label.localeCompare(h1.label, env.language)
            : resultCount2 - resultCount1;
        default:
          assertNever(this.sortOrder);
      }
    });
  }

  getParent(_element: QueryHistoryInfo): ProviderResult<QueryHistoryInfo> {
    return null;
  }

  getCurrent(): QueryHistoryInfo | undefined {
    return this.current;
  }

  pushQuery(item: QueryHistoryInfo): void {
    this.history.push(item);
    this.setCurrentItem(item);
    this.refresh();
  }

  setCurrentItem(item?: QueryHistoryInfo) {
    this.current = item;
  }

  remove(item: QueryHistoryInfo) {
    const isCurrent = this.current === item;
    if (isCurrent) {
      this.setCurrentItem();
    }
    const index = this.history.findIndex((i) => i === item);
    if (index >= 0) {
      this.history.splice(index, 1);
      if (isCurrent && this.history.length > 0) {
        // Try to keep a current item, near the deleted item if there
        // are any available.
        this.setCurrentItem(this.history[Math.min(index, this.history.length - 1)]);
      }
      this.refresh();
    }
  }

  get allHistory(): QueryHistoryInfo[] {
    return this.history;
  }

  set allHistory(history: QueryHistoryInfo[]) {
    this.history = history;
    this.current = history[0];
    this.refresh();
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  public get sortOrder() {
    return this._sortOrder;
  }

  public set sortOrder(newSortOrder: SortOrder) {
    this._sortOrder = newSortOrder;
    this._onDidChangeTreeData.fire(undefined);
  }
}

export class QueryHistoryManager extends DisposableObject {

  treeDataProvider: HistoryTreeDataProvider;
  treeView: TreeView<QueryHistoryInfo>;
  lastItemClick: { time: Date; item: QueryHistoryInfo } | undefined;
  compareWithItem: LocalQueryInfo | undefined;
  queryHistoryScrubber: Disposable | undefined;
  private queryMetadataStorageLocation;

  private readonly _onDidAddQueryItem = super.push(new EventEmitter<QueryHistoryInfo>());
  readonly onDidAddQueryItem: Event<QueryHistoryInfo> = this
    ._onDidAddQueryItem.event;

  private readonly _onDidRemoveQueryItem = super.push(new EventEmitter<QueryHistoryInfo>());
  readonly onDidRemoveQueryItem: Event<QueryHistoryInfo> = this
    ._onDidRemoveQueryItem.event;

  private readonly _onWillOpenQueryItem = super.push(new EventEmitter<QueryHistoryInfo>());
  readonly onWillOpenQueryItem: Event<QueryHistoryInfo> = this
    ._onWillOpenQueryItem.event;

  constructor(
    private qs: QueryServerClient,
    private dbm: DatabaseManager,
    private queryStorageDir: string,
    ctx: ExtensionContext,
    private queryHistoryConfigListener: QueryHistoryConfig,
    private doCompareCallback: (
      from: CompletedLocalQueryInfo,
      to: CompletedLocalQueryInfo
    ) => Promise<void>
  ) {
    super();

    // Note that we use workspace storage to hold the metadata for the query history.
    // This is because the query history is specific to each workspace.
    // For situations where `ctx.storageUri` is undefined (i.e., there is no workspace),
    // we default to global storage.
    this.queryMetadataStorageLocation = path.join((ctx.storageUri || ctx.globalStorageUri).fsPath, WORKSPACE_QUERY_HISTORY_FILE);

    this.treeDataProvider = this.push(new HistoryTreeDataProvider(
      ctx.extensionPath
    ));
    this.treeView = this.push(window.createTreeView('codeQLQueryHistory', {
      treeDataProvider: this.treeDataProvider,
      canSelectMany: true,
    }));

    // Lazily update the tree view selection due to limitations of TreeView API (see
    // `updateTreeViewSelectionIfVisible` doc for details)
    this.push(
      this.treeView.onDidChangeVisibility(async (_ev) =>
        this.updateTreeViewSelectionIfVisible()
      )
    );
    this.push(
      this.treeView.onDidChangeSelection(async (ev) => {
        if (ev.selection.length === 0) {
          // Don't allow the selection to become empty
          this.updateTreeViewSelectionIfVisible();
        } else {
          this.treeDataProvider.setCurrentItem(ev.selection[0]);
        }
        if (ev.selection.some(item => item.t !== 'local')) {
          // Don't allow comparison of non-local items
          this.updateCompareWith([]);
        } else {
          this.updateCompareWith([...ev.selection] as LocalQueryInfo[]);
        }
      })
    );

    void logger.log('Registering query history panel commands.');
    this.push(
      commandRunner(
        'codeQLQueryHistory.openQuery',
        this.handleOpenQuery.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.removeHistoryItem',
        this.handleRemoveHistoryItem.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.sortByName',
        this.handleSortByName.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.sortByDate',
        this.handleSortByDate.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.sortByCount',
        this.handleSortByCount.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.setLabel',
        this.handleSetLabel.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.compareWith',
        this.handleCompareWith.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.showQueryLog',
        this.handleShowQueryLog.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.cancel',
        this.handleCancel.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.showQueryText',
        this.handleShowQueryText.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.viewCsvResults',
        this.handleViewCsvResults.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.viewCsvAlerts',
        this.handleViewCsvAlerts.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.viewSarifAlerts',
        this.handleViewSarifAlerts.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.viewDil',
        this.handleViewDil.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.itemClicked',
        async (item: LocalQueryInfo) => {
          return this.handleItemClicked(item, [item]);
        }
      )
    );

    // There are two configuration items that affect the query history:
    // 1. The ttl for query history items.
    // 2. The default label for query history items.
    // When either of these change, must refresh the tree view.
    this.push(
      queryHistoryConfigListener.onDidChangeConfiguration(() => {
        this.treeDataProvider.refresh();
        this.registerQueryHistoryScrubber(queryHistoryConfigListener, ctx);
      })
    );

    // displays query text in a read-only document
    this.push(workspace.registerTextDocumentContentProvider('codeql', {
      provideTextDocumentContent(
        uri: Uri
      ): ProviderResult<string> {
        const params = new URLSearchParams(uri.query);

        return (
          (JSON.parse(params.get('isQuickEval') || '')
            ? SHOW_QUERY_TEXT_QUICK_EVAL_MSG
            : SHOW_QUERY_TEXT_MSG) + params.get('queryText')
        );
      },
    }));

    this.registerQueryHistoryScrubber(queryHistoryConfigListener, ctx);
  }

  /**
   * Register and create the history scrubber.
   */
  private registerQueryHistoryScrubber(queryHistoryConfigListener: QueryHistoryConfig, ctx: ExtensionContext) {
    this.queryHistoryScrubber?.dispose();
    // Every hour check if we need to re-run the query history scrubber.
    this.queryHistoryScrubber = this.push(
      registerQueryHistoryScubber(
        ONE_HOUR_IN_MS,
        TWO_HOURS_IN_MS,
        queryHistoryConfigListener.ttlInMillis,
        this.queryStorageDir,
        ctx
      )
    );
  }

  async readQueryHistory(): Promise<void> {
    void logger.log(`Reading cached query history from '${this.queryMetadataStorageLocation}'.`);
    const history = await slurpQueryHistory(this.queryMetadataStorageLocation, this.queryHistoryConfigListener);
    this.treeDataProvider.allHistory = history;
    this.treeDataProvider.allHistory.forEach((item) => {
      this._onDidAddQueryItem.fire(item);
    });
  }

  async writeQueryHistory(): Promise<void> {
    await splatQueryHistory(this.treeDataProvider.allHistory, this.queryMetadataStorageLocation);
  }

  async handleOpenQuery(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ): Promise<void> {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem) {
      return;
    }

    const queryPath = finalSingleItem.t === 'local'
      ? finalSingleItem.initialInfo.queryPath
      : finalSingleItem.remoteQuery.queryFilePath;

    const textDocument = await workspace.openTextDocument(
      Uri.file(queryPath)
    );
    const editor = await window.showTextDocument(
      textDocument,
      ViewColumn.One
    );

    if (finalSingleItem.t === 'local') {
      const queryText = finalSingleItem.initialInfo.queryText;
      if (queryText !== undefined && finalSingleItem.initialInfo.isQuickQuery) {
        await editor.edit((edit) =>
          edit.replace(
            textDocument.validateRange(
              new Range(0, 0, textDocument.lineCount, 0)
            ),
            queryText
          )
        );
      }
    }
  }

  async handleRemoveHistoryItem(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] = []
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);
    const toDelete = (finalMultiSelect || [finalSingleItem]);
    await Promise.all(toDelete.map(async (item) => {
      if (item.t === 'local') {
        // Removing in progress local queries is not supported. They must be cancelled first.
        if (item.status !== QueryStatus.InProgress) {
          this.treeDataProvider.remove(item);
          item.completedQuery?.dispose();

          // User has explicitly asked for this query to be removed.
          // We need to delete it from disk as well.
          await item.completedQuery?.query.deleteQuery();
        }
      } else {
        // Remote queries can be removed locally, but not remotely.
        // The user must cancel the query on GitHub Actions explicitly.
        this.treeDataProvider.remove(item);
        void logger.log(`Deleted ${item.label}.`);
        if (item.status === QueryStatus.InProgress) {
          void logger.log('The remote query is still running on GitHub Actions. To cancel there, you must go to the query run in your browser.');
        }

        this._onDidRemoveQueryItem.fire(item);
      }

    }));
    await this.writeQueryHistory();
    const current = this.treeDataProvider.getCurrent();
    if (current !== undefined) {
      await this.treeView.reveal(current, { select: true });
      await this._onWillOpenQueryItem.fire(current);
    }
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

  async handleSetLabel(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ): Promise<void> {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    // TODO will support remote queries
    if (!this.assertSingleQuery(finalMultiSelect) || finalSingleItem?.t !== 'local') {
      return;
    }

    const response = await window.showInputBox({
      prompt: 'Label:',
      placeHolder: '(use default)',
      value: finalSingleItem.label,
    });
    // undefined response means the user cancelled the dialog; don't change anything
    if (response !== undefined) {
      // Interpret empty string response as 'go back to using default'
      finalSingleItem.initialInfo.userSpecifiedLabel = response === '' ? undefined : response;
      this.treeDataProvider.refresh();
    }
  }

  async handleCompareWith(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    try {
      // local queries only
      if (finalSingleItem?.t !== 'local') {
        throw new Error('Please select a local query.');
      }

      if (!finalSingleItem.completedQuery?.didRunSuccessfully) {
        throw new Error('Please select a query that has completed successfully.');
      }

      const from = this.compareWithItem || singleItem;
      const to = await this.findOtherQueryToCompare(from, finalMultiSelect);

      if (from.completed && to?.completed) {
        await this.doCompareCallback(from as CompletedLocalQueryInfo, to as CompletedLocalQueryInfo);
      }
    } catch (e) {
      void showAndLogErrorMessage(e.message);
    }
  }

  async handleItemClicked(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem) {
      return;
    }

    this.treeDataProvider.setCurrentItem(finalSingleItem);

    const now = new Date();
    const prevItemClick = this.lastItemClick;
    this.lastItemClick = { time: now, item: finalSingleItem };

    if (
      prevItemClick !== undefined &&
      now.valueOf() - prevItemClick.time.valueOf() < DOUBLE_CLICK_TIME &&
      finalSingleItem == prevItemClick.item
    ) {
      // show original query file on double click
      await this.handleOpenQuery(finalSingleItem, [finalSingleItem]);
    } else {
      // show results on single click
      await this._onWillOpenQueryItem.fire(finalSingleItem);
    }
  }

  async handleShowQueryLog(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    // Local queries only
    if (!this.assertSingleQuery(multiSelect) || singleItem?.t !== 'local') {
      return;
    }

    if (!singleItem.completedQuery) {
      return;
    }

    if (singleItem.completedQuery.logFileLocation) {
      await this.tryOpenExternalFile(singleItem.completedQuery.logFileLocation);
    } else {
      void showAndLogWarningMessage('No log file available');
    }
  }

  async handleCancel(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    // Local queries only
    // In the future, we may support cancelling remote queries, but this is not a short term plan.
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    (finalMultiSelect || [finalSingleItem]).forEach((item) => {
      if (item.status === QueryStatus.InProgress && item.t === 'local') {
        item.cancel();
      }
    });
  }

  async handleShowQueryText(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem) {
      return;
    }

    const params = new URLSearchParams({
      isQuickEval: String(!!(finalSingleItem.t === 'local' && finalSingleItem.initialInfo.quickEvalPosition)),
      queryText: encodeURIComponent(await this.getQueryText(finalSingleItem)),
    });
    const queryId = finalSingleItem.t === 'local'
      ? finalSingleItem.initialInfo.id
      : finalSingleItem.queryId;

    const uri = Uri.parse(
      `codeql:${queryId}?${params.toString()}`, true
    );
    const doc = await workspace.openTextDocument(uri);
    await window.showTextDocument(doc, { preview: false });
  }

  async handleViewSarifAlerts(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    // Local queries only
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem || finalSingleItem.t !== 'local' || !finalSingleItem.completedQuery) {
      return;
    }

    const query = finalSingleItem.completedQuery.query;
    const hasInterpretedResults = query.canHaveInterpretedResults();
    if (hasInterpretedResults) {
      await this.tryOpenExternalFile(
        query.resultsPaths.interpretedResultsPath
      );
    } else {
      const label = finalSingleItem.label;
      void showAndLogInformationMessage(
        `Query ${label} has no interpreted results.`
      );
    }
  }

  async handleViewCsvResults(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    // Local queries only
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem || finalSingleItem.t !== 'local' || !finalSingleItem.completedQuery) {
      return;
    }
    const query = finalSingleItem.completedQuery.query;
    if (await query.hasCsv()) {
      void this.tryOpenExternalFile(query.csvPath);
      return;
    }
    await query.exportCsvResults(this.qs, query.csvPath, () => {
      void this.tryOpenExternalFile(
        query.csvPath
      );
    });
  }

  async handleViewCsvAlerts(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    // Local queries only
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem || finalSingleItem.t !== 'local' || !finalSingleItem.completedQuery) {
      return;
    }

    await this.tryOpenExternalFile(
      await finalSingleItem.completedQuery.query.ensureCsvAlerts(this.qs, this.dbm)
    );
  }

  async handleViewDil(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[],
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    // Local queries only
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem || finalSingleItem.t !== 'local' || !finalSingleItem.completedQuery) {
      return;
    }

    await this.tryOpenExternalFile(
      await finalSingleItem.completedQuery.query.ensureDilPath(this.qs)
    );
  }

  async getQueryText(item: QueryHistoryInfo): Promise<string> {
    return item.t === 'local'
      ? item.initialInfo.queryText
      : item.remoteQuery.queryText;
  }

  addQuery(item: QueryHistoryInfo) {
    this.treeDataProvider.pushQuery(item);
    this.updateTreeViewSelectionIfVisible();
    this._onDidAddQueryItem.fire(item);
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
      if (current != undefined) {
        // We must fire the onDidChangeTreeData event to ensure the current element can be selected
        // using `reveal` if the tree view was not visible when the current element was added.
        this.treeDataProvider.refresh();
        void this.treeView.reveal(current, { select: true });
      }
    }
  }

  private async tryOpenExternalFile(fileLocation: string) {
    const uri = Uri.file(fileLocation);
    try {
      await window.showTextDocument(uri, { preview: false });
    } catch (e) {
      if (
        e.message.includes(
          'Files above 50MB cannot be synchronized with extensions'
        ) ||
        e.message.includes('too large to open')
      ) {
        const res = await showBinaryChoiceDialog(
          `VS Code does not allow extensions to open files >50MB. This file
exceeds that limit. Do you want to open it outside of VS Code?

You can also try manually opening it inside VS Code by selecting
the file in the file explorer and dragging it into the workspace.`
        );
        if (res) {
          try {
            await commands.executeCommand('revealFileInOS', uri);
          } catch (e) {
            void showAndLogErrorMessage(e.message);
          }
        }
      } else {
        void showAndLogErrorMessage(`Could not open file ${fileLocation}`);
        void logger.log(e.message);
        void logger.log(e.stack);
      }
    }
  }

  private async findOtherQueryToCompare(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ): Promise<CompletedLocalQueryInfo | undefined> {

    // Remote queries cannot be compared
    if (singleItem.t !== 'local' || multiSelect.some(s => s.t !== 'local') || !singleItem.completedQuery) {
      return undefined;
    }
    const dbName = singleItem.initialInfo.databaseInfo.name;

    // if exactly 2 queries are selected, use those
    if (multiSelect?.length === 2) {
      // return the query that is not the first selected one
      const otherQuery =
        (singleItem === multiSelect[0] ? multiSelect[1] : multiSelect[0]) as LocalQueryInfo;
      if (!otherQuery.completedQuery) {
        throw new Error('Please select a completed query.');
      }
      if (!otherQuery.completedQuery.didRunSuccessfully) {
        throw new Error('Please select a successful query.');
      }
      if (otherQuery.initialInfo.databaseInfo.name !== dbName) {
        throw new Error('Query databases must be the same.');
      }
      return otherQuery as CompletedLocalQueryInfo;
    }

    if (multiSelect?.length > 2) {
      throw new Error('Please select no more than 2 queries.');
    }

    // otherwise, let the user choose
    const comparableQueryLabels = this.treeDataProvider.allHistory
      .filter(
        (otherQuery) =>
          otherQuery !== singleItem &&
          otherQuery.t === 'local' &&
          otherQuery.completedQuery &&
          otherQuery.completedQuery.didRunSuccessfully &&
          otherQuery.initialInfo.databaseInfo.name === dbName
      )
      .map((item) => ({
        label: item.label,
        description: (item as CompletedLocalQueryInfo).initialInfo.databaseInfo.name,
        detail: (item as CompletedLocalQueryInfo).completedQuery.statusString,
        query: item as CompletedLocalQueryInfo,
      }));
    if (comparableQueryLabels.length < 1) {
      throw new Error('No other queries available to compare with.');
    }
    const choice = await window.showQuickPick(comparableQueryLabels);
    return choice?.query;
  }

  private assertSingleQuery(multiSelect: QueryHistoryInfo[] = [], message = 'Please select a single query.') {
    if (multiSelect.length > 1) {
      void showAndLogErrorMessage(
        message
      );
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

  /**
   * If no items are selected, attempt to grab the selection from the treeview.
   * However, often the treeview itself does not have any selection. In this case,
   * grab the selection from the `treeDataProvider` current item.
   *
   * We need to use this method because when clicking on commands from the view title
   * bar, the selections are not passed in.
   *
   * @param singleItem the single item selected, or undefined if no item is selected
   * @param multiSelect a multi-select or undefined if no items are selected
   */
  private determineSelection(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ): {
    finalSingleItem: QueryHistoryInfo;
    finalMultiSelect: QueryHistoryInfo[]
  } {
    if (!singleItem && !multiSelect?.[0]) {
      const selection = this.treeView.selection;
      const current = this.treeDataProvider.getCurrent();
      if (selection?.length) {
        return {
          finalSingleItem: selection[0],
          finalMultiSelect: [...selection]
        };
      } else if (current) {
        return {
          finalSingleItem: current,
          finalMultiSelect: [current]
        };
      }
    }

    // ensure we only return undefined if we have neither a single or multi-selecion
    if (singleItem && !multiSelect?.[0]) {
      multiSelect = [singleItem];
    } else if (!singleItem && multiSelect?.[0]) {
      singleItem = multiSelect[0];
    }
    return {
      finalSingleItem: singleItem,
      finalMultiSelect: multiSelect
    };
  }

  async refreshTreeView(): Promise<void> {
    this.treeDataProvider.refresh();
    await this.writeQueryHistory();
  }
}
