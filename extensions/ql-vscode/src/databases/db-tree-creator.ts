import {
  DbConfig,
  ExpandedDbItemKind,
  LocalDatabase,
  LocalList,
  RemoteRepositoryList,
  SelectedDbItemKind,
} from "./config/db-config";
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
} from "./db-item";

export function createRemoteTree(dbConfig: DbConfig): RootRemoteDbItem {
  const systemDefinedLists = [
    createSystemDefinedList(10, dbConfig),
    createSystemDefinedList(100, dbConfig),
    createSystemDefinedList(1000, dbConfig),
  ];

  const userDefinedRepoLists = dbConfig.databases.remote.repositoryLists.map(
    (r) => createRemoteUserDefinedList(r, dbConfig),
  );
  const owners = dbConfig.databases.remote.owners.map((o) =>
    createOwnerItem(o, dbConfig),
  );
  const repos = dbConfig.databases.remote.repositories.map((r) =>
    createRepoItem(r, dbConfig),
  );

  const expanded =
    dbConfig.expanded &&
    dbConfig.expanded.some((e) => e.kind === ExpandedDbItemKind.RootRemote);

  return {
    kind: DbItemKind.RootRemote,
    children: [
      ...systemDefinedLists,
      ...owners,
      ...userDefinedRepoLists,
      ...repos,
    ],
    expanded: !!expanded,
  };
}

export function createLocalTree(dbConfig: DbConfig): RootLocalDbItem {
  const localLists = dbConfig.databases.local.lists.map((l) =>
    createLocalList(l, dbConfig),
  );
  const localDbs = dbConfig.databases.local.databases.map((l) =>
    createLocalDb(l, dbConfig),
  );

  const expanded =
    dbConfig.expanded &&
    dbConfig.expanded.some((e) => e.kind === ExpandedDbItemKind.RootLocal);

  return {
    kind: DbItemKind.RootLocal,
    children: [...localLists, ...localDbs],
    expanded: !!expanded,
  };
}

function createSystemDefinedList(
  n: number,
  dbConfig: DbConfig,
): RemoteSystemDefinedListDbItem {
  const listName = `top_${n}`;

  const selected =
    dbConfig.selected &&
    dbConfig.selected.kind === SelectedDbItemKind.RemoteSystemDefinedList &&
    dbConfig.selected.listName === listName;

  return {
    kind: DbItemKind.RemoteSystemDefinedList,
    listName,
    listDisplayName: `Top ${n} repositories`,
    listDescription: `Top ${n} repositories of a language`,
    selected: !!selected,
  };
}

function createRemoteUserDefinedList(
  list: RemoteRepositoryList,
  dbConfig: DbConfig,
): RemoteUserDefinedListDbItem {
  const selected =
    dbConfig.selected &&
    dbConfig.selected.kind === SelectedDbItemKind.RemoteUserDefinedList &&
    dbConfig.selected.listName === list.name;

  const expanded =
    dbConfig.expanded &&
    dbConfig.expanded.some(
      (e) =>
        e.kind === ExpandedDbItemKind.RemoteUserDefinedList &&
        e.listName === list.name,
    );

  return {
    kind: DbItemKind.RemoteUserDefinedList,
    listName: list.name,
    repos: list.repositories.map((r) => createRepoItem(r, dbConfig, list.name)),
    selected: !!selected,
    expanded: !!expanded,
  };
}

function createOwnerItem(owner: string, dbConfig: DbConfig): RemoteOwnerDbItem {
  const selected =
    dbConfig.selected &&
    dbConfig.selected.kind === SelectedDbItemKind.RemoteOwner &&
    dbConfig.selected.ownerName === owner;

  return {
    kind: DbItemKind.RemoteOwner,
    ownerName: owner,
    selected: !!selected,
  };
}

function createRepoItem(
  repo: string,
  dbConfig: DbConfig,
  listName?: string,
): RemoteRepoDbItem {
  const selected =
    dbConfig.selected &&
    dbConfig.selected.kind === SelectedDbItemKind.RemoteRepository &&
    dbConfig.selected.repositoryName === repo &&
    dbConfig.selected.listName === listName;

  return {
    kind: DbItemKind.RemoteRepo,
    repoFullName: repo,
    selected: !!selected,
    parentListName: listName,
  };
}

function createLocalList(list: LocalList, dbConfig: DbConfig): LocalListDbItem {
  const selected =
    dbConfig.selected &&
    dbConfig.selected.kind === SelectedDbItemKind.LocalUserDefinedList &&
    dbConfig.selected.listName === list.name;

  const expanded =
    dbConfig.expanded &&
    dbConfig.expanded.some(
      (e) =>
        e.kind === ExpandedDbItemKind.LocalUserDefinedList &&
        e.listName === list.name,
    );

  return {
    kind: DbItemKind.LocalList,
    listName: list.name,
    databases: list.databases.map((d) => createLocalDb(d, dbConfig, list.name)),
    selected: !!selected,
    expanded: !!expanded,
  };
}

function createLocalDb(
  db: LocalDatabase,
  dbConfig: DbConfig,
  listName?: string,
): LocalDatabaseDbItem {
  const selected =
    dbConfig.selected &&
    dbConfig.selected.kind === SelectedDbItemKind.LocalDatabase &&
    dbConfig.selected.databaseName === db.name &&
    dbConfig.selected.listName === listName;

  return {
    kind: DbItemKind.LocalDatabase,
    databaseName: db.name,
    dateAdded: db.dateAdded,
    language: db.language,
    storagePath: db.storagePath,
    selected: !!selected,
    parentListName: listName,
  };
}
