import { DisposableObject } from "../common/disposable-object";
import { QueryTreeDataProvider } from "./query-tree-data-provider";
import { QueryDiscovery } from "./query-discovery";
import { window } from "vscode";

export class QueriesPanel extends DisposableObject {
  public constructor(queryDiscovery: QueryDiscovery) {
    super();

    const dataProvider = new QueryTreeDataProvider(queryDiscovery);

    const treeView = window.createTreeView("codeQLQueries", {
      treeDataProvider: dataProvider,
    });
    dataProvider.onDidChangeTreeData(() => {
      if (dataProvider.getChildren().length === 0) {
        treeView.message =
          "We didn't find any CodeQL queries in this workspace. Create one to get started.";
      } else {
        treeView.message = undefined;
      }
    });
    this.push(treeView);
  }
}
