import { pathExists, outputJSON, readJSON, readJSONSync } from "fs-extra";
import { join } from "path";
import type { DbConfig, SelectedDbItem } from "./db-config";
import {
  cloneDbConfig,
  removeRemoteList,
  removeRemoteOwner,
  removeRemoteRepo,
  renameRemoteList,
  DB_CONFIG_VERSION,
  SelectedDbItemKind,
} from "./db-config";
import type { FSWatcher } from "chokidar";
import { watch } from "chokidar";
import type { DisposeHandler } from "../../common/disposable-object";
import { DisposableObject } from "../../common/disposable-object";
import { DbConfigValidator } from "./db-config-validator";
import type { App } from "../../common/app";
import type { AppEvent, AppEventEmitter } from "../../common/events";
import type { DbConfigValidationError } from "../db-validation-errors";
import { DbConfigValidationErrorKind } from "../db-validation-errors";
import { ValueResult } from "../../common/value-result";
import type { RemoteUserDefinedListDbItem, DbItem } from "../db-item";
import { DbItemKind } from "../db-item";

export class DbConfigStore extends DisposableObject {
  public static readonly databaseConfigFileName = "databases.json";

  public readonly onDidChangeConfig: AppEvent<void>;
  private readonly onDidChangeConfigEventEmitter: AppEventEmitter<void>;

  private readonly configPath: string;
  private readonly configValidator: DbConfigValidator;

  private config: DbConfig | undefined;
  private configErrors: DbConfigValidationError[];
  private configWatcher: FSWatcher | undefined;

  public constructor(
    private readonly app: App,
    private readonly shouldWatchConfig = true,
  ) {
    super();

    const storagePath = app.workspaceStoragePath || app.globalStoragePath;
    this.configPath = join(storagePath, DbConfigStore.databaseConfigFileName);

    this.config = this.createEmptyConfig();
    this.configErrors = [];
    this.configWatcher = undefined;
    this.configValidator = new DbConfigValidator(app.extensionPath);
    this.onDidChangeConfigEventEmitter = this.push(
      app.createEventEmitter<void>(),
    );
    this.onDidChangeConfig = this.onDidChangeConfigEventEmitter.event;
  }

  public async initialize(): Promise<void> {
    await this.loadConfig();
    if (this.shouldWatchConfig) {
      this.watchConfig();
    }
  }

  public dispose(disposeHandler?: DisposeHandler): void {
    super.dispose(disposeHandler);
    this.configWatcher?.unwatch(this.configPath);
  }

  public getConfig(): ValueResult<DbConfig, DbConfigValidationError> {
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

    const config = {
      ...this.config,
      selected: dbItem,
    };

    await this.writeConfig(config);
  }

  public async removeDbItem(dbItem: DbItem): Promise<void> {
    if (!this.config) {
      throw Error("Cannot remove item if config is not loaded");
    }

    let config: DbConfig;

    switch (dbItem.kind) {
      case DbItemKind.RemoteUserDefinedList:
        config = removeRemoteList(this.config, dbItem.listName);
        break;
      case DbItemKind.RemoteRepo:
        config = removeRemoteRepo(
          this.config,
          dbItem.repoFullName,
          dbItem.parentListName,
        );
        break;
      case DbItemKind.RemoteOwner:
        config = removeRemoteOwner(this.config, dbItem.ownerName);
        break;
      default:
        throw Error(`Type '${dbItem.kind}' cannot be removed`);
    }

    await this.writeConfig(config);
  }

  public async addRemoteReposToList(
    repoNwoList: string[],
    parentList: string,
  ): Promise<void> {
    if (!this.config) {
      throw Error("Cannot add variant analysis repos if config is not loaded");
    }

    const config = cloneDbConfig(this.config);
    const parent = config.databases.variantAnalysis.repositoryLists.find(
      (list) => list.name === parentList,
    );
    if (!parent) {
      throw Error(`Cannot find parent list '${parentList}'`);
    }

    // Remove duplicates from the list of repositories.
    const newRepositoriesList = [
      ...new Set([...parent.repositories, ...repoNwoList]),
    ];

    parent.repositories = newRepositoriesList;

    await this.writeConfig(config);
  }

  public async addRemoteRepo(
    repoNwo: string,
    parentList?: string,
  ): Promise<void> {
    if (!this.config) {
      throw Error("Cannot add variant analysis repo if config is not loaded");
    }

    if (repoNwo === "") {
      throw Error("Repository name cannot be empty");
    }

    if (this.doesRemoteDbExist(repoNwo, parentList)) {
      throw Error(
        `A variant analysis repository with the name '${repoNwo}' already exists`,
      );
    }

    const config = cloneDbConfig(this.config);
    if (parentList) {
      const parent = config.databases.variantAnalysis.repositoryLists.find(
        (list) => list.name === parentList,
      );
      if (!parent) {
        throw Error(`Cannot find parent list '${parentList}'`);
      } else {
        parent.repositories = [...parent.repositories, repoNwo];
      }
    } else {
      config.databases.variantAnalysis.repositories.push(repoNwo);
    }
    await this.writeConfig(config);
  }

  public async addRemoteOwner(owner: string): Promise<void> {
    if (!this.config) {
      throw Error("Cannot add owner if config is not loaded");
    }

    if (owner === "") {
      throw Error("Owner name cannot be empty");
    }

    if (this.doesRemoteOwnerExist(owner)) {
      throw Error(`An owner with the name '${owner}' already exists`);
    }

    const config = cloneDbConfig(this.config);
    config.databases.variantAnalysis.owners.push(owner);

    await this.writeConfig(config);
  }

  public async addRemoteList(listName: string): Promise<void> {
    if (!this.config) {
      throw Error("Cannot add variant analysis list if config is not loaded");
    }

    this.validateRemoteListName(listName);

    const config = cloneDbConfig(this.config);
    config.databases.variantAnalysis.repositoryLists.push({
      name: listName,
      repositories: [],
    });

    await this.writeConfig(config);
  }

  public async renameRemoteList(
    currentDbItem: RemoteUserDefinedListDbItem,
    newName: string,
  ) {
    if (!this.config) {
      throw Error(
        "Cannot rename variant analysis list if config is not loaded",
      );
    }

    this.validateRemoteListName(newName);

    const updatedConfig = renameRemoteList(
      this.config,
      currentDbItem.listName,
      newName,
    );

    await this.writeConfig(updatedConfig);
  }

  public doesRemoteListExist(listName: string): boolean {
    if (!this.config) {
      throw Error(
        "Cannot check variant analysis list existence if config is not loaded",
      );
    }

    return this.config.databases.variantAnalysis.repositoryLists.some(
      (l) => l.name === listName,
    );
  }

  public doesRemoteDbExist(dbName: string, listName?: string): boolean {
    if (!this.config) {
      throw Error(
        "Cannot check variant analysis repository existence if config is not loaded",
      );
    }

    if (listName) {
      return this.config.databases.variantAnalysis.repositoryLists.some(
        (l) => l.name === listName && l.repositories.includes(dbName),
      );
    }

    return this.config.databases.variantAnalysis.repositories.includes(dbName);
  }

  public doesRemoteOwnerExist(owner: string): boolean {
    if (!this.config) {
      throw Error("Cannot check owner existence if config is not loaded");
    }

    return this.config.databases.variantAnalysis.owners.includes(owner);
  }

  private async writeConfig(config: DbConfig): Promise<void> {
    await outputJSON(this.configPath, config, {
      spaces: 2,
    });
  }

  private async loadConfig(): Promise<void> {
    if (!(await pathExists(this.configPath))) {
      void this.app.logger.log(
        `Creating new database config file at ${this.configPath}`,
      );
      await this.writeConfig(this.createEmptyConfig());
    }

    await this.readConfig();
    void this.app.logger.log(`Database config loaded from ${this.configPath}`);
  }

  private async readConfig(): Promise<void> {
    let newConfig: DbConfig | undefined = undefined;
    try {
      newConfig = await readJSON(this.configPath);
    } catch {
      this.configErrors = [
        {
          kind: DbConfigValidationErrorKind.InvalidJson,
          message: `Failed to read config file: ${this.configPath}`,
        },
      ];
    }

    if (newConfig) {
      this.configErrors = this.configValidator.validate(newConfig);
    }

    if (this.configErrors.length === 0) {
      this.config = newConfig;
      await this.app.commands.execute(
        "setContext",
        "codeQLVariantAnalysisRepositories.configError",
        false,
      );
    } else {
      this.config = undefined;
      await this.app.commands.execute(
        "setContext",
        "codeQLVariantAnalysisRepositories.configError",
        true,
      );
    }
  }

  private readConfigSync(): void {
    let newConfig: DbConfig | undefined = undefined;
    try {
      newConfig = readJSONSync(this.configPath);
    } catch {
      this.configErrors = [
        {
          kind: DbConfigValidationErrorKind.InvalidJson,
          message: `Failed to read config file: ${this.configPath}`,
        },
      ];
    }

    if (newConfig) {
      this.configErrors = this.configValidator.validate(newConfig);
    }

    if (this.configErrors.length === 0) {
      this.config = newConfig;
      void this.app.commands.execute(
        "setContext",
        "codeQLVariantAnalysisRepositories.configError",
        false,
      );
    } else {
      this.config = undefined;
      void this.app.commands.execute(
        "setContext",
        "codeQLVariantAnalysisRepositories.configError",
        true,
      );
    }
    this.onDidChangeConfigEventEmitter.fire();
  }

  private watchConfig(): void {
    this.configWatcher = watch(this.configPath, {
      // In some cases, change events are emitted while the file is still
      // being written. The awaitWriteFinish option tells the watcher to
      // poll the file size, holding its add and change events until the size
      // does not change for a configurable amount of time. We set that time
      // to 1 second, but it may need to be adjusted if there are issues.
      awaitWriteFinish: {
        stabilityThreshold: 1000,
      },
    }).on("change", () => {
      this.readConfigSync();
    });
  }

  private createEmptyConfig(): DbConfig {
    return {
      version: DB_CONFIG_VERSION,
      databases: {
        variantAnalysis: {
          repositoryLists: [],
          owners: [],
          repositories: [],
        },
      },
      selected: {
        kind: SelectedDbItemKind.VariantAnalysisSystemDefinedList,
        listName: "top_10",
      },
    };
  }

  private validateRemoteListName(listName: string): void {
    if (listName === "") {
      throw Error("List name cannot be empty");
    }

    if (this.doesRemoteListExist(listName)) {
      throw Error(
        `A variant analysis list with the name '${listName}' already exists`,
      );
    }
  }
}
