import * as path from 'path';
import {
  commands,
  env,
  Event,
  EventEmitter,
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
import { assertNever } from './pure/helpers-pure';
import { FullCompletedQueryInfo, FullQueryInfo, QueryStatus } from './query-results';

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

export enum SortOrder {
  NameAsc = 'NameAsc',
  NameDesc = 'NameDesc',
  DateAsc = 'DateAsc',
  DateDesc = 'DateDesc',
  CountAsc = 'CountAsc',
  CountDesc = 'CountDesc',
}

/**
 * Tree data provider for the query history view.
 */
export class HistoryTreeDataProvider extends DisposableObject {
  private _sortOrder = SortOrder.DateAsc;

  private _onDidChangeTreeData = super.push(new EventEmitter<FullQueryInfo | undefined>());

  readonly onDidChangeTreeData: Event<FullQueryInfo | undefined> = this
    ._onDidChangeTreeData.event;

  private history: FullQueryInfo[] = [];

  private failedIconPath: string;

  private localSuccessIconPath: string;

  private current: FullQueryInfo | undefined;

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
  }

  async getTreeItem(element: FullQueryInfo): Promise<TreeItem> {
    const treeItem = new TreeItem(element.label);

    treeItem.command = {
      title: 'Query History Item',
      command: 'codeQLQueryHistory.itemClicked',
      arguments: [element],
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
        hasResults = await element.completedQuery?.query.hasInterpretedResults();
        treeItem.iconPath = this.localSuccessIconPath;
        treeItem.contextValue = hasResults
          ? 'interpretedResultsItem'
          : 'rawResultsItem';
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
    element?: FullQueryInfo
  ): ProviderResult<FullQueryInfo[]> {
    return element ? [] : this.history.sort((h1, h2) => {
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

  getParent(_element: FullQueryInfo): ProviderResult<FullQueryInfo> {
    return null;
  }

  getCurrent(): FullQueryInfo | undefined {
    return this.current;
  }

  pushQuery(item: FullQueryInfo): void {
    this.history.push(item);
    this.setCurrentItem(item);
    this.refresh();
  }

  setCurrentItem(item?: FullQueryInfo) {
    this.current = item;
  }

  remove(item: FullQueryInfo) {
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

  get allHistory(): FullQueryInfo[] {
    return this.history;
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

/**
 * Number of milliseconds two clicks have to arrive apart to be
 * considered a double-click.
 */
const DOUBLE_CLICK_TIME = 500;

const NO_QUERY_SELECTED = 'No query selected. Select a query history item you have already run and try again.';

export class QueryHistoryManager extends DisposableObject {
  treeDataProvider: HistoryTreeDataProvider;
  treeView: TreeView<FullQueryInfo>;
  lastItemClick: { time: Date; item: FullQueryInfo } | undefined;
  compareWithItem: FullQueryInfo | undefined;

  constructor(
    private qs: QueryServerClient,
    extensionPath: string,
    queryHistoryConfigListener: QueryHistoryConfig,
    private selectedCallback: (item: FullCompletedQueryInfo) => Promise<void>,
    private doCompareCallback: (
      from: FullCompletedQueryInfo,
      to: FullCompletedQueryInfo
    ) => Promise<void>
  ) {
    super();

    this.treeDataProvider = this.push(new HistoryTreeDataProvider(
      extensionPath
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
        this.updateCompareWith(ev.selection);
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
        async (item: FullQueryInfo) => {
          return this.handleItemClicked(item, [item]);
        }
      )
    );
    this.push(
      queryHistoryConfigListener.onDidChangeConfiguration(() => {
        this.treeDataProvider.refresh();
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
  }

  async invokeCallbackOn(queryHistoryItem: FullQueryInfo) {
    if (this.selectedCallback && queryHistoryItem.isCompleted()) {
      const sc = this.selectedCallback;
      await sc(queryHistoryItem as FullCompletedQueryInfo);
    }
  }

  async handleOpenQuery(
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[]
  ): Promise<void> {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);
    if (!this.assertSingleQuery(finalMultiSelect)) {
      return;
    }

    if (!finalSingleItem) {
      throw new Error(NO_QUERY_SELECTED);
    }

    const textDocument = await workspace.openTextDocument(
      Uri.file(finalSingleItem.initialInfo.queryPath)
    );
    const editor = await window.showTextDocument(
      textDocument,
      ViewColumn.One
    );
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

  async handleRemoveHistoryItem(
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    (finalMultiSelect || [finalSingleItem]).forEach((item) => {
      // Removing in progress queries is not supported yet
      if (item.status !== QueryStatus.InProgress) {
        this.treeDataProvider.remove(item);
        item.completedQuery?.dispose();
      }
    });
    const current = this.treeDataProvider.getCurrent();
    if (current !== undefined) {
      await this.treeView.reveal(current, { select: true });
      await this.invokeCallbackOn(current);
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
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[]
  ): Promise<void> {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }

    const response = await window.showInputBox({
      prompt: 'Label:',
      placeHolder: '(use default)',
      value: singleItem.label,
    });
    // undefined response means the user cancelled the dialog; don't change anything
    if (response !== undefined) {
      // Interpret empty string response as 'go back to using default'
      singleItem.initialInfo.userSpecifiedLabel = response === '' ? undefined : response;
      this.treeDataProvider.refresh();
    }
  }

  async handleCompareWith(
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[]
  ) {
    try {
      if (!singleItem.completedQuery?.didRunSuccessfully) {
        throw new Error('Please select a successful query.');
      }

      const from = this.compareWithItem || singleItem;
      const to = await this.findOtherQueryToCompare(from, multiSelect);

      if (from.isCompleted() && to?.isCompleted()) {
        await this.doCompareCallback(from as FullCompletedQueryInfo, to as FullCompletedQueryInfo);
      }
    } catch (e) {
      void showAndLogErrorMessage(e.message);
    }
  }

  async handleItemClicked(
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);
    if (!this.assertSingleQuery(finalMultiSelect)) {
      return;
    }

    if (!finalSingleItem) {
      throw new Error(NO_QUERY_SELECTED);
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
      await this.invokeCallbackOn(finalSingleItem);
    }
  }

  async handleShowQueryLog(
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[]
  ) {
    if (!this.assertSingleQuery(multiSelect)) {
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
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    (finalMultiSelect || [finalSingleItem]).forEach((item) => {
      if (item.status === QueryStatus.InProgress) {
        item.cancel();
      }
    });
  }

  async handleShowQueryText(
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[]
  ) {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }

    if (!singleItem) {
      throw new Error(NO_QUERY_SELECTED);
    }

    const rawQueryName = singleItem.getQueryName();
    const queryName = rawQueryName.endsWith('.ql') ? rawQueryName : rawQueryName + '.ql';
    const params = new URLSearchParams({
      isQuickEval: String(!!singleItem.initialInfo.quickEvalPosition),
      queryText: encodeURIComponent(await this.getQueryText(singleItem)),
    });
    const uri = Uri.parse(
      `codeql:${singleItem.initialInfo.id}-${queryName}?${params.toString()}`, true
    );
    const doc = await workspace.openTextDocument(uri);
    await window.showTextDocument(doc, { preview: false });
  }

  async handleViewSarifAlerts(
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[]
  ) {
    if (!this.assertSingleQuery(multiSelect) || !singleItem.completedQuery) {
      return;
    }
    const query = singleItem.completedQuery.query;
    const hasInterpretedResults = await query.canHaveInterpretedResults();
    if (hasInterpretedResults) {
      await this.tryOpenExternalFile(
        query.resultsPaths.interpretedResultsPath
      );
    } else {
      const label = singleItem.label;
      void showAndLogInformationMessage(
        `Query ${label} has no interpreted results.`
      );
    }
  }

  async handleViewCsvResults(
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[]
  ) {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }
    if (!singleItem.completedQuery) {
      return;
    }
    const query = singleItem.completedQuery.query;
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
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[]
  ) {
    if (!this.assertSingleQuery(multiSelect) || !singleItem.completedQuery) {
      return;
    }

    await this.tryOpenExternalFile(
      await singleItem.completedQuery.query.ensureCsvProduced(this.qs)
    );
  }

  async handleViewDil(
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[],
  ) {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }
    if (!singleItem.completedQuery) {
      return;
    }

    await this.tryOpenExternalFile(
      await singleItem.completedQuery.query.ensureDilPath(this.qs)
    );
  }

  async getQueryText(queryHistoryItem: FullQueryInfo): Promise<string> {
    return queryHistoryItem.initialInfo.queryText;
  }

  addQuery(item: FullQueryInfo) {
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
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[]
  ): Promise<FullQueryInfo | undefined> {
    if (!singleItem.completedQuery) {
      return undefined;
    }
    const dbName = singleItem.initialInfo.databaseInfo.name;

    // if exactly 2 queries are selected, use those
    if (multiSelect?.length === 2) {
      // return the query that is not the first selected one
      const otherQuery =
        singleItem === multiSelect[0] ? multiSelect[1] : multiSelect[0];
      if (!otherQuery.completedQuery) {
        throw new Error('Please select a completed query.');
      }
      if (!otherQuery.completedQuery.didRunSuccessfully) {
        throw new Error('Please select a successful query.');
      }
      if (otherQuery.initialInfo.databaseInfo.name !== dbName) {
        throw new Error('Query databases must be the same.');
      }
      return otherQuery;
    }

    if (multiSelect?.length > 1) {
      throw new Error('Please select no more than 2 queries.');
    }

    // otherwise, let the user choose
    const comparableQueryLabels = this.treeDataProvider.allHistory
      .filter(
        (otherQuery) =>
          otherQuery !== singleItem &&
          otherQuery.completedQuery &&
          otherQuery.completedQuery.didRunSuccessfully &&
          otherQuery.initialInfo.databaseInfo.name === dbName
      )
      .map((item) => ({
        label: item.label,
        description: item.initialInfo.databaseInfo.name,
        detail: item.completedQuery!.statusString,
        query: item,
      }));
    if (comparableQueryLabels.length < 1) {
      throw new Error('No other queries available to compare with.');
    }
    const choice = await window.showQuickPick(comparableQueryLabels);
    return choice?.query;
  }

  private assertSingleQuery(multiSelect: FullQueryInfo[] = [], message = 'Please select a single query.') {
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
  private updateCompareWith(newSelection: FullQueryInfo[]) {
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
    singleItem: FullQueryInfo,
    multiSelect: FullQueryInfo[]
  ): { finalSingleItem: FullQueryInfo; finalMultiSelect: FullQueryInfo[] } {
    if (!singleItem && !multiSelect?.[0]) {
      const selection = this.treeView.selection;
      const current = this.treeDataProvider.getCurrent();
      if (selection?.length) {
        return {
          finalSingleItem: selection[0],
          finalMultiSelect: selection
        };
      } else if (current) {
        return {
          finalSingleItem: current,
          finalMultiSelect: [current]
        };
      }
    }

    // ensure we do not return undefined
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

  refreshTreeView(): void {
    this.treeDataProvider.refresh();
  }
}
