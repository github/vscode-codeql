import type { Event, TreeDataProvider, TreeItem } from "vscode";
import { EventEmitter } from "vscode";
import type { QueryTreeViewItem } from "./query-tree-view-item";
import {
  createQueryTreeFileItem,
  createQueryTreeFolderItem,
} from "./query-tree-view-item";
import { DisposableObject } from "../common/disposable-object";
import type { FileTreeNode } from "../common/file-tree-nodes";
import type { App } from "../common/app";
import { containsPath } from "../common/files";

export interface QueryDiscoverer {
  readonly buildQueryTree: () => Array<FileTreeNode<string>> | undefined;
  readonly onDidChangeQueries: Event<void>;
}

export class QueryTreeDataProvider
  extends DisposableObject
  implements TreeDataProvider<QueryTreeViewItem>
{
  private queryTreeItems: QueryTreeViewItem[];

  private readonly onDidChangeTreeDataEmitter = this.push(
    new EventEmitter<void>(),
  );

  public constructor(
    private readonly queryDiscoverer: QueryDiscoverer,
    private readonly app: App,
  ) {
    super();

    queryDiscoverer.onDidChangeQueries(() => {
      this.queryTreeItems = this.createTree();
      this.onDidChangeTreeDataEmitter.fire();
    });

    this.queryTreeItems = this.createTree();
  }

  public get onDidChangeTreeData(): Event<void> {
    return this.onDidChangeTreeDataEmitter.event;
  }

  /**
   * Retrieves a specific tree view item by its path. If it's not found, returns undefined.
   *
   * @param path The path to retrieve the item for.
   */
  public getTreeItemByPath(path: string): QueryTreeViewItem | undefined {
    const itemPath = this.findItemPath(path, this.queryTreeItems);
    if (!itemPath) {
      return undefined;
    }

    return itemPath[itemPath.length - 1];
  }

  /**
   * Find a specific tree view item by path.
   *
   * @param path The path to find the item for.
   * @param items The items to search.
   * @param currentPath The current path to the item.
   * @return The path to the tree view item, or undefined if it could not be found. The last item in the
   *         array is the item itself.
   */
  private findItemPath(
    path: string,
    items: QueryTreeViewItem[],
    currentPath: QueryTreeViewItem[] = [],
  ): QueryTreeViewItem[] | undefined {
    const relevantItems = items.filter((item) => containsPath(item.path, path));

    const matchingItem = relevantItems.find((item) => item.path === path);
    if (matchingItem) {
      return [...currentPath, matchingItem];
    }

    for (const item of relevantItems) {
      const childItem = this.findItemPath(path, item.children, [
        ...currentPath,
        item,
      ]);
      if (childItem) {
        return childItem;
      }
    }

    return undefined;
  }

  private createTree(): QueryTreeViewItem[] {
    const queryTree = this.queryDiscoverer.buildQueryTree();
    if (queryTree === undefined) {
      return [];
    } else if (queryTree.length === 0) {
      void this.app.commands.execute("setContext", "codeQL.noQueries", true);
      // Returning an empty tree here will show the welcome view
      return [];
    } else {
      void this.app.commands.execute("setContext", "codeQL.noQueries", false);
      return queryTree.map(this.convertFileTreeNode.bind(this));
    }
  }

  private convertFileTreeNode(
    fileTreeDirectory: FileTreeNode<string>,
  ): QueryTreeViewItem {
    if (fileTreeDirectory.children.length === 0) {
      return createQueryTreeFileItem(
        fileTreeDirectory.name,
        fileTreeDirectory.path,
        fileTreeDirectory.data,
      );
    } else {
      return createQueryTreeFolderItem(
        fileTreeDirectory.name,
        fileTreeDirectory.path,
        fileTreeDirectory.children.map(this.convertFileTreeNode.bind(this)),
      );
    }
  }

  /**
   * Returns the UI presentation of the element that gets displayed in the view.
   * @param item The item to represent.
   * @returns The UI presentation of the item.
   */
  public getTreeItem(item: QueryTreeViewItem): TreeItem {
    return item;
  }

  /**
   * Called when expanding an item (including the root item).
   * @param item The item to expand.
   * @returns The children of the item.
   */
  public getChildren(item?: QueryTreeViewItem): QueryTreeViewItem[] {
    if (!item) {
      // We're at the root.
      return this.queryTreeItems;
    } else {
      return item.children;
    }
  }

  public getParent(item: QueryTreeViewItem): QueryTreeViewItem | undefined {
    const itemPath = this.findItemPath(item.path, this.queryTreeItems);
    if (!itemPath) {
      return undefined;
    }

    // The item itself is last in the last, so the parent is the second last item.
    return itemPath[itemPath.length - 2];
  }
}
