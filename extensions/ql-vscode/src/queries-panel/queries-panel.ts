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
    this.push(treeView);
  }
}
