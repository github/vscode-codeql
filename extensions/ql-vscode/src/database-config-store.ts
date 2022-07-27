
import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from './logging';

export interface DatabaseConfig {
  remote: RemoteDatabaseConfig;

  // TODO: Consider local dbs.
}

export interface RemoteDatabaseConfig {
  repositoryLists: RemoteRepositoryList[];
  // TODO: Store owners and plain repos.
}

export interface RemoteRepositoryList {
  name: string;
  repositories: string[];
}


const emptyConfig: DatabaseConfig = {
  remote: {
    repositoryLists: []
  }
};

export class DatabaseConfigStore {
  private readonly configPath: string;

  private config: DatabaseConfig;

  public constructor(extensionContext: vscode.ExtensionContext) {
    const storagePath = extensionContext.storageUri?.fsPath || extensionContext.globalStorageUri.fsPath;
    this.configPath = path.join(storagePath, 'codeql.dbconfig.json');

    this.config = emptyConfig;
  }

  public async initialize(): Promise<void> {
    await this.loadConfig();
  }

  public getRemoteRepositoryLists(): RemoteRepositoryList[] {
    // TODO: Return a clone so it can't be edited.
    return this.config.remote.repositoryLists;
  }

  private async loadConfig(): Promise<void> {
    // Ensure there is a db config
    if (!await fs.pathExists(this.configPath)) {
      void logger.log('Database configuration does not exist so it will be created');

      // TODO: Add basic structure to config file to help users
      await fs.createFile(this.configPath);
    }

    // Read it
    await this.readConfig();

    // TODO: Also read from the file in repositoryListsPath?
  }

  private async readConfig(): Promise<void> {
    void logger.log('Reading database configuration');
    const dbConfig = await fs.readFile(this.configPath, 'utf8');
    if (dbConfig) {
      // TODO: Validate config and show error message if not valid.
      const dbConfigJson = JSON.parse(dbConfig);
      this.config = dbConfigJson;
    }
    else {
      this.config = emptyConfig;
    }
  }
}
