import { logger } from '../../logging';
import { ProviderResult, TreeDataProvider, TreeItem } from 'vscode';
import { DbTreeViewItem } from './db-tree-view-item';
import { DbManager } from '../db-manager';

export class DbTreeDataProvider implements TreeDataProvider<DbTreeViewItem> {
  private dbTreeItems: DbTreeViewItem[];

  public constructor(
    private readonly dbManager: DbManager
  ) {
    this.dbTreeItems = this.createTree();
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
    const dbItems = this.dbManager.getDbItems();

    // This will be fleshed out in a future change.
    void logger.log(`Creating database tree with ${dbItems.length} items`);

    return [];
  }
}
