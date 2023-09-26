import { DisposableObject } from "../common/disposable-object";
import { QueryTreeDataProvider } from "./query-tree-data-provider";
import { QueryDiscovery } from "./query-discovery";
import { window } from "vscode";
import { App } from "../common/app";
import { DatabaseUI } from "../databases/local-databases-ui";

export class QueriesPanel extends DisposableObject {
  public constructor(
    queryDiscovery: QueryDiscovery,
    readonly app: App,
    databaseUI: DatabaseUI,
  ) {
    super();

    const dataProvider = new QueryTreeDataProvider(
      queryDiscovery,
      app,
      databaseUI,
    );

    const treeView = window.createTreeView("codeQLQueries", {
      treeDataProvider: dataProvider,
    });
    this.push(treeView);
  }
}
