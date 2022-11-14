// Contains models for the data we want to store in the database config

export interface DbConfig {
  remote: RemoteDbConfig;
  local: LocalDbConfig;
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
    remote: {
      repositoryLists: config.remote.repositoryLists.map((list) => ({
        name: list.name,
        repositories: [...list.repositories],
      })),
      owners: [...config.remote.owners],
      repositories: [...config.remote.repositories],
    },
    local: {
      lists: config.local.lists.map((list) => ({
        name: list.name,
        databases: list.databases.map((db) => ({ ...db })),
      })),
      databases: config.local.databases.map((db) => ({ ...db })),
    },
  };
}
