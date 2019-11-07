import * as vscode from 'vscode';
import { ExtensionContext, window as Window } from 'vscode';
import { EvaluationInfo } from './queries';
import * as helpers from './helpers';
import * as messages from './messages';
import * as path from 'path';
/**
 * query-history.ts
 * ------------
 * Managing state of previous queries that we've executed.
 *
 * The source of truth of the current state resides inside the
 * `TreeDataProvider` subclass below.
 */

/**
 * One item in the user-displayed list of queries that have been run.
 */
export class QueryHistoryItem {
  queryName: string;
  time: string;
  databaseName: string;
  info: EvaluationInfo;

  constructor(info: EvaluationInfo) {
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

  toString(): string {
    const { databaseName, queryName, time } = this;
    return `[${time}] ${queryName} on ${databaseName} - ${this.statusString}`;
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

  private ctx: ExtensionContext;
  private history: QueryHistoryItem[] = [];

  /**
   * When not undefined, must be reference-equal to an item in `this.databases`.
   */
  private current: QueryHistoryItem | undefined;

  constructor(ctx: ExtensionContext) {
    this.ctx = ctx;
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

  getParent(element: QueryHistoryItem): vscode.ProviderResult<QueryHistoryItem> {
    return null;
  }

  getCurrent(): QueryHistoryItem | undefined {
    return this.current;
  }

  push(item: QueryHistoryItem): void {
    this.current = item;
    this.history.push(item);
    this._onDidChangeTreeData.fire();
  }

  setCurrentItem(item: QueryHistoryItem) {
    this.current = item;
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

  async handleOpenQuery(queryHistoryItem: QueryHistoryItem) {
    const textDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(queryHistoryItem.info.query.program.queryPath));
    await vscode.window.showTextDocument(textDocument, vscode.ViewColumn.One);
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
      if (this.selectedCallback !== undefined) {
        const sc = this.selectedCallback;
        await sc(queryHistoryItem);
      }
    }
  }

  constructor(ctx: ExtensionContext, selectedCallback?: (item: QueryHistoryItem) => Promise<void>) {
    this.ctx = ctx;
    this.selectedCallback = selectedCallback;
    const treeDataProvider = this.treeDataProvider = new HistoryTreeDataProvider(ctx);
    this.treeView = Window.createTreeView('codeQLQueryHistory', { treeDataProvider });
    this.treeView.onDidChangeSelection(async ev => {
      if (ev.selection.length == 0) {
        const current = this.treeDataProvider.getCurrent();
        if (current != undefined)
          this.treeView.reveal(current); // don't allow selection to become empty
      }
    });
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.openQuery', this.handleOpenQuery));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.itemClicked', async (item) => {
      return this.handleItemClicked(item);
    }));
  }

  push(item: QueryHistoryItem) {
    this.treeDataProvider.push(item);
    this.treeView.reveal(item, { select: true });
  }
}
