import {
  DbItemKind,
  LocalDatabaseDbItem,
  LocalListDbItem,
  RemoteOwnerDbItem,
  RemoteRepoDbItem,
  RemoteSystemDefinedListDbItem,
  RemoteUserDefinedListDbItem,
  RootLocalDbItem,
  RootRemoteDbItem,
} from "../../src/databases/db-item";

// Root Remote Db Items
export function createRootRemoteDbItem({
  children = [],
  expanded = false,
}: {
  children?: Array<
    | RemoteOwnerDbItem
    | RemoteSystemDefinedListDbItem
    | RemoteUserDefinedListDbItem
  >;
  expanded?: boolean;
}): RootRemoteDbItem {
  return {
    kind: DbItemKind.RootRemote,
    children,
    expanded,
  };
}

export function createRemoteOwnerDbItem({
  ownerName = `owner${getRandomInt()}`,
  selected = false,
}: {
  ownerName?: string;
  selected?: boolean;
}): RemoteOwnerDbItem {
  return {
    kind: DbItemKind.RemoteOwner,
    selected,
    ownerName,
  };
}

export function createRemoteRepoDbItem({
  repoFullName = `repoFullName${getRandomInt()}`,
  selected = false,
  parentListName = undefined,
}: {
  repoFullName?: string;
  selected?: boolean;
  parentListName?: string;
}): RemoteRepoDbItem {
  return {
    kind: DbItemKind.RemoteRepo,
    selected,
    repoFullName,
    parentListName,
  };
}

export function createRemoteSystemDefinedListDbItem({
  listName = `top_${getRandomInt()}`,
  listDisplayName = `Display Name`,
  listDescription = `Description`,
  selected = false,
}: {
  listName?: string;
  listDisplayName?: string;
  listDescription?: string;
  selected?: boolean;
}): RemoteSystemDefinedListDbItem {
  return {
    kind: DbItemKind.RemoteSystemDefinedList,
    selected,
    listName,
    listDisplayName,
    listDescription,
  };
}

export function createRemoteUserDefinedListDbItem({
  expanded = false,
  selected = false,
  listName = `list${getRandomInt()}`,
  repos = [
    createRemoteRepoDbItem({
      parentListName: listName,
    }),
  ],
}: {
  listName?: string;
  expanded?: boolean;
  selected?: boolean;
  repos?: RemoteRepoDbItem[];
}): RemoteUserDefinedListDbItem {
  return {
    kind: DbItemKind.RemoteUserDefinedList,
    expanded,
    selected,
    listName,
    repos,
  };
}

// Root Local Db Items
export function createRootLocalDbItem({
  children = [],
  expanded = false,
}: {
  children?: Array<LocalDatabaseDbItem | LocalListDbItem>;
  expanded?: boolean;
}): RootLocalDbItem {
  return {
    kind: DbItemKind.RootLocal,
    children,
    expanded,
  };
}

export function createLocalDatabaseDbItem({
  databaseName = `database${getRandomInt()}`,
  dateAdded = getRandomInt(),
  language = `language${getRandomInt()}`,
  storagePath = `storagePath${getRandomInt()}`,
  selected = false,
}: {
  databaseName?: string;
  dateAdded?: number;
  language?: string;
  storagePath?: string;
  selected?: boolean;
}): LocalDatabaseDbItem {
  return {
    kind: DbItemKind.LocalDatabase,
    selected,
    databaseName,
    dateAdded,
    language,
    storagePath,
  };
}

export function createLocalListDbItem({
  listName = `top_${getRandomInt()}`,
  selected = false,
  expanded = false,
  databases = [],
}: {
  listName?: string;
  databases?: LocalDatabaseDbItem[];
  selected?: boolean;
  expanded?: boolean;
}): LocalListDbItem {
  return {
    kind: DbItemKind.LocalList,
    selected,
    expanded,
    databases,
    listName,
  };
}

function getRandomInt() {
  return Math.floor(Math.random() * 100);
}
