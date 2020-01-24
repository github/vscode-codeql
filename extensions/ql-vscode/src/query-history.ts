import * as vscode from 'vscode';
import { ExtensionContext, window as Window } from 'vscode';
import { EvaluationInfo } from './queries';
import * as helpers from './helpers';
import * as messages from './messages';
import { QueryHistoryConfig } from './config';
/**
 * query-history.ts
 * ------------
 * Managing state of previous queries that we've executed.
 *
 * The source of truth of the current state resides inside the
 * `TreeDataProvider` subclass below.
 */

export type QueryHistoryItemOptions = {
  label?: string, // user-settable label
  queryText?: string, // stored query for quick query
}

/**
 * One item in the user-displayed list of queries that have been run.
 */
export class QueryHistoryItem {
  queryName: string;
  time: string;
  databaseName: string;
  info: EvaluationInfo;

  constructor(
    info: EvaluationInfo,
    public config: QueryHistoryConfig,
    public options: QueryHistoryItemOptions = info.historyItemOptions,
  ) {
    this.queryName = helpers.getQueryName(info);
    this.databaseName = info.database.name;
    this.info = info;
    this.time = new Date().toLocaleString();
  }

  get statusString(): string {
    switch (this.info.result.resultType) {
      case messages.QueryResultType.CANCELLATION:
        return `cancelled after ${this.info.result.evaluationTime / 1000} seconds`;
      case messages.QueryResultType.OOM:
        return `out of memory`;
      case messages.QueryResultType.SUCCESS:
        return `finished in ${this.info.result.evaluationTime / 1000} seconds`;
      case messages.QueryResultType.TIMEOUT:
        return `timed out after ${this.info.result.evaluationTime / 1000} seconds`;
      case messages.QueryResultType.OTHER_ERROR:
      default:
        return `failed`;
    }
  }

  interpolate(template: string): string {
    const { databaseName, queryName, time, statusString } = this;
    const replacements: { [k: string]: string } = {
      t: time,
      q: queryName,
      d: databaseName,
      s: statusString,
      '%': '%',
    };
    return template.replace(/%(.)/g, (match, key) => {
      const replacement = replacements[key];
      return replacement !== undefined ? replacement : match;
    });
  }

  getLabel(): string {
    if (this.options.label !== undefined)
      return this.options.label;
    return this.config.format;
  }

  toString(): string {
    return this.interpolate(this.getLabel());
  }
}

/**
 * Tree data provider for the query history view.
 */
class HistoryTreeDataProvider implements vscode.TreeDataProvider<QueryHistoryItem> {

  /**
   * XXX: This idiom for how to get a `.fire()`-able event emitter was
   * cargo culted from another vscode extension. It seems rather
   * involved and I hope there's something better that can be done
   * instead.
   */
  private _onDidChangeTreeData: vscode.EventEmitter<QueryHistoryItem | undefined> = new vscode.EventEmitter<QueryHistoryItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<QueryHistoryItem | undefined> = this._onDidChangeTreeData.event;

  private history: QueryHistoryItem[] = [];

  /**
   * When not undefined, must be reference-equal to an item in `this.databases`.
   */
  private current: QueryHistoryItem | undefined;

  constructor() {
    this.history = [];
  }

  getTreeItem(element: QueryHistoryItem): vscode.TreeItem {
    const it = new vscode.TreeItem(element.toString());

    it.command = {
      title: 'Query History Item',
      command: 'codeQLQueryHistory.itemClicked',
      arguments: [element],
    };

    return it;
  }

  getChildren(element?: QueryHistoryItem): vscode.ProviderResult<QueryHistoryItem[]> {
    if (element == undefined) {
      return this.history;
    }
    else {
      return [];
    }
  }

  getParent(_element: QueryHistoryItem): vscode.ProviderResult<QueryHistoryItem> {
    return null;
  }

  getCurrent(): QueryHistoryItem | undefined {
    return this.current;
  }

  push(item: QueryHistoryItem): void {
    this.current = item;
    this.history.push(item);
    this.refresh();
  }

  setCurrentItem(item: QueryHistoryItem) {
    this.current = item;
  }

  remove(item: QueryHistoryItem) {
    if (this.current === item)
      this.current = undefined;
    const index = this.history.findIndex(i => i === item);
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

  refresh() {
    this._onDidChangeTreeData.fire();
  }
}

/**
 * Number of milliseconds two clicks have to arrive apart to be
 * considered a double-click.
 */
const DOUBLE_CLICK_TIME = 500;

export class QueryHistoryManager {
  treeDataProvider: HistoryTreeDataProvider;
  ctx: ExtensionContext;
  treeView: vscode.TreeView<QueryHistoryItem>;
  selectedCallback: ((item: QueryHistoryItem) => void) | undefined;
  lastItemClick: { time: Date, item: QueryHistoryItem } | undefined;

  async invokeCallbackOn(queryHistoryItem: QueryHistoryItem) {
    if (this.selectedCallback !== undefined) {
      const sc = this.selectedCallback;
      await sc(queryHistoryItem);
    }
  }

  async handleOpenQuery(queryHistoryItem: QueryHistoryItem): Promise<void> {
    const textDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(queryHistoryItem.info.query.program.queryPath));
    const editor = await vscode.window.showTextDocument(textDocument, vscode.ViewColumn.One);
    const queryText = queryHistoryItem.options.queryText;
    if (queryText !== undefined) {
      await editor.edit(edit => edit.replace(textDocument.validateRange(
        new vscode.Range(0, 0, textDocument.lineCount, 0)), queryText)
      );
    }
  }

  async handleRemoveHistoryItem(queryHistoryItem: QueryHistoryItem) {
    this.treeDataProvider.remove(queryHistoryItem);
    const current = this.treeDataProvider.getCurrent();
    if (current !== undefined) {
      this.treeView.reveal(current);
      await this.invokeCallbackOn(current);
    }
  }

  async handleSetLabel(queryHistoryItem: QueryHistoryItem) {
    const response = await vscode.window.showInputBox({
      prompt: 'Label:',
      placeHolder: '(use default)',
      value: queryHistoryItem.getLabel(),
    });
    // undefined response means the user cancelled the dialog; don't change anything
    if (response !== undefined) {
      if (response === '')
        // Interpret empty string response as "go back to using default"
        queryHistoryItem.options.label = undefined;
      else
        queryHistoryItem.options.label = response;
      this.treeDataProvider.refresh();
    }
  }

  async handleItemClicked(queryHistoryItem: QueryHistoryItem) {
    this.treeDataProvider.setCurrentItem(queryHistoryItem);

    const now = new Date();
    const prevItemClick = this.lastItemClick;
    this.lastItemClick = { time: now, item: queryHistoryItem };

    if (prevItemClick !== undefined
      && (now.valueOf() - prevItemClick.time.valueOf()) < DOUBLE_CLICK_TIME
      && queryHistoryItem == prevItemClick.item) {
      // show original query file on double click
      await this.handleOpenQuery(queryHistoryItem);
    }
    else {
      // show results on single click
      await this.invokeCallbackOn(queryHistoryItem);
    }
  }

  constructor(
    ctx: ExtensionContext,
    private queryHistoryConfigListener: QueryHistoryConfig,
    selectedCallback?: (item: QueryHistoryItem) => Promise<void>
  ) {
    this.ctx = ctx;
    this.selectedCallback = selectedCallback;
    const treeDataProvider = this.treeDataProvider = new HistoryTreeDataProvider();
    this.treeView = Window.createTreeView('codeQLQueryHistory', { treeDataProvider });
    // Lazily update the tree view selection due to limitations of TreeView API (see
    // `updateTreeViewSelectionIfVisible` doc for details)
    this.treeView.onDidChangeVisibility(async _ev => this.updateTreeViewSelectionIfVisible());
    // Don't allow the selection to become empty
    this.treeView.onDidChangeSelection(async ev => {
      if (ev.selection.length == 0) {
        this.updateTreeViewSelectionIfVisible();
      }
    });
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.openQuery', this.handleOpenQuery));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.removeHistoryItem', this.handleRemoveHistoryItem.bind(this)));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.setLabel', this.handleSetLabel.bind(this)));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.itemClicked', async (item) => {
      return this.handleItemClicked(item);
    }));
    queryHistoryConfigListener.onDidChangeQueryHistoryConfiguration(() => {
      this.treeDataProvider.refresh();
    });
  }

  push(evaluationInfo: EvaluationInfo) {
    const item = new QueryHistoryItem(evaluationInfo, this.queryHistoryConfigListener);
    this.treeDataProvider.push(item);
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
        this.treeView.reveal(current);
      }
    }
  }
}
