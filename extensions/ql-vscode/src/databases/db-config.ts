// Contains models for the data we want to store in the database config

export interface DbConfig {
  remote: RemoteDbConfig;
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

export function cloneDbConfig(config: DbConfig): DbConfig {
  return {
    remote: {
      repositoryLists: config.remote.repositoryLists.map((list) => ({
        name: list.name,
        repositories: list.repositories.slice(),
      })),
      owners: [...config.remote.owners],
      repositories: [...config.remote.repositories],
    }
  };
}
