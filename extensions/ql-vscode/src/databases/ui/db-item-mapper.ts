import { DbItem, DbItemKind } from '../db-item';
import {
  createDbTreeViewItemOwner,
  createDbTreeViewItemRepo,
  createDbTreeViewItemRoot,
  createDbTreeViewItemSystemDefinedList,
  createDbTreeViewItemUserDefinedList,
  DbTreeViewItem
} from './db-tree-view-item';

export function mapDbItemToTreeViewItem(dbItem: DbItem): DbTreeViewItem {
  switch (dbItem.kind) {
    case DbItemKind.RootLocal:
      return createDbTreeViewItemRoot(
        dbItem,
        'local',
        'Local databases',
        []);

    case DbItemKind.RootRemote:
      return createDbTreeViewItemRoot(
        dbItem,
        'remote',
        'Remote databases',
        dbItem.children.map(c => mapDbItemToTreeViewItem(c)));

    case DbItemKind.RemoteSystemDefinedList:
      return createDbTreeViewItemSystemDefinedList(
        dbItem,
        dbItem.listDisplayName,
        dbItem.listDescription);

    case DbItemKind.RemoteUserDefinedList:
      return createDbTreeViewItemUserDefinedList(
        dbItem,
        dbItem.listName,
        dbItem.repos.map(mapDbItemToTreeViewItem));

    case DbItemKind.RemoteOwner:
      return createDbTreeViewItemOwner(
        dbItem,
        dbItem.ownerName);

    case DbItemKind.RemoteRepo:
      return createDbTreeViewItemRepo(
        dbItem,
        dbItem.repoFullName);
  }
}
