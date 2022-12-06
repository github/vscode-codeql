import { pathExists, writeJSON, readJSON, readJSONSync } from "fs-extra";
import { join } from "path";
import {
  cloneDbConfig,
  DbConfig,
  ExpandedDbItem,
  SelectedDbItem,
} from "./db-config";
import * as chokidar from "chokidar";
import { DisposableObject, DisposeHandler } from "../../pure/disposable-object";
import { DbConfigValidator } from "./db-config-validator";
import { ValueResult } from "../../common/value-result";
import { App } from "../../common/app";
import { AppEvent, AppEventEmitter } from "../../common/events";

export class DbConfigStore extends DisposableObject {
  public readonly onDidChangeConfig: AppEvent<void>;
  private readonly onDidChangeConfigEventEmitter: AppEventEmitter<void>;

  private readonly configPath: string;
  private readonly configValidator: DbConfigValidator;

  private config: DbConfig | undefined;
  private configErrors: string[];
  private configWatcher: chokidar.FSWatcher | undefined;

  public constructor(app: App) {
    super();

    const storagePath = app.workspaceStoragePath || app.globalStoragePath;
    this.configPath = join(storagePath, "workspace-databases.json");

    this.config = this.createEmptyConfig();
    this.configErrors = [];
    this.configWatcher = undefined;
    this.configValidator = new DbConfigValidator(app.extensionPath);
    this.onDidChangeConfigEventEmitter = app.createEventEmitter<void>();
    this.onDidChangeConfig = this.onDidChangeConfigEventEmitter.event;
  }

  public async initialize(): Promise<void> {
    await this.loadConfig();
    this.watchConfig();
  }

  public dispose(disposeHandler?: DisposeHandler): void {
    super.dispose(disposeHandler);
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

  public async setSelectedDbItem(dbItem: SelectedDbItem): Promise<void> {
    if (!this.config) {
      // If the app is trying to set the selected item without a config
      // being set it means that there is a bug in our code, so we throw
      // an error instead of just returning an error result.
      throw Error("Cannot select database item if config is not loaded");
    }

    const config: DbConfig = {
      ...this.config,
      selected: dbItem,
    };

    await this.writeConfig(config);
  }

  public async updateExpandedState(expandedItems: ExpandedDbItem[]) {
    if (!this.config) {
      throw Error("Cannot update expansion state if config is not loaded");
    }

    const config: DbConfig = {
      ...this.config,
      expanded: expandedItems,
    };

    await this.writeConfig(config);
  }

  private async writeConfig(config: DbConfig): Promise<void> {
    await writeJSON(this.configPath, config, {
      spaces: 2,
    });
  }

  private async loadConfig(): Promise<void> {
    if (!(await pathExists(this.configPath))) {
      await this.writeConfig(this.createEmptyConfig());
    }

    await this.readConfig();
  }

  private async readConfig(): Promise<void> {
    let newConfig: DbConfig | undefined = undefined;
    try {
      newConfig = await readJSON(this.configPath);
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
      newConfig = readJSONSync(this.configPath);
    } catch (e) {
      this.configErrors = [`Failed to read config file: ${this.configPath}`];
    }

    if (newConfig) {
      this.configErrors = this.configValidator.validate(newConfig);
    }

    this.config = this.configErrors.length === 0 ? newConfig : undefined;

    this.onDidChangeConfigEventEmitter.fire();
  }

  private watchConfig(): void {
    this.configWatcher = chokidar.watch(this.configPath).on("change", () => {
      this.readConfigSync();
    });
  }

  private createEmptyConfig(): DbConfig {
    return {
      databases: {
        remote: {
          repositoryLists: [],
          owners: [],
          repositories: [],
        },
        local: {
          lists: [],
          databases: [],
        },
      },
      expanded: [],
    };
  }
}
