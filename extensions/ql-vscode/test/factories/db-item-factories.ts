import { faker } from "@faker-js/faker";
import {
  DbItemKind,
  LocalDatabaseDbItem,
  LocalDbItem,
  LocalListDbItem,
  RemoteDbItem,
  RemoteOwnerDbItem,
  RemoteRepoDbItem,
  RemoteSystemDefinedListDbItem,
  RemoteUserDefinedListDbItem,
  RootLocalDbItem,
  RootRemoteDbItem,
} from "../../src/databases/db-item";
import { DatabaseSource } from "../../src/databases/local-databases/database-source";

// Root Remote Db Items
export function createRootRemoteDbItem({
  children = [],
  expanded = false,
}: {
  children?: RemoteDbItem[];
  expanded?: boolean;
} = {}): RootRemoteDbItem {
  return {
    kind: DbItemKind.RootRemote,
    children,
    expanded,
  };
}

export function createRemoteOwnerDbItem({
  ownerName = `owner${faker.number.int()}`,
  selected = false,
}: {
  ownerName?: string;
  selected?: boolean;
} = {}): RemoteOwnerDbItem {
  return {
    kind: DbItemKind.RemoteOwner,
    selected,
    ownerName,
  };
}

export function createRemoteRepoDbItem({
  repoFullName = `owner${faker.number.int()}/repo${faker.number.int()}`,
  selected = false,
  parentListName = undefined,
}: {
  repoFullName?: string;
  selected?: boolean;
  parentListName?: string;
} = {}): RemoteRepoDbItem {
  return {
    kind: DbItemKind.RemoteRepo,
    selected,
    repoFullName,
    parentListName,
  };
}

export function createRemoteSystemDefinedListDbItem({
  listName = `top_${faker.number.int()}`,
  listDisplayName = `Display Name`,
  listDescription = `Description`,
  selected = false,
}: {
  listName?: string;
  listDisplayName?: string;
  listDescription?: string;
  selected?: boolean;
} = {}): RemoteSystemDefinedListDbItem {
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
  listName = `list${faker.number.int()}`,
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
} = {}): RemoteUserDefinedListDbItem {
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
  children?: LocalDbItem[];
  expanded?: boolean;
} = {}): RootLocalDbItem {
  return {
    kind: DbItemKind.RootLocal,
    children,
    expanded,
  };
}

export function createLocalDatabaseDbItem({
  databaseName = `database${faker.number.int()}`,
  dateAdded = faker.date.past().getTime(),
  language = `language${faker.number.int()}`,
  storagePath = `storagePath${faker.number.int()}`,
  selected = false,
  source = {
    type: "folder",
  },
}: {
  databaseName?: string;
  dateAdded?: number;
  language?: string;
  storagePath?: string;
  selected?: boolean;
  source?: DatabaseSource;
} = {}): LocalDatabaseDbItem {
  return {
    kind: DbItemKind.LocalDatabase,
    selected,
    databaseName,
    dateAdded,
    language,
    storagePath,
    source,
  };
}

export function createLocalListDbItem({
  listName = `top_${faker.number.int()}`,
  selected = false,
  expanded = false,
  databases = [],
}: {
  listName?: string;
  databases?: LocalDatabaseDbItem[];
  selected?: boolean;
  expanded?: boolean;
} = {}): LocalListDbItem {
  return {
    kind: DbItemKind.LocalList,
    selected,
    expanded,
    databases,
    listName,
  };
}
