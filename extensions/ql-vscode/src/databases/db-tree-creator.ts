import {
  DbConfig,
  LocalDatabase,
  LocalList,
  RemoteRepositoryList,
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
    createSystemDefinedList(10),
    createSystemDefinedList(100),
    createSystemDefinedList(1000),
  ];

  const userDefinedRepoLists = dbConfig.databases.remote.repositoryLists.map(
    createUserDefinedList,
  );
  const owners = dbConfig.databases.remote.owners.map(createOwnerItem);
  const repos = dbConfig.databases.remote.repositories.map(createRepoItem);

  return {
    kind: DbItemKind.RootRemote,
    children: [
      ...systemDefinedLists,
      ...owners,
      ...userDefinedRepoLists,
      ...repos,
    ],
  };
}

export function createLocalTree(dbConfig: DbConfig): RootLocalDbItem {
  const localLists = dbConfig.databases.local.lists.map(createLocalList);
  const localDbs = dbConfig.databases.local.databases.map(createLocalDb);

  return {
    kind: DbItemKind.RootLocal,
    children: [...localLists, ...localDbs],
  };
}

function createSystemDefinedList(n: number): RemoteSystemDefinedListDbItem {
  return {
    kind: DbItemKind.RemoteSystemDefinedList,
    listName: `top_${n}`,
    listDisplayName: `Top ${n} repositories`,
    listDescription: `Top ${n} repositories of a language`,
  };
}

function createUserDefinedList(
  list: RemoteRepositoryList,
): RemoteUserDefinedListDbItem {
  return {
    kind: DbItemKind.RemoteUserDefinedList,
    listName: list.name,
    repos: list.repositories.map((r) => createRepoItem(r)),
  };
}

function createOwnerItem(owner: string): RemoteOwnerDbItem {
  return {
    kind: DbItemKind.RemoteOwner,
    ownerName: owner,
  };
}

function createRepoItem(repo: string): RemoteRepoDbItem {
  return {
    kind: DbItemKind.RemoteRepo,
    repoFullName: repo,
  };
}

function createLocalList(list: LocalList): LocalListDbItem {
  return {
    kind: DbItemKind.LocalList,
    listName: list.name,
    databases: list.databases.map(createLocalDb),
  };
}

function createLocalDb(db: LocalDatabase): LocalDatabaseDbItem {
  return {
    kind: DbItemKind.LocalDatabase,
    databaseName: db.name,
    dateAdded: db.dateAdded,
    language: db.language,
    storagePath: db.storagePath,
  };
}
