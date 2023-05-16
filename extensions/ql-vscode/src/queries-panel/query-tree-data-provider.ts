import * as vscode from "vscode";
import { QueryTreeViewItem } from "./query-tree-view-item";
import { DisposableObject } from "../pure/disposable-object";

export class QueryTreeDataProvider
  extends DisposableObject
  implements vscode.TreeDataProvider<QueryTreeViewItem>
{
  private queryTreeItems: QueryTreeViewItem[];

  public constructor() {
    super();

    this.queryTreeItems = this.createTree();
  }

  private createTree(): QueryTreeViewItem[] {
    // Temporary mock data, just to populate the tree view.
    return [
      new QueryTreeViewItem("name1", "path1", []),
      new QueryTreeViewItem("name2", "path2", [
        new QueryTreeViewItem("name3", "path3", []),
        new QueryTreeViewItem("name4", "path4", [
          new QueryTreeViewItem("name5", "path5", []),
        ]),
      ]),
    ];
  }

  /**
   * Returns the UI presentation of the element that gets displayed in the view.
   * @param item The item to represent.
   * @returns The UI presentation of the item.
   */
  public getTreeItem(
    item: QueryTreeViewItem,
  ): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return item;
  }

  /**
   * Called when expanding an item (including the root item).
   * @param item The item to expand.
   * @returns The children of the item.
   */
  public getChildren(
    item?: QueryTreeViewItem,
  ): vscode.ProviderResult<QueryTreeViewItem[]> {
    if (!item) {
      // We're at the root.
      return this.queryTreeItems;
    } else {
      return item.children;
    }
  }
}
