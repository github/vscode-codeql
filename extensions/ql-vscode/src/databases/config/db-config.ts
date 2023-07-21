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
  local: LocalDbConfig;
}

export type SelectedDbItem =
  | SelectedLocalUserDefinedList
  | SelectedLocalDatabase
  | SelectedRemoteSystemDefinedList
  | SelectedVariantAnalysisUserDefinedList
  | SelectedRemoteOwner
  | SelectedRemoteRepository;

export enum SelectedDbItemKind {
  LocalUserDefinedList = "localUserDefinedList",
  LocalDatabase = "localDatabase",
  VariantAnalysisSystemDefinedList = "variantAnalysisSystemDefinedList",
  VariantAnalysisUserDefinedList = "variantAnalysisUserDefinedList",
  VariantAnalysisOwner = "variantAnalysisOwner",
  VariantAnalysisRepository = "variantAnalysisRepository",
}

interface SelectedLocalUserDefinedList {
  kind: SelectedDbItemKind.LocalUserDefinedList;
  listName: string;
}

interface SelectedLocalDatabase {
  kind: SelectedDbItemKind.LocalDatabase;
  databaseName: string;
  listName?: string;
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

interface LocalDbConfig {
  lists: LocalList[];
  databases: LocalDatabase[];
}

export interface LocalList {
  name: string;
  databases: LocalDatabase[];
}

export interface LocalDatabase {
  name: string;
  dateAdded: number;
  language: string;
  storagePath: string;
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
      local: {
        lists: config.databases.local.lists.map((list) => ({
          name: list.name,
          databases: list.databases.map((db) => ({ ...db })),
        })),
        databases: config.databases.local.databases.map((db) => ({ ...db })),
      },
    },
    selected: config.selected
      ? cloneDbConfigSelectedItem(config.selected)
      : undefined,
  };
}

export function renameLocalList(
  originalConfig: DbConfig,
  currentListName: string,
  newListName: string,
): DbConfig {
  const config = cloneDbConfig(originalConfig);

  const list = getLocalList(config, currentListName);
  list.name = newListName;

  if (
    config.selected?.kind === SelectedDbItemKind.LocalUserDefinedList ||
    config.selected?.kind === SelectedDbItemKind.LocalDatabase
  ) {
    if (config.selected.listName === currentListName) {
      config.selected.listName = newListName;
    }
  }

  return config;
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

export function renameLocalDb(
  originalConfig: DbConfig,
  currentDbName: string,
  newDbName: string,
  parentListName?: string,
): DbConfig {
  const config = cloneDbConfig(originalConfig);

  if (parentListName) {
    const list = getLocalList(config, parentListName);
    const dbIndex = list.databases.findIndex((db) => db.name === currentDbName);
    if (dbIndex === -1) {
      throw Error(
        `Cannot find database '${currentDbName}' in list '${parentListName}'`,
      );
    }
    list.databases[dbIndex].name = newDbName;
  } else {
    const dbIndex = config.databases.local.databases.findIndex(
      (db) => db.name === currentDbName,
    );
    if (dbIndex === -1) {
      throw Error(`Cannot find database '${currentDbName}' in local databases`);
    }
    config.databases.local.databases[dbIndex].name = newDbName;
  }

  if (
    config.selected?.kind === SelectedDbItemKind.LocalDatabase &&
    config.selected.databaseName === currentDbName
  ) {
    config.selected.databaseName = newDbName;
  }

  return config;
}

export function removeLocalList(
  originalConfig: DbConfig,
  listName: string,
): DbConfig {
  const config = cloneDbConfig(originalConfig);

  config.databases.local.lists = config.databases.local.lists.filter(
    (list) => list.name !== listName,
  );

  if (config.selected?.kind === SelectedDbItemKind.LocalUserDefinedList) {
    config.selected = undefined;
  }

  if (
    config.selected?.kind === SelectedDbItemKind.LocalDatabase &&
    config.selected?.listName === listName
  ) {
    config.selected = undefined;
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

export function removeLocalDb(
  originalConfig: DbConfig,
  databaseName: string,
  parentListName?: string,
): DbConfig {
  const config = cloneDbConfig(originalConfig);

  if (parentListName) {
    const parentList = getLocalList(config, parentListName);
    parentList.databases = parentList.databases.filter(
      (db) => db.name !== databaseName,
    );
  } else {
    config.databases.local.databases = config.databases.local.databases.filter(
      (db) => db.name !== databaseName,
    );
  }

  if (
    config.selected?.kind === SelectedDbItemKind.LocalDatabase &&
    config.selected?.databaseName === databaseName &&
    config.selected?.listName === parentListName
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

/**
 * Removes local db config from a db config object, if one is set.
 * We do this because we don't want to expose this feature to users
 * yet (since it's only partially implemented), but we also don't want
 * to remove all the code we've already implemented.
 * @param config The config object to change.
 * @returns Any removed local db config.
 */
export function clearLocalDbConfig(
  config: DbConfig,
): LocalDbConfig | undefined {
  let localDbs = undefined;

  if (config && config.databases && config.databases.local) {
    localDbs = config.databases.local;
    delete (config.databases as any).local;
  }

  return localDbs;
}

/**
 * Initializes the local db config, if the config object contains
 * database configuration.
 * @param config The config object to change.
 */
export function initializeLocalDbConfig(config: DbConfig): void {
  if (config.databases) {
    config.databases.local = { lists: [], databases: [] };
  }
}

function cloneDbConfigSelectedItem(selected: SelectedDbItem): SelectedDbItem {
  switch (selected.kind) {
    case SelectedDbItemKind.LocalUserDefinedList:
      return {
        kind: SelectedDbItemKind.LocalUserDefinedList,
        listName: selected.listName,
      };
    case SelectedDbItemKind.LocalDatabase:
      return {
        kind: SelectedDbItemKind.LocalDatabase,
        databaseName: selected.databaseName,
        listName: selected.listName,
      };
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

function getLocalList(config: DbConfig, listName: string): LocalList {
  const list = config.databases.local.lists.find((l) => l.name === listName);

  if (!list) {
    throw Error(`Cannot find local list '${listName}'`);
  }

  return list;
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
