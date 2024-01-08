import type { DbItem, RemoteDbItem } from "./db-item";
import { DbItemKind } from "./db-item";
import type { SelectedDbItem } from "./config/db-config";
import { SelectedDbItemKind } from "./config/db-config";

export function getSelectedDbItem(dbItems: DbItem[]): DbItem | undefined {
  for (const dbItem of dbItems) {
    if (dbItem.kind === DbItemKind.RootRemote) {
      for (const child of dbItem.children) {
        const selectedItem = extractSelected(child);
        if (selectedItem) {
          return selectedItem;
        }
      }
    } else {
      const selectedItem = extractSelected(dbItem);
      if (selectedItem) {
        return selectedItem;
      }
    }
  }
  return undefined;
}

function extractSelected(dbItem: RemoteDbItem): DbItem | undefined {
  if (dbItem.selected) {
    return dbItem;
  }
  switch (dbItem.kind) {
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
    case DbItemKind.RootRemote:
      // Root items are not selectable.
      return undefined;

    case DbItemKind.RemoteUserDefinedList:
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

    case DbItemKind.RemoteRepo:
      return {
        kind: SelectedDbItemKind.VariantAnalysisRepository,
        repositoryName: dbItem.repoFullName,
        listName: dbItem?.parentListName,
      };
  }
}
