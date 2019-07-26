import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionContext, window as Window } from 'vscode';
import { EvaluationInfo } from './queries';
/**
 * query-history.ts
 * ------------
 * Managing state of previous queries that we've executed.
 *
 * The source of truth of the current state resides inside the
 * `TreeDataProvider` subclass below.
 */

/**
 * One item in the user-displayed list of databases. Probably name
 * should be computed from a nearby .project file if it exists.
 */
export class QueryHistoryItem {
  queryName: string;
  time: string;
  databaseName: string;
  info: EvaluationInfo;

  constructor(queryName: string, databaseName: string, info: EvaluationInfo) {
    this.queryName = queryName; // XXX maybe this goes in EvaluationInfo?
    this.databaseName = databaseName; // XXX maybe this goes in EvaluationInfo?
    this.info = info;
    this.time = new Date().toISOString();
  }

  toString(): string {
    const { databaseName, info, queryName, time } = this;
    return `${queryName} on ${databaseName} (${time}) - finished in ${info.result.evaluationTime / 1000} seconds`;
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

  constructor(ctx: ExtensionContext, selectedCallback?: (item: QueryHistoryItem) => void) {
    this.ctx = ctx;
    this.selectedCallback = selectedCallback;
    const treeDataProvider = this.treeDataProvider = new HistoryTreeDataProvider(ctx);
    this.treeView = Window.createTreeView('qlQueryHistory', { treeDataProvider });
    this.treeView.onDidChangeSelection(ev => {
      if (ev.selection.length == 0) {
        const current = this.treeDataProvider.getCurrent();
        if (current != undefined)
          this.treeView.reveal(current); // don't allow selection to become empty
      }
      if (ev.selection.length == 1) {
        if (this.selectedCallback) {
          (this.selectedCallback)(ev.selection[0]);
        }
      }
    });
  }

  push(item: QueryHistoryItem) {
    this.treeDataProvider.push(item);
    this.treeView.reveal(item, { select: true, focus: true });
  }
}
