// Contains models and consts for the data we want to store in the database config.
// Changes to these models should be done carefully and account for backwards compatibility of data.

export const DB_CONFIG_VERSION = 1;

export interface DbConfig {
  version: number;
  databases: DbConfigDatabases;
  selected?: SelectedDbItem;
}

interface DbConfigDatabases {
  variantAnalysis: RemoteDbConfig;
}

export type SelectedDbItem =
  | SelectedRemoteSystemDefinedList
  | SelectedVariantAnalysisUserDefinedList
  | SelectedRemoteOwner
  | SelectedRemoteRepository;

export enum SelectedDbItemKind {
  VariantAnalysisSystemDefinedList = "variantAnalysisSystemDefinedList",
  VariantAnalysisUserDefinedList = "variantAnalysisUserDefinedList",
  VariantAnalysisOwner = "variantAnalysisOwner",
  VariantAnalysisRepository = "variantAnalysisRepository",
}

interface SelectedRemoteSystemDefinedList {
  kind: SelectedDbItemKind.VariantAnalysisSystemDefinedList;
  listName: string;
}

interface SelectedVariantAnalysisUserDefinedList {
  kind: SelectedDbItemKind.VariantAnalysisUserDefinedList;
  listName: string;
}

interface SelectedRemoteOwner {
  kind: SelectedDbItemKind.VariantAnalysisOwner;
  ownerName: string;
}

interface SelectedRemoteRepository {
  kind: SelectedDbItemKind.VariantAnalysisRepository;
  repositoryName: string;
  listName?: string;
}

interface RemoteDbConfig {
  repositoryLists: RemoteRepositoryList[];
  owners: string[];
  repositories: string[];
}

export interface RemoteRepositoryList {
  name: string;
  repositories: string[];
}

export function cloneDbConfig(config: DbConfig): DbConfig {
  return {
    version: config.version,
    databases: {
      variantAnalysis: {
        repositoryLists: config.databases.variantAnalysis.repositoryLists.map(
          (list) => ({
            name: list.name,
            repositories: [...list.repositories],
          }),
        ),
        owners: [...config.databases.variantAnalysis.owners],
        repositories: [...config.databases.variantAnalysis.repositories],
      },
    },
    selected: config.selected
      ? cloneDbConfigSelectedItem(config.selected)
      : undefined,
  };
}

export function renameRemoteList(
  originalConfig: DbConfig,
  currentListName: string,
  newListName: string,
): DbConfig {
  const config = cloneDbConfig(originalConfig);

  const list = getRemoteList(config, currentListName);
  list.name = newListName;

  if (
    config.selected?.kind ===
      SelectedDbItemKind.VariantAnalysisUserDefinedList ||
    config.selected?.kind === SelectedDbItemKind.VariantAnalysisRepository
  ) {
    if (config.selected.listName === currentListName) {
      config.selected.listName = newListName;
    }
  }

  return config;
}

export function removeRemoteList(
  originalConfig: DbConfig,
  listName: string,
): DbConfig {
  const config = cloneDbConfig(originalConfig);

  config.databases.variantAnalysis.repositoryLists =
    config.databases.variantAnalysis.repositoryLists.filter(
      (list) => list.name !== listName,
    );

  if (
    config.selected?.kind === SelectedDbItemKind.VariantAnalysisUserDefinedList
  ) {
    config.selected = undefined;
  }

  if (
    config.selected?.kind === SelectedDbItemKind.VariantAnalysisRepository &&
    config.selected?.listName === listName
  ) {
    config.selected = undefined;
  }

  return config;
}

export function removeRemoteRepo(
  originalConfig: DbConfig,
  repoFullName: string,
  parentListName?: string,
): DbConfig {
  const config = cloneDbConfig(originalConfig);

  if (parentListName) {
    const parentList = getRemoteList(config, parentListName);
    parentList.repositories = parentList.repositories.filter(
      (r) => r !== repoFullName,
    );
  } else {
    config.databases.variantAnalysis.repositories =
      config.databases.variantAnalysis.repositories.filter(
        (r) => r !== repoFullName,
      );
  }

  if (
    config.selected?.kind === SelectedDbItemKind.VariantAnalysisRepository &&
    config.selected?.repositoryName === repoFullName &&
    config.selected?.listName === parentListName
  ) {
    config.selected = undefined;
  }

  return config;
}

export function removeRemoteOwner(
  originalConfig: DbConfig,
  ownerName: string,
): DbConfig {
  const config = cloneDbConfig(originalConfig);

  config.databases.variantAnalysis.owners =
    config.databases.variantAnalysis.owners.filter((o) => o !== ownerName);

  if (
    config.selected?.kind === SelectedDbItemKind.VariantAnalysisOwner &&
    config.selected?.ownerName === ownerName
  ) {
    config.selected = undefined;
  }

  return config;
}

function cloneDbConfigSelectedItem(selected: SelectedDbItem): SelectedDbItem {
  switch (selected.kind) {
    case SelectedDbItemKind.VariantAnalysisSystemDefinedList:
      return {
        kind: SelectedDbItemKind.VariantAnalysisSystemDefinedList,
        listName: selected.listName,
      };
    case SelectedDbItemKind.VariantAnalysisUserDefinedList:
      return {
        kind: SelectedDbItemKind.VariantAnalysisUserDefinedList,
        listName: selected.listName,
      };
    case SelectedDbItemKind.VariantAnalysisOwner:
      return {
        kind: SelectedDbItemKind.VariantAnalysisOwner,
        ownerName: selected.ownerName,
      };
    case SelectedDbItemKind.VariantAnalysisRepository:
      return {
        kind: SelectedDbItemKind.VariantAnalysisRepository,
        repositoryName: selected.repositoryName,
        listName: selected.listName,
      };
  }
}

function getRemoteList(
  config: DbConfig,
  listName: string,
): RemoteRepositoryList {
  const list = config.databases.variantAnalysis.repositoryLists.find(
    (l) => l.name === listName,
  );

  if (!list) {
    throw Error(`Cannot find variant analysis list '${listName}'`);
  }

  return list;
}
