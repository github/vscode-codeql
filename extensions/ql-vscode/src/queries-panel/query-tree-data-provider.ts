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
      {
        label: "name1",
        tooltip: "path1",
        children: [],
      },
      {
        label: "name2",
        tooltip: "path2",
        children: [
          {
            label: "name3",
            tooltip: "path3",
            children: [],
          },
          {
            label: "name4",
            tooltip: "path4",
            children: [
              {
                label: "name5",
                tooltip: "path5",
                children: [],
              },
            ],
          },
        ],
      },
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
    const state = item.children.length
      ? vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;

    const treeItem = new vscode.TreeItem(item.label, state);
    treeItem.tooltip = item.tooltip;

    return treeItem;
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
