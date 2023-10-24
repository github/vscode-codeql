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

    window.onDidChangeActiveTextEditor((textEditor) => {
      if (!textEditor) {
        return;
      }

      const filePath = textEditor.document.uri.fsPath;

      const item = dataProvider.getTreeItemByPath(filePath);
      if (!item) {
        return;
      }

      if (
        treeView.selection.length === 1 &&
        treeView.selection[0].path === item.path
      ) {
        // The item is already selected
        return;
      }

      void treeView.reveal(item, {
        select: true,
        focus: false,
      });
    });
  }
}
