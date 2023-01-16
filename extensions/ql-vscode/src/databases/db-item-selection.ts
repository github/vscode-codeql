import { DbItem, DbItemKind, LocalDbItem, RemoteDbItem } from "./db-item";
import { SelectedDbItem, SelectedDbItemKind } from "./config/db-config";

export function getSelectedDbItem(dbItems: DbItem[]): DbItem | undefined {
  for (const dbItem of dbItems) {
    if (
      dbItem.kind === DbItemKind.RootRemote ||
      dbItem.kind === DbItemKind.RootLocal
    ) {
      for (const child of dbItem.children) {
        const selectedItem = extractSelected(child);
        if (selectedItem) return selectedItem;
      }
    } else {
      const selectedItem = extractSelected(dbItem);
      if (selectedItem) return selectedItem;
    }
  }
  return undefined;
}

function extractSelected(
  dbItem: RemoteDbItem | LocalDbItem,
): DbItem | undefined {
  if (dbItem.selected) {
    return dbItem;
  }
  switch (dbItem.kind) {
    case DbItemKind.LocalList:
      for (const database of dbItem.databases) {
        if (database.selected) {
          return database;
        }
      }
      break;
    case DbItemKind.VariantAnalysisUserDefinedList:
      for (const repo of dbItem.repos) {
        if (repo.selected) {
          return repo;
        }
      }
      break;
  }
  return undefined;
}

export function mapDbItemToSelectedDbItem(
  dbItem: DbItem,
): SelectedDbItem | undefined {
  switch (dbItem.kind) {
    case DbItemKind.RootLocal:
    case DbItemKind.RootRemote:
      // Root items are not selectable.
      return undefined;

    case DbItemKind.LocalList:
      return {
        kind: SelectedDbItemKind.LocalUserDefinedList,
        listName: dbItem.listName,
      };

    case DbItemKind.VariantAnalysisUserDefinedList:
      return {
        kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
        listName: dbItem.listName,
      };

    case DbItemKind.RemoteSystemDefinedList:
      return {
        kind: SelectedDbItemKind.VariantAnalysisSystemDefinedList,
        listName: dbItem.listName,
      };

    case DbItemKind.RemoteOwner:
      return {
        kind: SelectedDbItemKind.VariantAnalysisOwner,
        ownerName: dbItem.ownerName,
      };

    case DbItemKind.LocalDatabase:
      return {
        kind: SelectedDbItemKind.LocalDatabase,
        databaseName: dbItem.databaseName,
        listName: dbItem?.parentListName,
      };

    case DbItemKind.RemoteRepo:
      return {
        kind: SelectedDbItemKind.VariantAnalysisRepository,
        repositoryName: dbItem.repoFullName,
        listName: dbItem?.parentListName,
      };
  }
}
