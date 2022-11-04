import { DbConfig, RemoteRepositoryList } from './db-config';
import {
  DbItemKind,
  RemoteOwnerDbItem,
  RemoteRepoDbItem,
  RemoteSystemDefinedListDbItem,
  RemoteUserDefinedListDbItem,
  RootLocalDbItem,
  RootRemoteDbItem
} from './db-item';

export function createRemoteTree(dbConfig: DbConfig): RootRemoteDbItem {
  const systemDefinedLists = [
    createSystemDefinedList(10),
    createSystemDefinedList(100),
    createSystemDefinedList(1000)
  ];

  const userDefinedRepoLists = dbConfig.remote.repositoryLists.map(createUserDefinedList);
  const owners = dbConfig.remote.owners.map(createOwnerItem);
  const repos = dbConfig.remote.repositories.map(createRepoItem);

  return {
    kind: DbItemKind.RootRemote,
    children: [
      ...systemDefinedLists,
      ...owners,
      ...userDefinedRepoLists,
      ...repos
    ]
  };
}

export function createLocalTree(): RootLocalDbItem {
  // This will be fleshed out further in the future.
  return {
    kind: DbItemKind.RootLocal
  };
}

function createSystemDefinedList(n: number): RemoteSystemDefinedListDbItem {
  return {
    kind: DbItemKind.RemoteSystemDefinedList,
    listName: `top_${n}`,
    listDisplayName: `Top ${n} repositories`,
    listDescription: `Top ${n} repositories of a language`
  };
}

function createUserDefinedList(list: RemoteRepositoryList): RemoteUserDefinedListDbItem {
  return {
    kind: DbItemKind.RemoteUserDefinedList,
    listName: list.name,
    repos: list.repositories.map((r) => createRepoItem(r))
  };
}

function createOwnerItem(owner: string): RemoteOwnerDbItem {
  return {
    kind: DbItemKind.RemoteOwner,
    ownerName: owner
  };
}

function createRepoItem(repo: string): RemoteRepoDbItem {
  return {
    kind: DbItemKind.RemoteRepo,
    repoFullName: repo
  };
}
