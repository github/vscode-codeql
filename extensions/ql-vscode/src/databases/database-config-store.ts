import * as fs from 'fs-extra';
import * as path from 'path';
import { cloneDatabaseConfig, DatabaseConfig } from './database-config';

export class DatabaseConfigStore {
  private readonly configPath: string;

  private config: DatabaseConfig;

  public constructor(workspaceStoragePath: string) {
    this.configPath = path.join(workspaceStoragePath, 'dbconfig.json');

    this.config = emptyConfig;
  }

  public async initialize(): Promise<void> {
    await this.loadConfig();
  }

  public getConfig(): DatabaseConfig {
    // Clone the config so that it's not modified outside of this class.
    return cloneDatabaseConfig(this.config);
  }

  private async loadConfig(): Promise<void> {
    if (!await fs.pathExists(this.configPath)) {
      await fs.createFile(this.configPath);
      await fs.writeJSON(this.configPath, emptyConfig, { spaces: 2 });
    }

    await this.readConfig();
  }

  private async readConfig(): Promise<void> {
    this.config = await fs.readJSON(this.configPath);
  }
}

const emptyConfig: DatabaseConfig = {
  remote: {
    repositoryLists: [],
    owners: [],
    repositories: [],
  }
};
