import * as vscode from "vscode";
import { DisposableObject } from "../pure/disposable-object";
import { QueryTreeDataProvider } from "./query-tree-data-provider";
import { QueryTreeViewItem } from "./query-tree-view-item";
import { QueryDiscovery } from "./query-discovery";

export class QueriesPanel extends DisposableObject {
  private readonly dataProvider: QueryTreeDataProvider;
  private readonly treeView: vscode.TreeView<QueryTreeViewItem>;

  public constructor(queryDiscovery: QueryDiscovery) {
    super();

    this.dataProvider = new QueryTreeDataProvider(queryDiscovery);

    this.treeView = vscode.window.createTreeView("codeQLQueries", {
      treeDataProvider: this.dataProvider,
    });

    this.push(this.treeView);
  }
}
