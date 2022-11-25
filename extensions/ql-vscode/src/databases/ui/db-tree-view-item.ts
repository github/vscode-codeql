import * as vscode from "vscode";
import {
  DbItem,
  LocalDatabaseDbItem,
  LocalListDbItem,
  RemoteOwnerDbItem,
  RemoteRepoDbItem,
  RemoteSystemDefinedListDbItem,
  RemoteUserDefinedListDbItem,
  RootLocalDbItem,
  RootRemoteDbItem,
} from "../db-item";

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
    vscode.TreeItemCollapsibleState.Collapsed,
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
    vscode.TreeItemCollapsibleState.Collapsed,
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
