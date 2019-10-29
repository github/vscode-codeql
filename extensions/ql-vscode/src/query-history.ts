import * as vscode from 'vscode';
import { ExtensionContext, window as Window } from 'vscode';
import { EvaluationInfo } from './queries';
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
    if (info.query.metadata && info.query.metadata.name) {
      this.queryName = info.query.metadata.name;
    } else {
      this.queryName = path.basename(info.query.program.queryPath);
    }
    this.databaseName = info.database.name;
    this.info = info;
    this.time = new Date().toISOString();
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
    return `${queryName} on ${databaseName} (${time}) - ${this.statusString}`;
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
      title: 'Show Result',
      command: 'qlQueryHistory.setCurrentExecution',
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

export class QueryHistoryManager {
  treeDataProvider: HistoryTreeDataProvider;
  ctx: ExtensionContext;
  treeView: vscode.TreeView<QueryHistoryItem>;
  selectedCallback: ((item: QueryHistoryItem) => void) | undefined;

  constructor(ctx: ExtensionContext, selectedCallback?: (item: QueryHistoryItem) => Promise<void>) {
    this.ctx = ctx;
    this.selectedCallback = selectedCallback;
    const treeDataProvider = this.treeDataProvider = new HistoryTreeDataProvider(ctx);
    this.treeView = Window.createTreeView('qlQueryHistory', { treeDataProvider });
    this.treeView.onDidChangeSelection(async ev => {
      if (ev.selection.length == 0) {
        const current = this.treeDataProvider.getCurrent();
        if (current != undefined)
          this.treeView.reveal(current); // don't allow selection to become empty
      }
      if (ev.selection.length == 1) {
        if (this.selectedCallback) {
          const sc = this.selectedCallback;
          await sc(ev.selection[0]);
        }
      }
    });
  }

  push(item: QueryHistoryItem) {
    this.treeDataProvider.push(item);
    this.treeView.reveal(item, { select: true, focus: true });
  }
}
