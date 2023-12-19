// This file contains models that are used to represent the databases.

export enum DbItemKind {
  RootRemote = "RootRemote",
  RemoteSystemDefinedList = "RemoteSystemDefinedList",
  RemoteUserDefinedList = "RemoteUserDefinedList",
  RemoteOwner = "RemoteOwner",
  RemoteRepo = "RemoteRepo",
}

export interface RootRemoteDbItem {
  kind: DbItemKind.RootRemote;
  expanded: boolean;
  children: RemoteDbItem[];
}

export type DbItem = RootRemoteDbItem | RemoteDbItem;

export type RemoteDbItem =
  | RemoteSystemDefinedListDbItem
  | RemoteUserDefinedListDbItem
  | RemoteOwnerDbItem
  | RemoteRepoDbItem;

export interface RemoteSystemDefinedListDbItem {
  kind: DbItemKind.RemoteSystemDefinedList;
  selected: boolean;
  listName: string;
  listDisplayName: string;
  listDescription: string;
}

export interface RemoteUserDefinedListDbItem {
  kind: DbItemKind.RemoteUserDefinedList;
  expanded: boolean;
  selected: boolean;
  listName: string;
  repos: RemoteRepoDbItem[];
}

export interface RemoteOwnerDbItem {
  kind: DbItemKind.RemoteOwner;
  selected: boolean;
  ownerName: string;
}

export interface RemoteRepoDbItem {
  kind: DbItemKind.RemoteRepo;
  selected: boolean;
  repoFullName: string;
  parentListName?: string;
}

export function isRemoteUserDefinedListDbItem(
  dbItem: DbItem,
): dbItem is RemoteUserDefinedListDbItem {
  return dbItem.kind === DbItemKind.RemoteUserDefinedList;
}

export function isRemoteOwnerDbItem(
  dbItem: DbItem,
): dbItem is RemoteOwnerDbItem {
  return dbItem.kind === DbItemKind.RemoteOwner;
}

export function isRemoteRepoDbItem(dbItem: DbItem): dbItem is RemoteRepoDbItem {
  return dbItem.kind === DbItemKind.RemoteRepo;
}

type SelectableDbItem = RemoteDbItem;

export function isSelectableDbItem(dbItem: DbItem): dbItem is SelectableDbItem {
  return SelectableDbItemKinds.includes(dbItem.kind);
}

const SelectableDbItemKinds = [
  DbItemKind.RemoteSystemDefinedList,
  DbItemKind.RemoteUserDefinedList,
  DbItemKind.RemoteOwner,
  DbItemKind.RemoteRepo,
];

export function flattenDbItems(dbItems: DbItem[]): DbItem[] {
  const allItems: DbItem[] = [];

  for (const dbItem of dbItems) {
    allItems.push(dbItem);
    switch (dbItem.kind) {
      case DbItemKind.RootRemote:
        allItems.push(...flattenDbItems(dbItem.children));
        break;
      case DbItemKind.RemoteUserDefinedList:
        allItems.push(...dbItem.repos);
        break;
      case DbItemKind.RemoteSystemDefinedList:
      case DbItemKind.RemoteOwner:
      case DbItemKind.RemoteRepo:
        break;
    }
  }

  return allItems;
}
