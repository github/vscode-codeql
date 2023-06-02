import { DatabaseManager } from "../local-databases";
import { DbConfigStore } from "./db-config-store";
import { DisposableObject } from "../../pure/disposable-object";
import { Logger } from "../../common";
import { ProgressOptions, withProgress } from "../../common/vscode/progress";
import { LocalDatabase } from "./db-config";
import { DatabaseItemImpl } from "../local-databases/database-item-impl";
import { Uri } from "vscode";

export class DbConfigDatabaseManagerUpdater extends DisposableObject {
  private constructor(
    private readonly dbConfigStore: DbConfigStore,
    private readonly databaseManager: DatabaseManager,
    private readonly logger: Logger,
  ) {
    super();
    this.push(
      this.dbConfigStore.onDidChangeConfig(this.onDidChangeConfig.bind(this)),
    );
    this.databaseManager.databaseItems;
  }

  public static async initialize(
    dbConfigStore: DbConfigStore,
    databaseManager: DatabaseManager,
    logger: Logger,
  ): Promise<DbConfigDatabaseManagerUpdater> {
    return new DbConfigDatabaseManagerUpdater(
      dbConfigStore,
      databaseManager,
      logger,
    );
  }

  public async loadDatabases() {
    await this.updateDatabases({
      title: "Loading databases",
    });
  }

  private async onDidChangeConfig() {
    await this.updateDatabases({
      title: "Updating databases",
    });
  }

  private async updateDatabases(progressOptions: ProgressOptions) {
    const config = this.dbConfigStore.getConfig();

    if (config.isFailure) {
      throw new Error(config.errors.join("\n"));
    }

    const databasesInConfig = config.value.databases.local.databases;
    databasesInConfig.push(
      ...config.value.databases.local.lists.flatMap((list) => list.databases),
    );

    const databasesByStoragePath = new Map<string, LocalDatabase>();
    for (const database of databasesInConfig) {
      databasesByStoragePath.set(database.storagePath, database);
    }

    const databases = Array.from(databasesByStoragePath.values());

    void this.logger.log(
      `Found ${databases.length} persisted databases: ${databases
        .map((db) => db.storagePath)
        .join(", ")}`,
    );

    const selectedItem = config.value.selected;
    let selectedDatabase: LocalDatabase | undefined;
    if (selectedItem?.kind === "localDatabase") {
      if (selectedItem.listName) {
        const list = config.value.databases.local.lists.find(
          (list) => list.name === selectedItem.listName,
        );
        if (list) {
          selectedDatabase = list.databases.find(
            (db) => db.name === selectedItem.databaseName,
          );
        }
      } else {
        selectedDatabase = config.value.databases.local.databases.find(
          (db) => db.name === selectedItem.databaseName,
        );
      }
    }

    const databasesToLoad: LocalDatabase[] = [];

    for (const database of databases) {
      const existingDatabase = this.databaseManager.databaseItems.find(
        (db) => db.databaseUri.toString(true) === database.storagePath,
      );
      if (existingDatabase) {
        await this.databaseManager.renameDatabaseItem(
          existingDatabase,
          database.name,
          false,
        );
        await this.databaseManager.setDatabaseItemLanguageAndDateAdded(
          existingDatabase,
          database.language,
          database.dateAdded,
        );

        continue;
      }

      databasesToLoad.push(database);
    }

    const nonExistentDatabases = this.databaseManager.databaseItems.filter(
      (db) => !databasesByStoragePath.has(db.databaseUri.toString(true)),
    );

    if (databasesToLoad.length > 0 || nonExistentDatabases.length > 0) {
      await withProgress(async (progress, token) => {
        let step = 0;

        progress({
          maxStep: databases.length,
          message: "Loading databases",
          step,
        });

        const maxStep = databases.length + nonExistentDatabases.length;

        for (const database of databasesToLoad) {
          progress({
            maxStep,
            message: `Loading ${database.name}`,
            step: ++step,
          });

          const databaseItem = new DatabaseItemImpl(
            Uri.parse(database.storagePath, true),
            undefined,
            {
              displayName: database.name,
              dateAdded: database.dateAdded,
              language: database.language,
            },
          );

          await this.databaseManager.addDatabaseItemWithoutPersistence(
            progress,
            token,
            databaseItem,
          );

          try {
            await this.databaseManager.refreshDatabaseItem(databaseItem);
            await this.databaseManager.registerDatabase(
              progress,
              token,
              databaseItem,
            );
            void this.logger.log(
              `Loaded database ${databaseItem.name} at URI ${database.storagePath}.`,
            );
          } catch (e) {
            // When loading from persisted state, leave invalid databases in the list. They will be
            // marked as invalid, and cannot be set as the current database.
            void this.logger.log(
              `Error loading database ${database.storagePath}: ${e}.`,
            );
          }
        }

        for (const database of nonExistentDatabases) {
          progress({
            maxStep,
            message: `Removing ${database.name}`,
            step: ++step,
          });

          await this.databaseManager.removeDatabaseItem(
            progress,
            token,
            database,
            false,
          );
        }
      }, progressOptions);
    }

    const databaseItemToSelect = this.databaseManager.databaseItems.find(
      (db) => db.databaseUri.toString(true) === selectedDatabase?.storagePath,
    );
    if (databaseItemToSelect) {
      await this.databaseManager.setCurrentDatabaseItem(
        databaseItemToSelect,
        true,
      );
    }
  }
}
