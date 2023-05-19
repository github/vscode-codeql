import { Event, EventEmitter, TreeDataProvider, TreeItem } from "vscode";
import { QueryTreeViewItem } from "./query-tree-view-item";
import { DisposableObject } from "../pure/disposable-object";
import { QueryDiscovery } from "./query-discovery";
import { FileTreeNode } from "../common/file-tree-nodes";

export class QueryTreeDataProvider
  extends DisposableObject
  implements TreeDataProvider<QueryTreeViewItem>
{
  private queryTreeItems: QueryTreeViewItem[];

  private readonly onDidChangeTreeDataEmitter = this.push(
    new EventEmitter<void>(),
  );

  public constructor(private readonly queryDiscovery: QueryDiscovery) {
    super();

    queryDiscovery.onDidChangeQueries(() => {
      this.queryTreeItems = this.createTree();
      this.onDidChangeTreeDataEmitter.fire();
    });

    this.queryTreeItems = this.createTree();
  }

  public get onDidChangeTreeData(): Event<void> {
    return this.onDidChangeTreeDataEmitter.event;
  }

  private createTree(): QueryTreeViewItem[] {
    return (this.queryDiscovery.queries || []).map(
      this.convertFileTreeNode.bind(this),
    );
  }

  private convertFileTreeNode(
    fileTreeDirectory: FileTreeNode,
  ): QueryTreeViewItem {
    return new QueryTreeViewItem(
      fileTreeDirectory.path,
      fileTreeDirectory.children.map(this.convertFileTreeNode.bind(this)),
    );
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
}
