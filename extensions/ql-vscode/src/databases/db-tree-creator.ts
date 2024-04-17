import type { VariantAnalysisConfig } from "../config";
import type { DbConfig, RemoteRepositoryList } from "./config/db-config";
import { SelectedDbItemKind } from "./config/db-config";
import type {
  RemoteOwnerDbItem,
  RemoteRepoDbItem,
  RemoteSystemDefinedListDbItem,
  RemoteUserDefinedListDbItem,
  RootRemoteDbItem,
} from "./db-item";
import { DbItemKind } from "./db-item";
import type { ExpandedDbItem } from "./db-item-expansion";
import { ExpandedDbItemKind } from "./db-item-expansion";

export function createRemoteTree(
  dbConfig: DbConfig,
  variantAnalysisConfig: VariantAnalysisConfig,
  expandedItems: ExpandedDbItem[],
): RootRemoteDbItem {
  const systemDefinedLists =
    variantAnalysisConfig.showSystemDefinedRepositoryLists
      ? [
          createSystemDefinedList(10, dbConfig),
          createSystemDefinedList(100, dbConfig),
          createSystemDefinedList(1000, dbConfig),
        ]
      : [];

  const userDefinedRepoLists =
    dbConfig.databases.variantAnalysis.repositoryLists.map((r) =>
      createVariantAnalysisUserDefinedList(r, dbConfig, expandedItems),
    );
  const owners = dbConfig.databases.variantAnalysis.owners.map((o) =>
    createOwnerItem(o, dbConfig),
  );
  const repos = dbConfig.databases.variantAnalysis.repositories.map((r) =>
    createRepoItem(r, dbConfig),
  );

  const expanded = expandedItems.some(
    (e) => e.kind === ExpandedDbItemKind.RootRemote,
  );

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

function createSystemDefinedList(
  n: number,
  dbConfig: DbConfig,
): RemoteSystemDefinedListDbItem {
  const listName = `top_${n}`;

  const selected =
    dbConfig.selected &&
    dbConfig.selected.kind ===
      SelectedDbItemKind.VariantAnalysisSystemDefinedList &&
    dbConfig.selected.listName === listName;

  return {
    kind: DbItemKind.RemoteSystemDefinedList,
    listName,
    listDisplayName: `Top ${n} repositories`,
    listDescription: `Top ${n} repositories of a language`,
    selected: !!selected,
  };
}

function createVariantAnalysisUserDefinedList(
  list: RemoteRepositoryList,
  dbConfig: DbConfig,
  expandedItems: ExpandedDbItem[],
): RemoteUserDefinedListDbItem {
  const selected =
    dbConfig.selected &&
    dbConfig.selected.kind ===
      SelectedDbItemKind.VariantAnalysisUserDefinedList &&
    dbConfig.selected.listName === list.name;

  const expanded = expandedItems.some(
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
    dbConfig.selected.kind === SelectedDbItemKind.VariantAnalysisOwner &&
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
    dbConfig.selected.kind === SelectedDbItemKind.VariantAnalysisRepository &&
    dbConfig.selected.repositoryName === repo &&
    dbConfig.selected.listName === listName;

  return {
    kind: DbItemKind.RemoteRepo,
    repoFullName: repo,
    selected: !!selected,
    parentListName: listName,
  };
}
