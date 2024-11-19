import { join, basename, dirname as path_dirname } from "path";
import { DisposableObject } from "../common/disposable-object";
import type {
  Event,
  ProviderResult,
  TreeDataProvider,
  CancellationToken,
  QuickPickItem,
} from "vscode";
import {
  EventEmitter,
  TreeItem,
  Uri,
  window,
  env,
  ThemeIcon,
  ThemeColor,
  workspace,
  FileType,
} from "vscode";
import { pathExists, stat, readdir, remove } from "fs-extra";

import type {
  DatabaseChangedEvent,
  DatabaseItem,
  DatabaseManager,
} from "./local-databases";
import type { ProgressCallback } from "../common/vscode/progress";
import {
  UserCancellationException,
  withProgress,
} from "../common/vscode/progress";
import {
  isLikelyDatabaseRoot,
  isLikelyDbLanguageFolder,
} from "./local-databases/db-contents-heuristics";
import {
  showAndLogExceptionWithTelemetry,
  showAndLogErrorMessage,
  showAndLogInformationMessage,
} from "../common/logging";
import type { DatabaseFetcher } from "./database-fetcher";
import { asError, asyncFilter, getErrorMessage } from "../common/helpers-pure";
import type { QueryRunner } from "../query-server";
import type { App } from "../common/app";
import { redactableError } from "../common/errors";
import type { LocalDatabasesCommands } from "../common/commands";
import {
  createMultiSelectionCommand,
  createSingleSelectionCommand,
} from "../common/vscode/selection-commands";
import {
  getLanguageDisplayName,
  tryGetQueryLanguage,
} from "../common/query-language";
import type { LanguageContextStore } from "../language-context-store";

enum SortOrder {
  NameAsc = "NameAsc",
  NameDesc = "NameDesc",
  LanguageAsc = "LanguageAsc",
  LanguageDesc = "LanguageDesc",
  DateAddedAsc = "DateAddedAsc",
  DateAddedDesc = "DateAddedDesc",
}

/**
 * Tree data provider for the databases view.
 */
class DatabaseTreeDataProvider
  extends DisposableObject
  implements TreeDataProvider<DatabaseItem>
{
  private _sortOrder = SortOrder.NameAsc;

  private readonly _onDidChangeTreeData = this.push(
    new EventEmitter<DatabaseItem | undefined>(),
  );
  private currentDatabaseItem: DatabaseItem | undefined;

  constructor(
    private databaseManager: DatabaseManager,
    private languageContext: LanguageContextStore,
  ) {
    super();

    this.currentDatabaseItem = databaseManager.currentDatabaseItem;

    this.push(
      this.databaseManager.onDidChangeDatabaseItem(
        this.handleDidChangeDatabaseItem.bind(this),
      ),
    );
    this.push(
      this.databaseManager.onDidChangeCurrentDatabaseItem(
        this.handleDidChangeCurrentDatabaseItem.bind(this),
      ),
    );
    this.push(
      this.languageContext.onLanguageContextChanged(async () => {
        this._onDidChangeTreeData.fire(undefined);
      }),
    );
  }

  public get onDidChangeTreeData(): Event<DatabaseItem | undefined> {
    return this._onDidChangeTreeData.event;
  }

  private handleDidChangeDatabaseItem(event: DatabaseChangedEvent): void {
    // Note that events from the database manager are instances of DatabaseChangedEvent
    // and events fired by the UI are instances of DatabaseItem

    // When a full refresh has occurred, then all items are refreshed by passing undefined.
    this._onDidChangeTreeData.fire(event.fullRefresh ? undefined : event.item);
  }

  private handleDidChangeCurrentDatabaseItem(
    event: DatabaseChangedEvent,
  ): void {
    if (this.currentDatabaseItem) {
      this._onDidChangeTreeData.fire(this.currentDatabaseItem);
    }
    this.currentDatabaseItem = event.item;
    if (this.currentDatabaseItem) {
      this._onDidChangeTreeData.fire(this.currentDatabaseItem);
    }
  }

  public getTreeItem(element: DatabaseItem): TreeItem {
    const item = new TreeItem(element.name);
    if (element === this.currentDatabaseItem) {
      item.iconPath = new ThemeIcon("check");

      item.contextValue = "currentDatabase";
    } else if (element.error !== undefined) {
      item.iconPath = new ThemeIcon("error", new ThemeColor("errorForeground"));
    }
    item.tooltip = element.databaseUri.fsPath;
    item.description =
      element.language + (element.origin?.type === "testproj" ? " (test)" : "");
    return item;
  }

  public getChildren(element?: DatabaseItem): ProviderResult<DatabaseItem[]> {
    if (element === undefined) {
      // Filter items by language
      const displayItems = this.databaseManager.databaseItems.filter((item) => {
        return this.languageContext.shouldInclude(
          tryGetQueryLanguage(item.language),
        );
      });

      // Sort items
      return displayItems.slice(0).sort((db1, db2) => {
        switch (this.sortOrder) {
          case SortOrder.NameAsc:
            return db1.name.localeCompare(db2.name, env.language);
          case SortOrder.NameDesc:
            return db2.name.localeCompare(db1.name, env.language);
          case SortOrder.LanguageAsc:
            return (
              db1.language.localeCompare(db2.language, env.language) ||
              // If the languages are the same, sort by name
              db1.name.localeCompare(db2.name, env.language)
            );
          case SortOrder.LanguageDesc:
            return (
              db2.language.localeCompare(db1.language, env.language) ||
              // If the languages are the same, sort by name
              db2.name.localeCompare(db1.name, env.language)
            );
          case SortOrder.DateAddedAsc:
            return (db1.dateAdded || 0) - (db2.dateAdded || 0);
          case SortOrder.DateAddedDesc:
            return (db2.dateAdded || 0) - (db1.dateAdded || 0);
        }
      });
    } else {
      return [];
    }
  }

  public getParent(_element: DatabaseItem): ProviderResult<DatabaseItem> {
    return null;
  }

  public getCurrent(): DatabaseItem | undefined {
    return this.currentDatabaseItem;
  }

  public get sortOrder() {
    return this._sortOrder;
  }

  public set sortOrder(newSortOrder: SortOrder) {
    this._sortOrder = newSortOrder;
    this._onDidChangeTreeData.fire(undefined);
  }
}

/** Gets the first element in the given list, if any, or undefined if the list is empty or undefined. */
function getFirst(list: Uri[] | undefined): Uri | undefined {
  if (list === undefined || list.length === 0) {
    return undefined;
  } else {
    return list[0];
  }
}

/**
 * Displays file selection dialog. Expects the user to choose a
 * database directory, which should be the parent directory of a
 * directory of the form `db-[language]`, for example, `db-cpp`.
 *
 * XXX: no validation is done other than checking the directory name
 * to make sure it really is a database directory.
 */
async function chooseDatabaseDir(byFolder: boolean): Promise<Uri | undefined> {
  const chosen = await window.showOpenDialog({
    openLabel: byFolder ? "Choose Database folder" : "Choose Database archive",
    canSelectFiles: !byFolder,
    canSelectFolders: byFolder,
    canSelectMany: false,
    filters: byFolder ? {} : { Archives: ["zip"] },
  });
  return getFirst(chosen);
}

export interface DatabaseSelectionQuickPickItem extends QuickPickItem {
  databaseKind: "new" | "existing";
}

export interface DatabaseQuickPickItem extends QuickPickItem {
  databaseItem: DatabaseItem;
}

export interface DatabaseImportQuickPickItems extends QuickPickItem {
  importType: "URL" | "github" | "archive" | "folder";
}

export class DatabaseUI extends DisposableObject {
  private treeDataProvider: DatabaseTreeDataProvider;

  public constructor(
    private app: App,
    private databaseManager: DatabaseManager,
    private readonly databaseFetcher: DatabaseFetcher,
    languageContext: LanguageContextStore,
    private readonly queryServer: QueryRunner,
    private readonly storagePath: string,
    readonly extensionPath: string,
  ) {
    super();

    this.treeDataProvider = this.push(
      new DatabaseTreeDataProvider(databaseManager, languageContext),
    );
    this.push(
      window.createTreeView("codeQLDatabases", {
        treeDataProvider: this.treeDataProvider,
        canSelectMany: true,
      }),
    );
  }

  public getCommands(): LocalDatabasesCommands {
    return {
      "codeQL.getCurrentDatabase": this.handleGetCurrentDatabase.bind(this),
      "codeQL.chooseDatabaseFolder":
        this.handleChooseDatabaseFolderFromPalette.bind(this),
      "codeQL.chooseDatabaseFoldersParent":
        this.handleChooseDatabaseFoldersParentFromPalette.bind(this),
      "codeQL.chooseDatabaseArchive":
        this.handleChooseDatabaseArchiveFromPalette.bind(this),
      "codeQL.chooseDatabaseInternet":
        this.handleChooseDatabaseInternet.bind(this),
      "codeQL.chooseDatabaseGithub": this.handleChooseDatabaseGithub.bind(this),
      "codeQL.setCurrentDatabase": this.handleSetCurrentDatabase.bind(this),
      "codeQL.importTestDatabase": this.handleImportTestDatabase.bind(this),
      "codeQL.setDefaultTourDatabase":
        this.handleSetDefaultTourDatabase.bind(this),
      "codeQL.upgradeCurrentDatabase":
        this.handleUpgradeCurrentDatabase.bind(this),
      "codeQL.clearCache": this.handleClearCache.bind(this),
      "codeQL.trimCache": this.handleTrimCache.bind(this),
      "codeQLDatabases.chooseDatabaseFolder":
        this.handleChooseDatabaseFolder.bind(this),
      "codeQLDatabases.chooseDatabaseArchive":
        this.handleChooseDatabaseArchive.bind(this),
      "codeQLDatabases.chooseDatabaseInternet":
        this.handleChooseDatabaseInternet.bind(this),
      "codeQLDatabases.chooseDatabaseGithub":
        this.handleChooseDatabaseGithub.bind(this),
      "codeQLDatabases.setCurrentDatabase":
        this.handleMakeCurrentDatabase.bind(this),
      "codeQLDatabases.sortByName": this.handleSortByName.bind(this),
      "codeQLDatabases.sortByLanguage": this.handleSortByLanguage.bind(this),
      "codeQLDatabases.sortByDateAdded": this.handleSortByDateAdded.bind(this),
      "codeQLDatabases.removeDatabase": createMultiSelectionCommand(
        this.handleRemoveDatabase.bind(this),
      ),
      "codeQLDatabases.upgradeDatabase": createMultiSelectionCommand(
        this.handleUpgradeDatabase.bind(this),
      ),
      "codeQLDatabases.renameDatabase": createSingleSelectionCommand(
        this.app.logger,
        this.handleRenameDatabase.bind(this),
        "database",
      ),
      "codeQLDatabases.openDatabaseFolder": createMultiSelectionCommand(
        this.handleOpenFolder.bind(this),
      ),
      "codeQLDatabases.addDatabaseSource": createMultiSelectionCommand(
        this.handleAddSource.bind(this),
      ),
      "codeQLDatabases.removeOrphanedDatabases":
        this.handleRemoveOrphanedDatabases.bind(this),
    };
  }

  private async handleMakeCurrentDatabase(
    databaseItem: DatabaseItem,
  ): Promise<void> {
    await this.databaseManager.setCurrentDatabaseItem(databaseItem);
  }

  private async chooseDatabaseFolder(
    progress: ProgressCallback,
  ): Promise<void> {
    try {
      await this.chooseAndSetDatabase(true, progress);
    } catch (e) {
      void showAndLogExceptionWithTelemetry(
        this.app.logger,
        this.app.telemetry,
        redactableError(
          asError(e),
        )`Failed to choose and set database: ${getErrorMessage(e)}`,
      );
    }
  }

  private async handleChooseDatabaseFolder(): Promise<void> {
    return withProgress(
      async (progress) => {
        await this.chooseDatabaseFolder(progress);
      },
      {
        title: "Adding database from folder",
      },
    );
  }

  private async handleChooseDatabaseFolderFromPalette(): Promise<void> {
    return withProgress(
      async (progress) => {
        await this.chooseDatabaseFolder(progress);
      },
      {
        title: "Choose a Database from a Folder",
      },
    );
  }

  private async handleChooseDatabaseFoldersParentFromPalette(): Promise<void> {
    return withProgress(async (progress) => {
      await this.chooseDatabasesParentFolder(progress);
    });
  }

  private async handleSetDefaultTourDatabase(): Promise<void> {
    return withProgress(
      async () => {
        try {
          if (!workspace.workspaceFolders?.length) {
            throw new Error("No workspace folder is open.");
          } else {
            // This specifically refers to the database folder in
            // https://github.com/github/codespaces-codeql
            const uri = Uri.parse(
              `${workspace.workspaceFolders[0].uri}/.tours/codeql-tutorial-database`,
            );

            const databaseItem = this.databaseManager.findDatabaseItem(uri);
            if (databaseItem === undefined) {
              const makeSelected = true;
              const nameOverride = "CodeQL Tutorial Database";

              await this.databaseManager.openDatabase(
                uri,
                {
                  type: "folder",
                },
                makeSelected,
                nameOverride,
                {
                  isTutorialDatabase: true,
                },
              );
            }
            await this.handleTourDependencies();
          }
        } catch (e) {
          // rethrow and let this be handled by default error handling.
          throw new Error(
            `Could not set the database for the Code Tour. Please make sure you are using the default workspace in your codespace: ${getErrorMessage(
              e,
            )}`,
          );
        }
      },
      {
        title: "Set Default Database for Codespace CodeQL Tour",
      },
    );
  }

  private async handleTourDependencies(): Promise<void> {
    if (!workspace.workspaceFolders?.length) {
      throw new Error("No workspace folder is open.");
    } else {
      const tutorialQueriesPath = join(
        workspace.workspaceFolders[0].uri.fsPath,
        "tutorial-queries",
      );
      const cli = this.queryServer.cliServer;
      await cli.packInstall(tutorialQueriesPath);
    }
  }

  // Public because it's used in tests
  public async handleRemoveOrphanedDatabases(): Promise<void> {
    void this.app.logger.log(
      "Removing orphaned databases from workspace storage.",
    );
    let dbDirs = undefined;

    if (
      !(await pathExists(this.storagePath)) ||
      !(await stat(this.storagePath)).isDirectory()
    ) {
      void this.app.logger.log(
        "Missing or invalid storage directory. Not trying to remove orphaned databases.",
      );
      return;
    }

    dbDirs =
      // read directory
      (await readdir(this.storagePath, { withFileTypes: true }))
        // remove non-directories
        .filter((dirent) => dirent.isDirectory())
        // get the full path
        .map((dirent) => join(this.storagePath, dirent.name))
        // remove databases still in workspace
        .filter((dbDir) => {
          const dbUri = Uri.file(dbDir);
          return this.databaseManager.databaseItems.every(
            (item) => item.databaseUri.fsPath !== dbUri.fsPath,
          );
        });

    // remove non-databases
    dbDirs = await asyncFilter(dbDirs, isLikelyDatabaseRoot);

    if (!dbDirs.length) {
      void this.app.logger.log("No orphaned databases found.");
      return;
    }

    // delete
    const failures = [] as string[];
    await Promise.all(
      dbDirs.map(async (dbDir) => {
        try {
          void this.app.logger.log(`Deleting orphaned database '${dbDir}'.`);
          await remove(dbDir);
        } catch (e) {
          void showAndLogExceptionWithTelemetry(
            this.app.logger,
            this.app.telemetry,
            redactableError(
              asError(e),
            )`Failed to delete orphaned database: ${getErrorMessage(e)}`,
          );
          failures.push(`${basename(dbDir)}`);
        }
      }),
    );

    if (failures.length) {
      const dirname = path_dirname(failures[0]);
      void showAndLogErrorMessage(
        this.app.logger,
        `Failed to delete unused databases (${failures.join(
          ", ",
        )}).\nTo delete unused databases, please remove them manually from the storage folder ${dirname}.`,
      );
    }
  }

  private async chooseDatabaseArchive(
    progress: ProgressCallback,
  ): Promise<void> {
    try {
      await this.chooseAndSetDatabase(false, progress);
    } catch (e: unknown) {
      void showAndLogExceptionWithTelemetry(
        this.app.logger,
        this.app.telemetry,
        redactableError(
          asError(e),
        )`Failed to choose and set database: ${getErrorMessage(e)}`,
      );
    }
  }

  private async handleChooseDatabaseArchive(): Promise<void> {
    return withProgress(
      async (progress) => {
        await this.chooseDatabaseArchive(progress);
      },
      {
        title: "Adding database from archive",
      },
    );
  }

  private async handleChooseDatabaseArchiveFromPalette(): Promise<void> {
    return withProgress(
      async (progress) => {
        await this.chooseDatabaseArchive(progress);
      },
      {
        title: "Choose a Database from an Archive",
      },
    );
  }

  private async handleChooseDatabaseInternet(): Promise<void> {
    return withProgress(
      async (progress) => {
        await this.databaseFetcher.promptImportInternetDatabase(progress);
      },
      {
        title: "Adding database from URL",
      },
    );
  }

  private async handleChooseDatabaseGithub(): Promise<void> {
    return withProgress(
      async (progress) => {
        await this.databaseFetcher.promptImportGithubDatabase(progress);
      },
      {
        title: "Adding database from GitHub",
      },
    );
  }

  private async handleSortByName() {
    if (this.treeDataProvider.sortOrder === SortOrder.NameAsc) {
      this.treeDataProvider.sortOrder = SortOrder.NameDesc;
    } else {
      this.treeDataProvider.sortOrder = SortOrder.NameAsc;
    }
  }

  private async handleSortByLanguage() {
    if (this.treeDataProvider.sortOrder === SortOrder.LanguageAsc) {
      this.treeDataProvider.sortOrder = SortOrder.LanguageDesc;
    } else {
      this.treeDataProvider.sortOrder = SortOrder.LanguageAsc;
    }
  }

  private async handleSortByDateAdded() {
    if (this.treeDataProvider.sortOrder === SortOrder.DateAddedAsc) {
      this.treeDataProvider.sortOrder = SortOrder.DateAddedDesc;
    } else {
      this.treeDataProvider.sortOrder = SortOrder.DateAddedAsc;
    }
  }

  private async handleUpgradeCurrentDatabase(): Promise<void> {
    return withProgress(
      async (progress, token) => {
        if (this.databaseManager.currentDatabaseItem !== undefined) {
          await this.handleUpgradeDatabasesInternal(progress, token, [
            this.databaseManager.currentDatabaseItem,
          ]);
        }
      },
      {
        title: "Upgrading current database",
        cancellable: true,
      },
    );
  }

  private async handleUpgradeDatabase(
    databaseItems: DatabaseItem[],
  ): Promise<void> {
    return withProgress(
      async (progress, token) => {
        return await this.handleUpgradeDatabasesInternal(
          progress,
          token,
          databaseItems,
        );
      },
      {
        title: "Upgrading database",
        cancellable: true,
      },
    );
  }

  private async handleUpgradeDatabasesInternal(
    progress: ProgressCallback,
    token: CancellationToken,
    databaseItems: DatabaseItem[],
  ): Promise<void> {
    await Promise.all(
      databaseItems.map(async (databaseItem) => {
        if (this.queryServer === undefined) {
          throw new Error(
            "Received request to upgrade database, but there is no running query server.",
          );
        }
        if (databaseItem.contents === undefined) {
          throw new Error(
            "Received request to upgrade database, but database contents could not be found.",
          );
        }
        if (databaseItem.contents.dbSchemeUri === undefined) {
          throw new Error(
            "Received request to upgrade database, but database has no schema.",
          );
        }

        // Search for upgrade scripts in any workspace folders available

        await this.queryServer.upgradeDatabaseExplicit(
          databaseItem,
          progress,
          token,
        );
      }),
    );
  }

  private async handleClearCache(): Promise<void> {
    return withProgress(
      async () => {
        if (
          this.queryServer !== undefined &&
          this.databaseManager.currentDatabaseItem !== undefined
        ) {
          await this.queryServer.clearCacheInDatabase(
            this.databaseManager.currentDatabaseItem,
          );
        }
      },
      {
        title: "Clearing cache",
      },
    );
  }

  private async handleTrimCache(): Promise<void> {
    return withProgress(
      async () => {
        if (
          this.queryServer !== undefined &&
          this.databaseManager.currentDatabaseItem !== undefined
        ) {
          await this.queryServer.trimCacheInDatabase(
            this.databaseManager.currentDatabaseItem,
          );
        }
      },
      {
        title: "Trimming cache",
      },
    );
  }

  private async handleGetCurrentDatabase(): Promise<string | undefined> {
    const dbItem = await this.getDatabaseItemInternal(undefined);
    return dbItem?.databaseUri.fsPath;
  }

  private async handleSetCurrentDatabase(uri: Uri): Promise<void> {
    return withProgress(
      async (progress) => {
        try {
          // Assume user has selected an archive if the file has a .zip extension
          if (uri.path.endsWith(".zip")) {
            await this.databaseFetcher.importLocalDatabase(
              uri.toString(true),
              progress,
            );
          } else {
            await this.databaseManager.openDatabase(uri, {
              type: "folder",
            });
          }
        } catch (e) {
          // rethrow and let this be handled by default error handling.
          throw new Error(
            `Could not set database to ${basename(
              uri.fsPath,
            )}. Reason: ${getErrorMessage(e)}`,
          );
        }
      },
      {
        title: "Importing database from archive",
      },
    );
  }

  private async handleImportTestDatabase(uri: Uri): Promise<void> {
    return withProgress(
      async (progress) => {
        try {
          if (!uri.path.endsWith(".testproj")) {
            throw new Error(
              "Please select a valid test database to import. Test databases end with `.testproj`.",
            );
          }

          // Check if the database is already in the workspace. If
          // so, delete it first before importing the new one.
          const existingItem = this.databaseManager.findTestDatabase(uri);
          const baseName = basename(uri.fsPath);
          if (existingItem !== undefined) {
            progress({
              maxStep: 9,
              step: 1,
              message: `Removing existing test database ${baseName}`,
            });
            await this.databaseManager.removeDatabaseItem(existingItem);
          }

          await this.databaseFetcher.importLocalDatabase(
            uri.toString(true),
            progress,
          );

          if (existingItem !== undefined) {
            progress({
              maxStep: 9,
              step: 9,
              message: `Successfully re-imported ${baseName}`,
            });
          }
        } catch (e) {
          // rethrow and let this be handled by default error handling.
          throw new Error(
            `Could not set database to ${basename(
              uri.fsPath,
            )}. Reason: ${getErrorMessage(e)}`,
          );
        }
      },
      {
        title: "(Re-)importing test database from directory",
      },
    );
  }

  private async handleRemoveDatabase(
    databaseItems: DatabaseItem[],
  ): Promise<void> {
    return withProgress(
      async () => {
        await Promise.all(
          databaseItems.map((dbItem) =>
            this.databaseManager.removeDatabaseItem(dbItem),
          ),
        );
      },
      {
        title: "Removing database",
        cancellable: false,
      },
    );
  }

  private async handleRenameDatabase(
    databaseItem: DatabaseItem,
  ): Promise<void> {
    const newName = await window.showInputBox({
      prompt: "Choose new database name",
      value: databaseItem.name,
    });

    if (newName) {
      await this.databaseManager.renameDatabaseItem(databaseItem, newName);
    }
  }

  private async handleOpenFolder(databaseItems: DatabaseItem[]): Promise<void> {
    await Promise.all(
      databaseItems.map((dbItem) => env.openExternal(dbItem.databaseUri)),
    );
  }

  /**
   * Adds the source folder of a CodeQL database to the workspace.
   * When a database is first added in the "Databases" view, its source folder is added to the workspace.
   * If the source folder is removed from the workspace for some reason, we want to be able to re-add it if need be.
   */
  private async handleAddSource(databaseItems: DatabaseItem[]): Promise<void> {
    for (const dbItem of databaseItems) {
      await this.databaseManager.addDatabaseSourceArchiveFolder(dbItem);
    }
  }

  /**
   * Return the current database directory. If we don't already have a
   * current database, ask the user for one, and return that, or
   * undefined if they cancel.
   */
  public async getDatabaseItem(
    progress: ProgressCallback,
  ): Promise<DatabaseItem | undefined> {
    return await this.getDatabaseItemInternal(progress);
  }

  /**
   * Return the current database directory. If we don't already have a
   * current database, ask the user for one, and return that, or
   * undefined if they cancel.
   *
   * Unlike `getDatabaseItem()`, this function does not require the caller to pass in a progress
   * context. If `progress` is `undefined`, then this command will create a new progress
   * notification if it tries to perform any long-running operations.
   */
  private async getDatabaseItemInternal(
    progress: ProgressCallback | undefined,
  ): Promise<DatabaseItem | undefined> {
    if (this.databaseManager.currentDatabaseItem === undefined) {
      progress?.({
        maxStep: 2,
        step: 1,
        message: "Choosing database",
      });
      await this.promptForDatabase();
    }
    return this.databaseManager.currentDatabaseItem;
  }

  private async promptForDatabase(): Promise<void> {
    // If there aren't any existing databases,
    // don't bother asking the user if they want to pick one.
    if (this.databaseManager.databaseItems.length === 0) {
      return this.importNewDatabase();
    }

    const quickPickItems: DatabaseSelectionQuickPickItem[] = [
      {
        label: "$(database) Existing database",
        detail: "Select an existing database from your workspace",
        alwaysShow: true,
        databaseKind: "existing",
      },
      {
        label: "$(arrow-down) New database",
        detail:
          "Import a new database from GitHub, a URL, or your local machine...",
        alwaysShow: true,
        databaseKind: "new",
      },
    ];
    const selectedOption =
      await window.showQuickPick<DatabaseSelectionQuickPickItem>(
        quickPickItems,
        {
          placeHolder: "Select an option",
          ignoreFocusOut: true,
        },
      );

    if (!selectedOption) {
      throw new UserCancellationException("No database selected", true);
    }

    if (selectedOption.databaseKind === "existing") {
      await this.selectExistingDatabase();
    } else if (selectedOption.databaseKind === "new") {
      await this.importNewDatabase();
    }
  }

  private async selectExistingDatabase() {
    const dbItems: DatabaseQuickPickItem[] =
      this.databaseManager.databaseItems.map((dbItem) => ({
        label: dbItem.name,
        description: getLanguageDisplayName(dbItem.language),
        databaseItem: dbItem,
      }));

    const selectedDatabase = await window.showQuickPick(dbItems, {
      placeHolder: "Select an existing database from your workspace...",
      ignoreFocusOut: true,
    });

    if (!selectedDatabase) {
      throw new UserCancellationException("No database selected", true);
    }

    await this.databaseManager.setCurrentDatabaseItem(
      selectedDatabase.databaseItem,
    );
  }

  private async importNewDatabase() {
    const importOptions: DatabaseImportQuickPickItems[] = [
      {
        label: "$(github) GitHub",
        detail: "Import a database from a GitHub repository",
        alwaysShow: true,
        importType: "github",
      },
      {
        label: "$(link) URL",
        detail: "Import a database archive or folder from a remote URL",
        alwaysShow: true,
        importType: "URL",
      },
      {
        label: "$(file-zip) Archive",
        detail: "Import a database from a local ZIP archive",
        alwaysShow: true,
        importType: "archive",
      },
      {
        label: "$(folder) Folder",
        detail: "Import a database from a local folder",
        alwaysShow: true,
        importType: "folder",
      },
    ];
    const selectedImportOption =
      await window.showQuickPick<DatabaseImportQuickPickItems>(importOptions, {
        placeHolder:
          "Import a new database from GitHub, a URL, or your local machine...",
        ignoreFocusOut: true,
      });
    if (!selectedImportOption) {
      throw new UserCancellationException("No database selected", true);
    }
    if (selectedImportOption.importType === "github") {
      await this.handleChooseDatabaseGithub();
    } else if (selectedImportOption.importType === "URL") {
      await this.handleChooseDatabaseInternet();
    } else if (selectedImportOption.importType === "archive") {
      await this.handleChooseDatabaseArchive();
    } else if (selectedImportOption.importType === "folder") {
      await this.handleChooseDatabaseFolder();
    }
  }

  /**
   * Import database from uri. Returns the imported database, or `undefined` if the
   * operation was unsuccessful or canceled.
   */
  private async importDatabase(
    uri: Uri,
    byFolder: boolean,
    progress: ProgressCallback,
  ): Promise<DatabaseItem | undefined> {
    if (byFolder && !uri.fsPath.endsWith(".testproj")) {
      const fixedUri = await this.fixDbUri(uri);
      // we are selecting a database folder
      return await this.databaseManager.openDatabase(fixedUri, {
        type: "folder",
      });
    } else {
      // we are selecting a database archive or a .testproj.
      // Unzip archives (if an archive) and copy into a workspace-controlled area
      // before importing.
      return await this.databaseFetcher.importLocalDatabase(
        uri.toString(true),
        progress,
      );
    }
  }

  /**
   * Ask the user for a database directory. Returns the chosen database, or `undefined` if the
   * operation was canceled.
   */
  private async chooseAndSetDatabase(
    byFolder: boolean,
    progress: ProgressCallback,
  ): Promise<DatabaseItem | undefined> {
    const uri = await chooseDatabaseDir(byFolder);
    if (!uri) {
      return undefined;
    }

    return await this.importDatabase(uri, byFolder, progress);
  }

  /**
   * Ask the user for a parent directory that contains all databases.
   * Returns all valid databases, or `undefined` if the operation was canceled.
   */
  private async chooseDatabasesParentFolder(
    progress: ProgressCallback,
  ): Promise<DatabaseItem[] | undefined> {
    const uri = await chooseDatabaseDir(true);
    if (!uri) {
      return undefined;
    }

    const databases: DatabaseItem[] = [];
    const failures: string[] = [];
    const entries = await workspace.fs.readDirectory(uri);
    const validFileTypes = [FileType.File, FileType.Directory];

    for (const [index, entry] of entries.entries()) {
      progress({
        step: index + 1,
        maxStep: entries.length,
        message: `Importing '${entry[0]}'`,
      });

      const subProgress: ProgressCallback = (p) => {
        progress({
          step: index + 1,
          maxStep: entries.length,
          message: `Importing '${entry[0]}': (${p.step}/${p.maxStep}) ${p.message}`,
        });
      };

      if (!validFileTypes.includes(entry[1])) {
        void this.app.logger.log(
          `Skipping import for '${entry}', invalid file type: ${entry[1]}`,
        );
        continue;
      }

      try {
        const databaseUri = Uri.joinPath(uri, entry[0]);
        void this.app.logger.log(`Importing from ${databaseUri}`);

        const database = await this.importDatabase(
          databaseUri,
          entry[1] === FileType.Directory,
          subProgress,
        );
        if (database) {
          databases.push(database);
        } else {
          failures.push(entry[0]);
        }
      } catch (e) {
        failures.push(`${entry[0]}: ${getErrorMessage(e)}`.trim());
      }
    }

    if (failures.length) {
      void showAndLogErrorMessage(
        this.app.logger,
        `Failed to import ${failures.length} database(s), successfully imported ${databases.length} database(s).`,
        {
          fullMessage: `Failed to import ${failures.length} database(s), successfully imported ${databases.length} database(s).\nFailed databases:\n  - ${failures.join("\n  - ")}`,
        },
      );
    } else if (databases.length === 0) {
      void showAndLogErrorMessage(
        this.app.logger,
        `No database folder to import.`,
      );
      return undefined;
    } else {
      void showAndLogInformationMessage(
        this.app.logger,
        `Successfully imported ${databases.length} database(s).`,
      );
    }

    return databases;
  }

  /**
   * Perform some heuristics to ensure a proper database location is chosen.
   *
   * 1. If the selected URI to add is a file, choose the containing directory
   * 2. If the selected URI appears to be a db language folder, choose the containing directory
   * 3. choose the current directory
   *
   * @param uri a URI that is a database folder or inside it
   *
   * @return the actual database folder found by using the heuristics above.
   */
  private async fixDbUri(uri: Uri): Promise<Uri> {
    let dbPath = uri.fsPath;
    if ((await stat(dbPath)).isFile()) {
      dbPath = path_dirname(dbPath);
    }

    if (await isLikelyDbLanguageFolder(dbPath)) {
      dbPath = path_dirname(dbPath);
    }
    return Uri.file(dbPath);
  }
}
