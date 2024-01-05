import {
  ThemeColor,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
} from "vscode";
import type {
  DbItem,
  RemoteOwnerDbItem,
  RemoteRepoDbItem,
  RemoteSystemDefinedListDbItem,
  RemoteUserDefinedListDbItem,
  RootRemoteDbItem,
} from "../db-item";
import { isSelectableDbItem } from "../db-item";
import { getDbItemActions } from "./db-tree-view-item-action";

export const SELECTED_DB_ITEM_RESOURCE_URI = "codeql://databases?selected=true";

/**
 * Represents an item in the database tree view. This item could be
 * representing an actual database item or a warning.
 */
export class DbTreeViewItem extends TreeItem {
  constructor(
    // iconPath and tooltip must have those names because
    // they are part of the vscode.TreeItem interface

    public readonly dbItem: DbItem | undefined,
    public readonly iconPath: ThemeIcon | undefined,
    public readonly label: string,
    public readonly tooltip: string | undefined,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly children: DbTreeViewItem[],
  ) {
    super(label, collapsibleState);

    if (dbItem) {
      this.contextValue = getContextValue(dbItem);
      if (isSelectableDbItem(dbItem) && dbItem.selected) {
        this.setAsSelected();
      }
    }
  }

  public setAsSelected(): void {
    // Define the resource id to drive the UI to render this item as selected.
    this.resourceUri = Uri.parse(SELECTED_DB_ITEM_RESOURCE_URI);
  }

  public setAsUnselected(): void {
    this.resourceUri = undefined;
  }
}

function getContextValue(dbItem: DbItem): string | undefined {
  const actions = getDbItemActions(dbItem);
  return actions.length > 0 ? actions.join(",") : undefined;
}

export function createDbTreeViewItemError(
  label: string,
  tooltip: string,
): DbTreeViewItem {
  return new DbTreeViewItem(
    undefined,
    new ThemeIcon("error", new ThemeColor("problemsErrorIcon.foreground")),
    label,
    tooltip,
    TreeItemCollapsibleState.None,
    [],
  );
}

export function createDbTreeViewItemRoot(
  dbItem: RootRemoteDbItem,
  label: string,
  tooltip: string,
  children: DbTreeViewItem[],
): DbTreeViewItem {
  return new DbTreeViewItem(
    dbItem,
    undefined,
    label,
    tooltip,
    getCollapsibleState(dbItem.expanded),
    children,
  );
}

export function createDbTreeViewItemSystemDefinedList(
  dbItem: RemoteSystemDefinedListDbItem,
  label: string,
  tooltip: string,
): DbTreeViewItem {
  return new DbTreeViewItem(
    dbItem,
    new ThemeIcon("github"),
    label,
    tooltip,
    TreeItemCollapsibleState.None,
    [],
  );
}

export function createDbTreeViewItemUserDefinedList(
  dbItem: RemoteUserDefinedListDbItem,
  listName: string,
  children: DbTreeViewItem[],
): DbTreeViewItem {
  return new DbTreeViewItem(
    dbItem,
    undefined,
    listName,
    undefined,
    getCollapsibleState(dbItem.expanded),
    children,
  );
}

export function createDbTreeViewItemOwner(
  dbItem: RemoteOwnerDbItem,
  ownerName: string,
): DbTreeViewItem {
  return new DbTreeViewItem(
    dbItem,
    new ThemeIcon("organization"),
    ownerName,
    undefined,
    TreeItemCollapsibleState.None,
    [],
  );
}

export function createDbTreeViewItemRepo(
  dbItem: RemoteRepoDbItem,
  repoName: string,
): DbTreeViewItem {
  return new DbTreeViewItem(
    dbItem,
    new ThemeIcon("cloud"),
    repoName,
    undefined,
    TreeItemCollapsibleState.None,
    [],
  );
}

function getCollapsibleState(expanded: boolean): TreeItemCollapsibleState {
  return expanded
    ? TreeItemCollapsibleState.Expanded
    : TreeItemCollapsibleState.Collapsed;
}
