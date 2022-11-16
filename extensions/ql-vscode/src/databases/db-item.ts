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

export interface RootLocalDbItem {
  kind: DbItemKind.RootLocal;
  children: LocalDbItem[];
}

export type LocalDbItem = LocalListDbItem | LocalDatabaseDbItem;

export interface LocalListDbItem {
  kind: DbItemKind.LocalList;
  listName: string;
  databases: LocalDatabaseDbItem[];
}

export interface LocalDatabaseDbItem {
  kind: DbItemKind.LocalDatabase;
  databaseName: string;
  dateAdded: number;
  language: string;
  storagePath: string;
}

export interface RootRemoteDbItem {
  kind: DbItemKind.RootRemote;
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
  listName: string;
  listDisplayName: string;
  listDescription: string;
}

export interface RemoteUserDefinedListDbItem {
  kind: DbItemKind.RemoteUserDefinedList;
  listName: string;
  repos: RemoteRepoDbItem[];
}

export interface RemoteOwnerDbItem {
  kind: DbItemKind.RemoteOwner;
  ownerName: string;
}

export interface RemoteRepoDbItem {
  kind: DbItemKind.RemoteRepo;
  repoFullName: string;
}
