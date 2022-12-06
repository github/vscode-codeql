import { DbItem, DbItemKind, LocalDbItem, RemoteDbItem } from "./db-item";

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
