import * as fs from 'fs-extra';
import * as path from 'path';
import { cloneDbConfig, DbConfig } from './db-config';
import * as chokidar from 'chokidar';

export class DbConfigStore {
  private readonly configPath: string;

  private config: DbConfig;

  public constructor(workspaceStoragePath: string) {
    this.configPath = path.join(workspaceStoragePath, 'dbconfig.json');

    this.config = this.createEmptyConfig();
  }

  public async initialize(): Promise<void> {
    await this.loadConfig();
    this.watchConfig();
  }

  public getConfig(): DbConfig {
    // Clone the config so that it's not modified outside of this class.
    return cloneDbConfig(this.config);
  }

  private async loadConfig(): Promise<void> {
    if (!await fs.pathExists(this.configPath)) {
      await fs.writeJSON(this.configPath, this.createEmptyConfig(), { spaces: 2 });
    }

    await this.readConfig();
  }

  private async readConfig(): Promise<void> {
    this.config = await fs.readJSON(this.configPath);
  }

  private watchConfig(): void {
    chokidar.watch(this.configPath).on('change', async () => {
      await this.readConfig();
    });
  }

  private createEmptyConfig(): DbConfig {
    return {
      remote: {
        repositoryLists: [],
        owners: [],
        repositories: [],
      }
    };
  }
}
