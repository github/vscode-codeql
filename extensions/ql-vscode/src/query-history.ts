import * as path from 'path';
import * as vscode from 'vscode';
import { window as Window, env } from 'vscode';
import { CompletedQuery } from './query-results';
import { QueryHistoryConfig } from './config';
import { QueryWithResults } from './run-queries';
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

/**
 * query-history.ts
 * ------------
 * Managing state of previous queries that we've executed.
 *
 * The source of truth of the current state resides inside the
 * `TreeDataProvider` subclass below.
 */

export type QueryHistoryItemOptions = {
  label?: string; // user-settable label
  queryText?: string; // text of the selected file
  isQuickQuery?: boolean;
};

const SHOW_QUERY_TEXT_MSG = `\
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

enum SortOrder {
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

  private _onDidChangeTreeData = super.push(new vscode.EventEmitter<CompletedQuery | undefined>());

  readonly onDidChangeTreeData: vscode.Event<CompletedQuery | undefined> = this
    ._onDidChangeTreeData.event;

  private history: CompletedQuery[] = [];

  private failedIconPath: string;

  /**
   * When not undefined, must be reference-equal to an item in `this.databases`.
   */
  private current: CompletedQuery | undefined;

  constructor(extensionPath: string) {
    super();
    this.failedIconPath = path.join(
      extensionPath,
      FAILED_QUERY_HISTORY_ITEM_ICON
    );
  }

  async getTreeItem(element: CompletedQuery): Promise<vscode.TreeItem> {
    const treeItem = new vscode.TreeItem(element.toString());

    treeItem.command = {
      title: 'Query History Item',
      command: 'codeQLQueryHistory.itemClicked',
      arguments: [element],
    };

    // Mark this query history item according to whether it has a
    // SARIF file so that we can make context menu items conditionally
    // available.
    const hasResults = await element.query.hasInterpretedResults();
    treeItem.contextValue = hasResults
      ? 'interpretedResultsItem'
      : 'rawResultsItem';

    if (!element.didRunSuccessfully) {
      treeItem.iconPath = this.failedIconPath;
    }

    return treeItem;
  }

  getChildren(
    element?: CompletedQuery
  ): vscode.ProviderResult<CompletedQuery[]> {
    return element ? [] : this.history.sort((q1, q2) => {
      switch (this.sortOrder) {
        case SortOrder.NameAsc:
          return q1.toString().localeCompare(q2.toString(), env.language);
        case SortOrder.NameDesc:
          return q2.toString().localeCompare(q1.toString(), env.language);
        case SortOrder.DateAsc:
          return q1.date.getTime() - q2.date.getTime();
        case SortOrder.DateDesc:
          return q2.date.getTime() - q1.date.getTime();
        case SortOrder.CountAsc:
          return q1.resultCount - q2.resultCount;
        case SortOrder.CountDesc:
          return q2.resultCount - q1.resultCount;
        default:
          assertNever(this.sortOrder);
      }
    });
  }

  getParent(_element: CompletedQuery): vscode.ProviderResult<CompletedQuery> {
    return null;
  }

  getCurrent(): CompletedQuery | undefined {
    return this.current;
  }

  pushQuery(item: CompletedQuery): void {
    this.current = item;
    this.history.push(item);
    this.refresh();
  }

  setCurrentItem(item: CompletedQuery) {
    this.current = item;
  }

  remove(item: CompletedQuery) {
    if (this.current === item) this.current = undefined;
    const index = this.history.findIndex((i) => i === item);
    if (index >= 0) {
      this.history.splice(index, 1);
      if (this.current === undefined && this.history.length > 0) {
        // Try to keep a current item, near the deleted item if there
        // are any available.
        this.current = this.history[Math.min(index, this.history.length - 1)];
      }
      this.refresh();
    }
  }

  get allHistory(): CompletedQuery[] {
    return this.history;
  }

  refresh(completedQuery?: CompletedQuery) {
    this._onDidChangeTreeData.fire(completedQuery);
  }

  find(queryId: number): CompletedQuery | undefined {
    return this.allHistory.find((query) => query.query.queryID === queryId);
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
  treeView: vscode.TreeView<CompletedQuery>;
  lastItemClick: { time: Date; item: CompletedQuery } | undefined;
  compareWithItem: CompletedQuery | undefined;

  constructor(
    private qs: QueryServerClient,
    extensionPath: string,
    private queryHistoryConfigListener: QueryHistoryConfig,
    private selectedCallback: (item: CompletedQuery) => Promise<void>,
    private doCompareCallback: (
      from: CompletedQuery,
      to: CompletedQuery
    ) => Promise<void>
  ) {
    super();

    const treeDataProvider = (this.treeDataProvider = new HistoryTreeDataProvider(
      extensionPath
    ));
    this.treeView = Window.createTreeView('codeQLQueryHistory', {
      treeDataProvider,
      canSelectMany: true,
    });
    this.push(this.treeView);
    this.push(treeDataProvider);

    // Lazily update the tree view selection due to limitations of TreeView API (see
    // `updateTreeViewSelectionIfVisible` doc for details)
    this.push(
      this.treeView.onDidChangeVisibility(async (_ev) =>
        this.updateTreeViewSelectionIfVisible()
      )
    );
    // Don't allow the selection to become empty
    this.push(
      this.treeView.onDidChangeSelection(async (ev) => {
        if (ev.selection.length == 0) {
          this.updateTreeViewSelectionIfVisible();
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
        'codeQLQueryHistory.viewSarifResults',
        this.handleViewSarifResults.bind(this)
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
        async (item: CompletedQuery) => {
          return this.handleItemClicked(item, [item]);
        }
      )
    );
    queryHistoryConfigListener.onDidChangeConfiguration(() => {
      this.treeDataProvider.refresh();
    });

    // displays query text in a read-only document
    vscode.workspace.registerTextDocumentContentProvider('codeql', {
      provideTextDocumentContent(
        uri: vscode.Uri
      ): vscode.ProviderResult<string> {
        const params = new URLSearchParams(uri.query);

        return (
          (JSON.parse(params.get('isQuickEval') || '')
            ? SHOW_QUERY_TEXT_QUICK_EVAL_MSG
            : SHOW_QUERY_TEXT_MSG) + params.get('queryText')
        );
      },
    });
  }

  async invokeCallbackOn(queryHistoryItem: CompletedQuery) {
    if (this.selectedCallback !== undefined) {
      const sc = this.selectedCallback;
      await sc(queryHistoryItem);
    }
  }

  async handleOpenQuery(
    singleItem: CompletedQuery,
    multiSelect: CompletedQuery[]
  ): Promise<void> {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);
    if (!this.assertSingleQuery(finalMultiSelect)) {
      return;
    }

    if (!finalSingleItem) {
      throw new Error(NO_QUERY_SELECTED);
    }

    const textDocument = await vscode.workspace.openTextDocument(
      vscode.Uri.file(finalSingleItem.query.program.queryPath)
    );
    const editor = await vscode.window.showTextDocument(
      textDocument,
      vscode.ViewColumn.One
    );
    const queryText = finalSingleItem.options.queryText;
    if (queryText !== undefined && finalSingleItem.options.isQuickQuery) {
      await editor.edit((edit) =>
        edit.replace(
          textDocument.validateRange(
            new vscode.Range(0, 0, textDocument.lineCount, 0)
          ),
          queryText
        )
      );
    }
  }

  async handleRemoveHistoryItem(
    singleItem: CompletedQuery,
    multiSelect: CompletedQuery[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    (finalMultiSelect || [finalSingleItem]).forEach((item) => {
      this.treeDataProvider.remove(item);
      item.dispose();
    });
    const current = this.treeDataProvider.getCurrent();
    if (current !== undefined) {
      await this.treeView.reveal(current);
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
    singleItem: CompletedQuery,
    multiSelect: CompletedQuery[]
  ): Promise<void> {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }

    const response = await vscode.window.showInputBox({
      prompt: 'Label:',
      placeHolder: '(use default)',
      value: singleItem.getLabel(),
    });
    // undefined response means the user cancelled the dialog; don't change anything
    if (response !== undefined) {
      // Interpret empty string response as 'go back to using default'
      singleItem.options.label = response === '' ? undefined : response;
      if (this.treeDataProvider.sortOrder === SortOrder.NameAsc ||
        this.treeDataProvider.sortOrder === SortOrder.NameDesc) {
        this.treeDataProvider.refresh();
      } else {
        this.treeDataProvider.refresh(singleItem);
      }
    }
  }

  async handleCompareWith(
    singleItem: CompletedQuery,
    multiSelect: CompletedQuery[]
  ) {
    try {
      if (!singleItem.didRunSuccessfully) {
        throw new Error('Please select a successful query.');
      }

      const from = this.compareWithItem || singleItem;
      const to = await this.findOtherQueryToCompare(from, multiSelect);

      if (from && to) {
        await this.doCompareCallback(from, to);
      }
    } catch (e) {
      void showAndLogErrorMessage(e.message);
    }
  }

  async handleItemClicked(
    singleItem: CompletedQuery,
    multiSelect: CompletedQuery[]
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
    singleItem: CompletedQuery,
    multiSelect: CompletedQuery[]
  ) {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }

    if (singleItem.logFileLocation) {
      await this.tryOpenExternalFile(singleItem.logFileLocation);
    } else {
      void showAndLogWarningMessage('No log file available');
    }
  }

  async handleShowQueryText(
    singleItem: CompletedQuery,
    multiSelect: CompletedQuery[]
  ) {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }

    if (!singleItem) {
      throw new Error(NO_QUERY_SELECTED);
    }

    const queryName = singleItem.queryName.endsWith('.ql')
      ? singleItem.queryName
      : singleItem.queryName + '.ql';
    const params = new URLSearchParams({
      isQuickEval: String(!!singleItem.query.quickEvalPosition),
      queryText: encodeURIComponent(await this.getQueryText(singleItem)),
    });
    const uri = vscode.Uri.parse(
      `codeql:${singleItem.query.queryID}-${queryName}?${params.toString()}`, true
    );
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });
  }

  async handleViewSarifResults(
    singleItem: CompletedQuery,
    multiSelect: CompletedQuery[]
  ) {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }

    const hasInterpretedResults = await singleItem.query.canHaveInterpretedResults();
    if (hasInterpretedResults) {
      await this.tryOpenExternalFile(
        singleItem.query.resultsPaths.interpretedResultsPath
      );
    } else {
      const label = singleItem.getLabel();
      void showAndLogInformationMessage(
        `Query ${label} has no interpreted results.`
      );
    }
  }

  async handleViewCsvResults(
    singleItem: CompletedQuery,
    multiSelect: CompletedQuery[]
  ) {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }

    await this.tryOpenExternalFile(
      await singleItem.query.ensureCsvProduced(this.qs)
    );
  }

  async handleViewDil(
    singleItem: CompletedQuery,
    multiSelect: CompletedQuery[],
  ) {
    if (!this.assertSingleQuery(multiSelect)) {
      return;
    }

    await this.tryOpenExternalFile(
      await singleItem.query.ensureDilPath(this.qs)
    );
  }

  async getQueryText(queryHistoryItem: CompletedQuery): Promise<string> {
    if (queryHistoryItem.options.queryText) {
      return queryHistoryItem.options.queryText;
    } else if (queryHistoryItem.query.quickEvalPosition) {
      // capture all selected lines
      const startLine = queryHistoryItem.query.quickEvalPosition.line;
      const endLine = queryHistoryItem.query.quickEvalPosition.endLine;
      const textDocument = await vscode.workspace.openTextDocument(
        queryHistoryItem.query.quickEvalPosition.fileName
      );
      return textDocument.getText(
        new vscode.Range(startLine - 1, 0, endLine, 0)
      );
    } else {
      return '';
    }
  }

  buildCompletedQuery(info: QueryWithResults): CompletedQuery {
    const item = new CompletedQuery(info, this.queryHistoryConfigListener);
    return item;
  }

  addCompletedQuery(item: CompletedQuery) {
    this.treeDataProvider.pushQuery(item);
    this.updateTreeViewSelectionIfVisible();
  }

  find(queryId: number): CompletedQuery | undefined {
    return this.treeDataProvider.find(queryId);
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
        void this.treeView.reveal(current);
      }
    }
  }

  private async tryOpenExternalFile(fileLocation: string) {
    const uri = vscode.Uri.file(fileLocation);
    try {
      await vscode.window.showTextDocument(uri, { preview: false });
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
            await vscode.commands.executeCommand('revealFileInOS', uri);
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
    singleItem: CompletedQuery,
    multiSelect: CompletedQuery[]
  ): Promise<CompletedQuery | undefined> {
    const dbName = singleItem.database.name;

    // if exactly 2 queries are selected, use those
    if (multiSelect?.length === 2) {
      // return the query that is not the first selected one
      const otherQuery =
        singleItem === multiSelect[0] ? multiSelect[1] : multiSelect[0];
      if (!otherQuery.didRunSuccessfully) {
        throw new Error('Please select a successful query.');
      }
      if (otherQuery.database.name !== dbName) {
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
          otherQuery.didRunSuccessfully &&
          otherQuery.database.name === dbName
      )
      .map((otherQuery) => ({
        label: otherQuery.toString(),
        description: otherQuery.databaseName,
        detail: otherQuery.statusString,
        query: otherQuery,
      }));
    if (comparableQueryLabels.length < 1) {
      throw new Error('No other queries available to compare with.');
    }
    const choice = await vscode.window.showQuickPick(comparableQueryLabels);
    return choice?.query;
  }

  private assertSingleQuery(multiSelect: CompletedQuery[] = [], message = 'Please select a single query.') {
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
  private updateCompareWith(newSelection: CompletedQuery[]) {
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
   * We need to use this method because when clicking on commands from the view title
   * bar, the selections are not passed in.
   *
   * @param singleItem the single item selected, or undefined if no item is selected
   * @param multiSelect a multi-select or undefined if no items are selected
   */
  private determineSelection(
    singleItem: CompletedQuery,
    multiSelect: CompletedQuery[]
  ): { finalSingleItem: CompletedQuery; finalMultiSelect: CompletedQuery[] } {
    if (singleItem === undefined && (multiSelect === undefined || multiSelect.length === 0 || multiSelect[0] === undefined)) {
      const selection = this.treeView.selection;
      if (selection) {
        return {
          finalSingleItem: selection[0],
          finalMultiSelect: selection
        };
      }
    }
    return {
      finalSingleItem: singleItem,
      finalMultiSelect: multiSelect
    };
  }

  async refreshTreeView(completedQuery: CompletedQuery): Promise<void> {
    this.treeDataProvider.refresh(completedQuery);
  }
}
