import * as vscode from "vscode";
import {
  DbItem,
  isSelectableDbItem,
  LocalDatabaseDbItem,
  LocalListDbItem,
  RemoteOwnerDbItem,
  RemoteRepoDbItem,
  RemoteSystemDefinedListDbItem,
  RemoteUserDefinedListDbItem,
  RootLocalDbItem,
  RootRemoteDbItem,
} from "../db-item";

export const SELECTED_DB_ITEM_RESOURCE_URI = "codeql://databases?selected=true";

/**
 * Represents an item in the database tree view. This item could be
 * representing an actual database item or a warning.
 */
export class DbTreeViewItem extends vscode.TreeItem {
  constructor(
    // iconPath and tooltip must have those names because
    // they are part of the vscode.TreeItem interface

    public readonly dbItem: DbItem | undefined,
    public readonly iconPath: vscode.ThemeIcon | undefined,
    public readonly label: string,
    public readonly tooltip: string | undefined,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly children: DbTreeViewItem[],
  ) {
    super(label, collapsibleState);

    if (dbItem && isSelectableDbItem(dbItem)) {
      if (dbItem.selected) {
        // Define the resource id to drive the UI to render this item as selected.
        this.resourceUri = vscode.Uri.parse(SELECTED_DB_ITEM_RESOURCE_URI);
      } else {
        // Define a context value to drive the UI to show an action to select the item.
        this.contextValue = "canBeSelected";
      }
    }
  }
}

export function createDbTreeViewItemError(
  label: string,
  tooltip: string,
): DbTreeViewItem {
  return new DbTreeViewItem(
    undefined,
    new vscode.ThemeIcon(
      "error",
      new vscode.ThemeColor("problemsErrorIcon.foreground"),
    ),
    label,
    tooltip,
    vscode.TreeItemCollapsibleState.None,
    [],
  );
}

export function createDbTreeViewItemRoot(
  dbItem: RootLocalDbItem | RootRemoteDbItem,
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
    new vscode.ThemeIcon("github"),
    label,
    tooltip,
    vscode.TreeItemCollapsibleState.None,
    [],
  );
}

export function createDbTreeViewItemUserDefinedList(
  dbItem: LocalListDbItem | RemoteUserDefinedListDbItem,
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
    new vscode.ThemeIcon("organization"),
    ownerName,
    undefined,
    vscode.TreeItemCollapsibleState.None,
    [],
  );
}

export function createDbTreeViewItemRepo(
  dbItem: RemoteRepoDbItem,
  repoName: string,
): DbTreeViewItem {
  return new DbTreeViewItem(
    dbItem,
    new vscode.ThemeIcon("database"),
    repoName,
    undefined,
    vscode.TreeItemCollapsibleState.None,
    [],
  );
}

export function createDbTreeViewItemLocalDatabase(
  dbItem: LocalDatabaseDbItem,
  databaseName: string,
  language: string,
): DbTreeViewItem {
  return new DbTreeViewItem(
    dbItem,
    new vscode.ThemeIcon("database"),
    databaseName,
    `Language: ${language}`,
    vscode.TreeItemCollapsibleState.None,
    [],
  );
}

function getCollapsibleState(
  expanded: boolean,
): vscode.TreeItemCollapsibleState {
  return expanded
    ? vscode.TreeItemCollapsibleState.Expanded
    : vscode.TreeItemCollapsibleState.Collapsed;
}
