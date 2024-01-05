import { faker } from "@faker-js/faker";
import type {
  RemoteDbItem,
  RemoteOwnerDbItem,
  RemoteRepoDbItem,
  RemoteSystemDefinedListDbItem,
  RemoteUserDefinedListDbItem,
  RootRemoteDbItem,
} from "../../src/databases/db-item";
import { DbItemKind } from "../../src/databases/db-item";

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
