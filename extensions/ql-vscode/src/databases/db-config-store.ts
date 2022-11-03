import * as fs from 'fs-extra';
import * as path from 'path';
import { cloneDbConfig, DbConfig } from './db-config';
import * as chokidar from 'chokidar';
import { DisposableObject } from '../pure/disposable-object';

export class DbConfigStore extends DisposableObject {
  private readonly configPath: string;

  private config: DbConfig;
  private configWatcher: chokidar.FSWatcher | undefined;

  public constructor(workspaceStoragePath: string, private readonly extensionPath: string) {
    super();

    this.configPath = path.join(workspaceStoragePath, 'workspace-databases.json');

    this.config = this.createEmptyConfig();
    this.configWatcher = undefined;
  }

  public async initialize(): Promise<void> {
    await this.loadConfig();
    this.watchConfig();
  }

  public dispose(): void {
    this.configWatcher?.unwatch(this.configPath);
  }

  public getConfig(): DbConfig {
    // Clone the config so that it's not modified outside of this class.
    return cloneDbConfig(this.config);
  }

  private async loadConfig(): Promise<void> {
    if (!await fs.pathExists(this.configPath)) {
      const schemaPath = path.resolve(this.extensionPath, 'workspace-databases-schema.json');
      await fs.writeJSON(this.configPath, fs.readJson(schemaPath), {});
      const json = {
        '$schema': `file://${schemaPath}`,
        ...this.createEmptyConfig()
      };
      await fs.writeJSON(this.configPath, json, { spaces: 2 });
    }

    await this.readConfig();
  }

  private async readConfig(): Promise<void> {
    this.config = await fs.readJSON(this.configPath);
  }

  private readConfigSync(): void {
    this.config = fs.readJSONSync(this.configPath);
  }

  private watchConfig(): void {
    this.configWatcher = chokidar.watch(this.configPath).on('change', () => {
      this.readConfigSync();
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
