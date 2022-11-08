import * as fs from 'fs-extra';
import * as path from 'path';
import { cloneDbConfig, DbConfig } from './db-config';
import * as chokidar from 'chokidar';
import { DisposableObject } from '../pure/disposable-object';
import { DbConfigValidator } from './db-config-validator';
import { ValueResult } from '../common/value-result';

export class DbConfigStore extends DisposableObject {
  private readonly configPath: string;
  private readonly configValidator: DbConfigValidator;

  private config: DbConfig | undefined;
  private configErrors: string[];
  private configWatcher: chokidar.FSWatcher | undefined;

  public constructor(
    workspaceStoragePath: string,
    extensionPath: string) {
    super();

    this.configPath = path.join(workspaceStoragePath, 'workspace-databases.json');

    this.config = this.createEmptyConfig();
    this.configErrors = [];
    this.configWatcher = undefined;
    this.configValidator = new DbConfigValidator(extensionPath);
  }

  public async initialize(): Promise<void> {
    await this.loadConfig();
    this.watchConfig();
  }

  public dispose(): void {
    this.configWatcher?.unwatch(this.configPath);
  }

  public getConfig(): ValueResult<DbConfig> {
    if (this.config) {
      // Clone the config so that it's not modified outside of this class.
      return ValueResult.ok(cloneDbConfig(this.config));
    } else {
      return ValueResult.fail(this.configErrors);
    }
  }

  public getConfigPath(): string {
    return this.configPath;
  }

  private async loadConfig(): Promise<void> {
    if (!await fs.pathExists(this.configPath)) {
      await fs.writeJSON(this.configPath, this.createEmptyConfig(), { spaces: 2 });
    }

    await this.readConfig();
  }

  private async readConfig(): Promise<void> {
    let newConfig: DbConfig | undefined = undefined;
    try {
      newConfig = await fs.readJSON(this.configPath);
    } catch (e) {
      this.configErrors = [`Failed to read config file: ${this.configPath}`];
    }

    if (newConfig) {
      this.configErrors = this.configValidator.validate(newConfig);
    }

    this.config = this.configErrors.length === 0 ? newConfig : undefined;
  }

  private readConfigSync(): void {
    let newConfig: DbConfig | undefined = undefined;
    try {
      newConfig = fs.readJSONSync(this.configPath);
    } catch (e) {
      this.configErrors = [`Failed to read config file: ${this.configPath}`];
    }

    if (newConfig) {
      this.configErrors = this.configValidator.validate(newConfig);
    }

    this.config = this.configErrors.length === 0 ? newConfig : undefined;
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
