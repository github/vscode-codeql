import { DisposableObject } from "../common/disposable-object";
import { QueryTreeDataProvider } from "./query-tree-data-provider";
import { QueryDiscovery } from "./query-discovery";
import { window } from "vscode";
import { App } from "../common/app";

export class QueriesPanel extends DisposableObject {
  public constructor(
    queryDiscovery: QueryDiscovery,
    readonly app: App,
  ) {
    super();

    const dataProvider = new QueryTreeDataProvider(queryDiscovery, app);

    const treeView = window.createTreeView("codeQLQueries", {
      treeDataProvider: dataProvider,
    });
    this.push(treeView);
  }
}
