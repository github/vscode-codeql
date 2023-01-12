import { DbItem, DbItemKind } from "../db-item";
import {
  createDbTreeViewItemLocalDatabase,
  createDbTreeViewItemOwner,
  createDbTreeViewItemRepo,
  createDbTreeViewItemRoot,
  createDbTreeViewItemSystemDefinedList,
  createDbTreeViewItemUserDefinedList,
  DbTreeViewItem,
} from "./db-tree-view-item";

export function mapDbItemToTreeViewItem(dbItem: DbItem): DbTreeViewItem {
  switch (dbItem.kind) {
    case DbItemKind.RootLocal:
      return createDbTreeViewItemRoot(
        dbItem,
        "local",
        "Local databases",
        dbItem.children.map((c) => mapDbItemToTreeViewItem(c)),
      );

    case DbItemKind.RootRemote:
      return createDbTreeViewItemRoot(
        dbItem,
        "remote",
        "Remote databases",
        dbItem.children.map((c) => mapDbItemToTreeViewItem(c)),
      );

    case DbItemKind.RemoteSystemDefinedList:
      return createDbTreeViewItemSystemDefinedList(
        dbItem,
        dbItem.listDisplayName,
        dbItem.listDescription,
      );

    case DbItemKind.VariantAnalysisUserDefinedList:
      return createDbTreeViewItemUserDefinedList(
        dbItem,
        dbItem.listName,
        dbItem.repos.map(mapDbItemToTreeViewItem),
      );

    case DbItemKind.RemoteOwner:
      return createDbTreeViewItemOwner(dbItem, dbItem.ownerName);

    case DbItemKind.RemoteRepo:
      return createDbTreeViewItemRepo(dbItem, dbItem.repoFullName);

    case DbItemKind.LocalList:
      return createDbTreeViewItemUserDefinedList(
        dbItem,
        dbItem.listName,
        dbItem.databases.map(mapDbItemToTreeViewItem),
      );

    case DbItemKind.LocalDatabase:
      return createDbTreeViewItemLocalDatabase(
        dbItem,
        dbItem.databaseName,
        dbItem.language,
      );
  }
}
