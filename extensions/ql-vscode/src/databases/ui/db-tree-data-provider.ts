import {
  Event,
  EventEmitter,
  ProviderResult,
  TreeDataProvider,
  TreeItem,
} from "vscode";
import { createDbTreeViewItemError, DbTreeViewItem } from "./db-tree-view-item";
import { DbManager } from "../db-manager";
import { mapDbItemToTreeViewItem } from "./db-item-mapper";
import { DisposableObject } from "../../pure/disposable-object";

export class DbTreeDataProvider
  extends DisposableObject
  implements TreeDataProvider<DbTreeViewItem>
{
  // This is an event to signal that there's been a change in the tree which
  // will case the view to refresh. It is part of the TreeDataProvider interface.
  public readonly onDidChangeTreeData: Event<DbTreeViewItem | undefined>;

  private _onDidChangeTreeData = this.push(
    new EventEmitter<DbTreeViewItem | undefined>(),
  );
  private dbTreeItems: DbTreeViewItem[];

  public constructor(private readonly dbManager: DbManager) {
    super();
    this.dbTreeItems = this.createTree();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;

    dbManager.onDbItemsChanged(() => {
      this.dbTreeItems = this.createTree();
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  /**
   * Called when expanding a node (including the root node).
   * @param node The node to expand.
   * @returns The children of the node.
   */
  public getChildren(node?: DbTreeViewItem): ProviderResult<DbTreeViewItem[]> {
    if (!node) {
      // We're at the root.
      return Promise.resolve(this.dbTreeItems);
    } else {
      return Promise.resolve(node.children);
    }
  }

  /**
   * Returns the UI presentation of the element that gets displayed in the view.
   * @param node The node to represent.
   * @returns The UI presentation of the node.
   */
  public getTreeItem(node: DbTreeViewItem): TreeItem | Thenable<TreeItem> {
    return node;
  }

  private createTree(): DbTreeViewItem[] {
    const dbItemsResult = this.dbManager.getDbItems();

    if (dbItemsResult.isFailure) {
      const errorTreeViewItem = createDbTreeViewItemError(
        "Error when reading databases config",
        "Please open your databases config and address errors",
      );

      return [errorTreeViewItem];
    }

    return dbItemsResult.value.map(mapDbItemToTreeViewItem);
  }
}
