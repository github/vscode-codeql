import { ProgressCallback, withProgress } from "../../common/vscode/progress";
import { DatabaseItem } from "./database-item";
import { showAndLogExceptionWithTelemetry } from "../../helpers";
import { redactableError } from "../../pure/errors";
import { asError, getErrorMessage } from "../../pure/helpers-pure";
import { CancellationToken, ExtensionContext, Uri } from "vscode";
import { Logger } from "../../common";
import { DatabaseOptions, FullDatabaseOptions } from "./database-options";
import { DatabaseItemImpl } from "./database-item-impl";
import { DatabaseManager } from "./database-manager";
import { CodeQLCliServer } from "../../codeql-cli/cli";
import { getPrimaryLanguage } from "./helpers";
import { DisposableObject } from "../../pure/disposable-object";
import { DatabasePersistenceManager } from "./database-persistence-manager";

/**
 * The name of the key in the workspaceState dictionary in which we
 * persist the current database across sessions.
 */
const CURRENT_DB = "currentDatabase";

/**
 * The name of the key in the workspaceState dictionary in which we
 * persist the list of databases across sessions.
 */
const DB_LIST = "databaseList";

export interface PersistedDatabaseItem {
  uri: string;
  options?: DatabaseOptions;
}

function toPersistedState(item: DatabaseItem): PersistedDatabaseItem {
  return {
    uri: item.databaseUri.toString(true),
    options: {
      displayName: item.name,
      dateAdded: item.dateAdded,
      language: item.language,
    },
  };
}

export class WorkspaceStateDatabasePersistenceManager
  extends DisposableObject
  implements DatabasePersistenceManager
{
  private databaseItems: PersistedDatabaseItem[] = [];

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly cliServer: CodeQLCliServer,
    private readonly logger: Logger,
  ) {
    super();
  }

  public async loadPersistedState(
    databaseManager: DatabaseManager,
  ): Promise<void> {
    return withProgress(async (progress, token) => {
      const currentDatabaseUri =
        this.ctx.workspaceState.get<string>(CURRENT_DB);
      const databases = this.ctx.workspaceState.get<PersistedDatabaseItem[]>(
        DB_LIST,
        [],
      );
      this.databaseItems = databases;
      let step = 0;
      progress({
        maxStep: databases.length,
        message: "Loading persisted databases",
        step,
      });
      try {
        void this.logger.log(
          `Found ${databases.length} persisted databases: ${databases
            .map((db) => db.uri)
            .join(", ")}`,
        );
        for (const database of databases) {
          progress({
            maxStep: databases.length,
            message: `Loading ${database.options?.displayName || "databases"}`,
            step: ++step,
          });

          const databaseItem = await this.createDatabaseItemFromPersistedState(
            databaseManager,
            progress,
            token,
            database,
          );
          try {
            await databaseManager.refreshDatabaseItem(databaseItem);
            await databaseManager.registerDatabase(
              progress,
              token,
              databaseItem,
            );
            if (currentDatabaseUri === database.uri) {
              await databaseManager.setCurrentDatabaseItem(databaseItem, true);
            }
            void this.logger.log(
              `Loaded database ${databaseItem.name} at URI ${database.uri}.`,
            );
          } catch (e) {
            // When loading from persisted state, leave invalid databases in the list. They will be
            // marked as invalid, and cannot be set as the current database.
            void this.logger.log(
              `Error loading database ${database.uri}: ${e}.`,
            );
          }
        }
      } catch (e) {
        // database list had an unexpected type - nothing to be done?
        void showAndLogExceptionWithTelemetry(
          redactableError(
            asError(e),
          )`Database list loading failed: ${getErrorMessage(e)}`,
        );
      }

      void this.logger.log("Finished loading persisted databases.");
    });
  }

  private async createDatabaseItemFromPersistedState(
    databaseManager: DatabaseManager,
    progress: ProgressCallback,
    token: CancellationToken,
    state: PersistedDatabaseItem,
  ): Promise<DatabaseItemImpl> {
    let displayName: string | undefined = undefined;
    let dateAdded = undefined;
    let language = undefined;
    if (state.options) {
      if (typeof state.options.displayName === "string") {
        displayName = state.options.displayName;
      }
      if (typeof state.options.dateAdded === "number") {
        dateAdded = state.options.dateAdded;
      }
      language = state.options.language;
    }

    const dbBaseUri = Uri.parse(state.uri, true);
    if (language === undefined) {
      // we haven't been successful yet at getting the language. try again
      language = await getPrimaryLanguage(this.cliServer, dbBaseUri.fsPath);
    }

    const fullOptions: FullDatabaseOptions = {
      displayName,
      dateAdded,
      language,
    };
    const item = new DatabaseItemImpl(dbBaseUri, undefined, fullOptions);

    // Avoid persisting the database state after adding since that should happen only after
    // all databases have been added.
    await databaseManager.addDatabaseItemWithoutPersistence(
      progress,
      token,
      item,
    );
    return item;
  }

  async addDatabaseItem(databaseItem: DatabaseItem): Promise<void> {
    this.databaseItems.push(toPersistedState(databaseItem));
    await this.updatePersistedDatabaseList();
  }

  async removeDatabaseItem(item: DatabaseItem): Promise<void> {
    const index = this.databaseItems.findIndex(
      (db) => db.uri === item.databaseUri.toString(true),
    );

    if (index >= 0) {
      this.databaseItems.splice(index, 1);
    }

    await this.updatePersistedDatabaseList();
  }

  async renameDatabaseItem(item: DatabaseItem, newName: string): Promise<void> {
    const persistedItem = this.databaseItems.find(
      (db) => db.uri === item.databaseUri.toString(true),
    );
    if (!persistedItem) {
      return;
    }

    if (!persistedItem.options) {
      persistedItem.options = {};
    }

    persistedItem.options.displayName = newName;

    await this.updatePersistedDatabaseList();
  }

  async setCurrentDatabaseItem(item: DatabaseItem | undefined): Promise<void> {
    void this.ctx.workspaceState.update(
      CURRENT_DB,
      item ? item.databaseUri.toString(true) : undefined,
    );
  }

  private async updatePersistedDatabaseList(): Promise<void> {
    await this.ctx.workspaceState.update(DB_LIST, this.databaseItems);
  }
}
