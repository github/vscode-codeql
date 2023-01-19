// This file contains models that are used to represent the databases.

export enum DbItemKind {
  RootLocal = "RootLocal",
  LocalList = "LocalList",
  LocalDatabase = "LocalDatabase",
  RootRemote = "RootRemote",
  RemoteSystemDefinedList = "RemoteSystemDefinedList",
  RemoteUserDefinedList = "RemoteUserDefinedList",
  RemoteOwner = "RemoteOwner",
  RemoteRepo = "RemoteRepo",
}

export const remoteDbKinds = [
  DbItemKind.RootRemote,
  DbItemKind.RemoteSystemDefinedList,
  DbItemKind.RemoteUserDefinedList,
  DbItemKind.RemoteOwner,
  DbItemKind.RemoteRepo,
];

export const localDbKinds = [
  DbItemKind.RootLocal,
  DbItemKind.LocalList,
  DbItemKind.LocalDatabase,
];

export enum DbListKind {
  Local = "Local",
  Remote = "Remote",
}

export interface RootLocalDbItem {
  kind: DbItemKind.RootLocal;
  expanded: boolean;
  children: LocalDbItem[];
}

export type LocalDbItem = LocalListDbItem | LocalDatabaseDbItem;

export interface LocalListDbItem {
  kind: DbItemKind.LocalList;
  expanded: boolean;
  selected: boolean;
  listName: string;
  databases: LocalDatabaseDbItem[];
}

export interface LocalDatabaseDbItem {
  kind: DbItemKind.LocalDatabase;
  selected: boolean;
  databaseName: string;
  dateAdded: number;
  language: string;
  storagePath: string;
  parentListName?: string;
}

export interface RootRemoteDbItem {
  kind: DbItemKind.RootRemote;
  expanded: boolean;
  children: RemoteDbItem[];
}

export type DbItem =
  | RootLocalDbItem
  | RootRemoteDbItem
  | RemoteDbItem
  | LocalDbItem;

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

export function isRemoteSystemDefinedListDbItem(
  dbItem: DbItem,
): dbItem is RemoteSystemDefinedListDbItem {
  return dbItem.kind === DbItemKind.RemoteSystemDefinedList;
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

export function isLocalListDbItem(dbItem: DbItem): dbItem is LocalListDbItem {
  return dbItem.kind === DbItemKind.LocalList;
}

export function isLocalDatabaseDbItem(
  dbItem: DbItem,
): dbItem is LocalDatabaseDbItem {
  return dbItem.kind === DbItemKind.LocalDatabase;
}

export type SelectableDbItem = RemoteDbItem | LocalDbItem;

export function isSelectableDbItem(dbItem: DbItem): dbItem is SelectableDbItem {
  return SelectableDbItemKinds.includes(dbItem.kind);
}

const SelectableDbItemKinds = [
  DbItemKind.LocalList,
  DbItemKind.LocalDatabase,
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
      case DbItemKind.RootLocal:
        allItems.push(...flattenDbItems(dbItem.children));
        break;
      case DbItemKind.LocalList:
        allItems.push(...flattenDbItems(dbItem.databases));
        break;
      case DbItemKind.RootRemote:
        allItems.push(...flattenDbItems(dbItem.children));
        break;
      case DbItemKind.RemoteUserDefinedList:
        allItems.push(...dbItem.repos);
        break;
      case DbItemKind.LocalDatabase:
      case DbItemKind.RemoteSystemDefinedList:
      case DbItemKind.RemoteOwner:
      case DbItemKind.RemoteRepo:
        break;
    }
  }

  return allItems;
}
