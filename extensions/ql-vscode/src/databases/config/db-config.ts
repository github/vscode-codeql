// Contains models for the data we want to store in the database config

export interface DbConfig {
  databases: DbConfigDatabases;
  selected?: SelectedDbItem;
}

export interface DbConfigDatabases {
  remote: RemoteDbConfig;
  local: LocalDbConfig;
}

export interface SelectedDbItem {
  kind: SelectedDbItemKind;
  value: string;
}

export enum SelectedDbItemKind {
  ConfigDefined = "configDefined",
  RemoteSystemDefinedList = "remoteSystemDefinedList",
}

export interface RemoteDbConfig {
  repositoryLists: RemoteRepositoryList[];
  owners: string[];
  repositories: string[];
}

export interface RemoteRepositoryList {
  name: string;
  repositories: string[];
}

export interface LocalDbConfig {
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
    databases: {
      remote: {
        repositoryLists: config.databases.remote.repositoryLists.map(
          (list) => ({
            name: list.name,
            repositories: [...list.repositories],
          }),
        ),
        owners: [...config.databases.remote.owners],
        repositories: [...config.databases.remote.repositories],
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
      ? {
          kind: config.selected.kind,
          value: config.selected.value,
        }
      : undefined,
  };
}
