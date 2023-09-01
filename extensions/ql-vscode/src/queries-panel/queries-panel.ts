import { DisposableObject } from "../common/disposable-object";
import {
  QueryDiscoverer,
  QueryTreeDataProvider,
} from "./query-tree-data-provider";
import { window } from "vscode";

export class QueriesPanel extends DisposableObject {
  private readonly dataProvider: QueryTreeDataProvider;
  public constructor(queryDiscoverer: QueryDiscoverer) {
    super();

    this.dataProvider = new QueryTreeDataProvider(queryDiscoverer);

    const treeView = window.createTreeView("codeQLQueries", {
      treeDataProvider: this.dataProvider,
    });

    this.dataProvider.onDidChangeTreeData(() => {
      treeView.message = this.getMessage();
    });
    this.push(treeView);
  }

  public getMessage(): string | undefined {
    if (this.dataProvider.getChildren().length === 0) {
      return "We didn't find any CodeQL queries in this workspace. Create one to get started.";
    } else {
      return undefined;
    }
  }
}
