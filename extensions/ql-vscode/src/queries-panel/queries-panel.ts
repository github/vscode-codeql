import * as vscode from "vscode";
import { DisposableObject } from "../pure/disposable-object";
import { QueryTreeDataProvider } from "./query-tree-data-provider";
import { QueryTreeViewItem } from "./query-tree-view-item";

export class QueriesPanel extends DisposableObject {
  private readonly dataProvider: QueryTreeDataProvider;
  private readonly treeView: vscode.TreeView<QueryTreeViewItem>;

  public constructor() {
    super();

    this.dataProvider = new QueryTreeDataProvider();

    this.treeView = vscode.window.createTreeView("codeQLQueries", {
      treeDataProvider: this.dataProvider,
    });

    this.push(this.treeView);
  }
}
