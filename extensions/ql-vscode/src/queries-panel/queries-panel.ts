import { DisposableObject } from "../common/disposable-object";
import { QueryTreeDataProvider } from "./query-tree-data-provider";
import { QueryDiscovery } from "./query-discovery";
import { QueriesPanelCommands } from "../common/commands";
import { QueryTreeViewItem } from "./query-tree-view-item";
import { App } from "../common/app";
import { Uri, window } from "vscode";

export class QueriesPanel extends DisposableObject {
  public constructor(
    private readonly app: App,
    queryDiscovery: QueryDiscovery,
  ) {
    super();

    const dataProvider = new QueryTreeDataProvider(queryDiscovery);

    const treeView = window.createTreeView("codeQLQueries", {
      treeDataProvider: dataProvider,
    });
    this.push(treeView);
  }

  public getCommands(): QueriesPanelCommands {
    return {
      "codeQLQueries.runLocalQueryContextInline": this.runLocalQuery.bind(this),
    };
  }

  private async runLocalQuery(
    queryTreeViewItem: QueryTreeViewItem,
  ): Promise<void> {
    await this.app.queryServerCommands.execute(
      "codeQLQueries.runLocalQueryFromQueriesPanel",
      Uri.file(queryTreeViewItem.path),
    );
  }
}
