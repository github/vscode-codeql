// This file contains models that are used to represent the databases.

export enum DbItemKind {
  RootLocal = 'RootLocal',
  RootRemote = 'RootRemote',
  RemoteSystemDefinedList = 'RemoteSystemDefinedList',
  RemoteUserDefinedList = 'RemoteUserDefinedList',
  RemoteOwner = 'RemoteOwner',
  RemoteRepo = 'RemoteRepo'
}

export interface RootLocalDbItem {
  kind: DbItemKind.RootLocal;
}

export interface RootRemoteDbItem {
  kind: DbItemKind.RootRemote;
  children: RemoteDbItem[];
}

export type DbItem =
  | RootLocalDbItem
  | RootRemoteDbItem
  | RemoteDbItem

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
