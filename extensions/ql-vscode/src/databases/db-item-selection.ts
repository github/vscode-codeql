import { DbItem, DbItemKind, LocalDbItem, RemoteDbItem } from "./db-item";
import {
  SelectedDbItem,
  SelectedDbItemKind,
  SelectedLocalDatabase,
  SelectedLocalUserDefinedList,
  SelectedRemoteOwner,
  SelectedRemoteRepository,
} from "./config/db-config";

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
    case DbItemKind.RemoteUserDefinedList:
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

    case DbItemKind.RemoteUserDefinedList:
      return {
        kind: SelectedDbItemKind.RemoteUserDefinedList,
        listName: dbItem.listName,
      };

    case DbItemKind.RemoteSystemDefinedList:
      return {
        kind: SelectedDbItemKind.RemoteSystemDefinedList,
        listName: dbItem.listName,
      };

    case DbItemKind.RemoteOwner:
      return {
        kind: SelectedDbItemKind.RemoteOwner,
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
        kind: SelectedDbItemKind.RemoteRepository,
        repositoryName: dbItem.repoFullName,
        listName: dbItem?.parentListName,
      };
  }
}

export function compareSelectedKindIsEqual(
  item1: SelectedDbItem,
  item2: SelectedDbItem,
): boolean {
  if (item1.kind === item2.kind) {
    switch (item1.kind) {
      case SelectedDbItemKind.LocalUserDefinedList:
      case SelectedDbItemKind.RemoteUserDefinedList:
      case SelectedDbItemKind.RemoteSystemDefinedList:
        return (
          item1.listName === (item2 as SelectedLocalUserDefinedList).listName
        );
      case SelectedDbItemKind.RemoteOwner:
        return item1.ownerName === (item2 as SelectedRemoteOwner).ownerName;
      case SelectedDbItemKind.LocalDatabase: {
        const selectedItem = item2 as SelectedLocalDatabase;
        return (
          item1.databaseName === selectedItem.databaseName &&
          item1.listName === selectedItem.listName
        );
      }
      case SelectedDbItemKind.RemoteRepository: {
        const selectedItem = item2 as SelectedRemoteRepository;
        return (
          item1.repositoryName === selectedItem.repositoryName &&
          item1.listName === selectedItem.listName
        );
      }
      default:
        return false;
    }
  } else {
    return false;
  }
}
