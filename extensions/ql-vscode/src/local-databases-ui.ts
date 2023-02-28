import { join, basename, dirname as path_dirname } from "path";
import { DisposableObject } from "./pure/disposable-object";
import {
  Event,
  EventEmitter,
  ProviderResult,
  TreeDataProvider,
  TreeItem,
  Uri,
  window,
  env,
  CancellationToken,
  ThemeIcon,
  ThemeColor,
  workspace,
} from "vscode";
import { pathExists, stat, readdir, remove } from "fs-extra";

import {
  DatabaseChangedEvent,
  DatabaseItem,
  DatabaseManager,
} from "./local-databases";
import {
  commandRunner,
  commandRunnerWithProgress,
  ProgressCallback,
} from "./commandRunner";
import {
  isLikelyDatabaseRoot,
  isLikelyDbLanguageFolder,
  showAndLogErrorMessage,
  showAndLogExceptionWithTelemetry,
} from "./helpers";
import { extLogger } from "./common";
import {
  importArchiveDatabase,
  promptImportGithubDatabase,
  promptImportInternetDatabase,
} from "./databaseFetcher";
import { asError, asyncFilter, getErrorMessage } from "./pure/helpers-pure";
import { QueryRunner } from "./queryRunner";
import { isCanary } from "./config";
import { App } from "./common/app";
import { Credentials } from "./common/authentication";
import { redactableError } from "./pure/errors";

enum SortOrder {
  NameAsc = "NameAsc",
  NameDesc = "NameDesc",
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

  constructor(private databaseManager: DatabaseManager) {
    super();

    this.currentDatabaseItem = databaseManager.currentDatabaseItem;

    this.push(
      this.databaseManager.onDidChangeDatabaseItem(
        this.handleDidChangeDatabaseItem,
      ),
    );
    this.push(
      this.databaseManager.onDidChangeCurrentDatabaseItem(
        this.handleDidChangeCurrentDatabaseItem,
      ),
    );
  }

  public get onDidChangeTreeData(): Event<DatabaseItem | undefined> {
    return this._onDidChangeTreeData.event;
  }

  private handleDidChangeDatabaseItem = (event: DatabaseChangedEvent): void => {
    // Note that events from the database manager are instances of DatabaseChangedEvent
    // and events fired by the UI are instances of DatabaseItem

    // When event.item is undefined, then the entire tree is refreshed.
    // When event.item is a db item, then only that item is refreshed.
    this._onDidChangeTreeData.fire(event.item);
  };

  private handleDidChangeCurrentDatabaseItem = (
    event: DatabaseChangedEvent,
  ): void => {
    if (this.currentDatabaseItem) {
      this._onDidChangeTreeData.fire(this.currentDatabaseItem);
    }
    this.currentDatabaseItem = event.item;
    if (this.currentDatabaseItem) {
      this._onDidChangeTreeData.fire(this.currentDatabaseItem);
    }
  };

  public getTreeItem(element: DatabaseItem): TreeItem {
    const item = new TreeItem(element.name);
    if (element === this.currentDatabaseItem) {
      item.iconPath = new ThemeIcon("check");

      item.contextValue = "currentDatabase";
    } else if (element.error !== undefined) {
      item.iconPath = new ThemeIcon("error", new ThemeColor("errorForeground"));
    }
    item.tooltip = element.databaseUri.fsPath;
    item.description = element.language;
    return item;
  }

  public getChildren(element?: DatabaseItem): ProviderResult<DatabaseItem[]> {
    if (element === undefined) {
      return this.databaseManager.databaseItems.slice(0).sort((db1, db2) => {
        switch (this.sortOrder) {
          case SortOrder.NameAsc:
            return db1.name.localeCompare(db2.name, env.language);
          case SortOrder.NameDesc:
            return db2.name.localeCompare(db1.name, env.language);
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

export class DatabaseUI extends DisposableObject {
  private treeDataProvider: DatabaseTreeDataProvider;

  public constructor(
    private app: App,
    private databaseManager: DatabaseManager,
    private readonly queryServer: QueryRunner | undefined,
    private readonly storagePath: string,
    readonly extensionPath: string,
  ) {
    super();

    this.treeDataProvider = this.push(
      new DatabaseTreeDataProvider(databaseManager),
    );
    this.push(
      window.createTreeView("codeQLDatabases", {
        treeDataProvider: this.treeDataProvider,
        canSelectMany: true,
      }),
    );
  }

  init() {
    void extLogger.log("Registering database panel commands.");
    this.push(
      commandRunnerWithProgress(
        "codeQL.setCurrentDatabase",
        this.handleSetCurrentDatabase,
        {
          title: "Importing database from archive",
        },
      ),
    );
    this.push(
      commandRunnerWithProgress(
        "codeQL.setDefaultTourDatabase",
        this.handleSetDefaultTourDatabase,
        {
          title: "Set Default Database for Codespace CodeQL Tour",
        },
      ),
    );
    this.push(
      commandRunnerWithProgress(
        "codeQL.upgradeCurrentDatabase",
        this.handleUpgradeCurrentDatabase,
        {
          title: "Upgrading current database",
          cancellable: true,
        },
      ),
    );
    this.push(
      commandRunnerWithProgress("codeQL.clearCache", this.handleClearCache, {
        title: "Clearing Cache",
      }),
    );

    this.push(
      commandRunnerWithProgress(
        "codeQLDatabases.chooseDatabaseFolder",
        this.handleChooseDatabaseFolder,
        {
          title: "Adding database from folder",
        },
      ),
    );
    this.push(
      commandRunnerWithProgress(
        "codeQLDatabases.chooseDatabaseArchive",
        this.handleChooseDatabaseArchive,
        {
          title: "Adding database from archive",
        },
      ),
    );
    this.push(
      commandRunnerWithProgress(
        "codeQLDatabases.chooseDatabaseInternet",
        this.handleChooseDatabaseInternet,
        {
          title: "Adding database from URL",
        },
      ),
    );
    this.push(
      commandRunnerWithProgress(
        "codeQLDatabases.chooseDatabaseGithub",
        async (progress: ProgressCallback, token: CancellationToken) => {
          const credentials = isCanary() ? this.app.credentials : undefined;
          await this.handleChooseDatabaseGithub(credentials, progress, token);
        },
        {
          title: "Adding database from GitHub",
        },
      ),
    );
    this.push(
      commandRunner(
        "codeQLDatabases.setCurrentDatabase",
        this.handleMakeCurrentDatabase,
      ),
    );
    this.push(
      commandRunner("codeQLDatabases.sortByName", this.handleSortByName),
    );
    this.push(
      commandRunner(
        "codeQLDatabases.sortByDateAdded",
        this.handleSortByDateAdded,
      ),
    );
    this.push(
      commandRunnerWithProgress(
        "codeQLDatabases.removeDatabase",
        this.handleRemoveDatabase,
        {
          title: "Removing database",
          cancellable: false,
        },
      ),
    );
    this.push(
      commandRunnerWithProgress(
        "codeQLDatabases.upgradeDatabase",
        this.handleUpgradeDatabase,
        {
          title: "Upgrading database",
          cancellable: true,
        },
      ),
    );
    this.push(
      commandRunner(
        "codeQLDatabases.renameDatabase",
        this.handleRenameDatabase,
      ),
    );
    this.push(
      commandRunner(
        "codeQLDatabases.openDatabaseFolder",
        this.handleOpenFolder,
      ),
    );
    this.push(
      commandRunner("codeQLDatabases.addDatabaseSource", this.handleAddSource),
    );
    this.push(
      commandRunner(
        "codeQLDatabases.removeOrphanedDatabases",
        this.handleRemoveOrphanedDatabases,
      ),
    );
  }

  private handleMakeCurrentDatabase = async (
    databaseItem: DatabaseItem,
  ): Promise<void> => {
    await this.databaseManager.setCurrentDatabaseItem(databaseItem);
  };

  handleChooseDatabaseFolder = async (
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> => {
    try {
      await this.chooseAndSetDatabase(true, progress, token);
    } catch (e) {
      void showAndLogExceptionWithTelemetry(
        redactableError(
          asError(e),
        )`Failed to choose and set database: ${getErrorMessage(e)}`,
      );
    }
  };

  private handleSetDefaultTourDatabase = async (
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> => {
    try {
      if (!workspace.workspaceFolders?.length) {
        throw new Error("No workspace folder is open.");
      } else {
        // This specifically refers to the database folder in
        // https://github.com/github/codespaces-codeql
        const uri = Uri.parse(
          `${workspace.workspaceFolders[0].uri}/.tours/codeql-tutorial-database`,
        );

        let databaseItem = this.databaseManager.findDatabaseItem(uri);
        const isTutorialDatabase = true;
        if (databaseItem === undefined) {
          databaseItem = await this.databaseManager.openDatabase(
            progress,
            token,
            uri,
            "CodeQL Tutorial Database",
            isTutorialDatabase,
          );
        }
        await this.databaseManager.setCurrentDatabaseItem(databaseItem);
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
  };

  private handleTourDependencies = async (): Promise<void> => {
    if (!workspace.workspaceFolders?.length) {
      throw new Error("No workspace folder is open.");
    } else {
      const tutorialQueriesPath = join(
        workspace.workspaceFolders[0].uri.fsPath,
        "tutorial-queries",
      );
      const cli = this.queryServer?.cliServer;
      if (!cli) {
        throw new Error("No CLI server found");
      }
      await cli.packInstall(tutorialQueriesPath);
    }
  };

  handleRemoveOrphanedDatabases = async (): Promise<void> => {
    void extLogger.log("Removing orphaned databases from workspace storage.");
    let dbDirs = undefined;

    if (
      !(await pathExists(this.storagePath)) ||
      !(await stat(this.storagePath)).isDirectory()
    ) {
      void extLogger.log(
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
      void extLogger.log("No orphaned databases found.");
      return;
    }

    // delete
    const failures = [] as string[];
    await Promise.all(
      dbDirs.map(async (dbDir) => {
        try {
          void extLogger.log(`Deleting orphaned database '${dbDir}'.`);
          await remove(dbDir);
        } catch (e) {
          void showAndLogExceptionWithTelemetry(
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
        `Failed to delete unused databases (${failures.join(
          ", ",
        )}).\nTo delete unused databases, please remove them manually from the storage folder ${dirname}.`,
      );
    }
  };

  handleChooseDatabaseArchive = async (
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> => {
    try {
      await this.chooseAndSetDatabase(false, progress, token);
    } catch (e: unknown) {
      void showAndLogExceptionWithTelemetry(
        redactableError(
          asError(e),
        )`Failed to choose and set database: ${getErrorMessage(e)}`,
      );
    }
  };

  handleChooseDatabaseInternet = async (
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<DatabaseItem | undefined> => {
    return await promptImportInternetDatabase(
      this.databaseManager,
      this.storagePath,
      progress,
      token,
      this.queryServer?.cliServer,
    );
  };

  handleChooseDatabaseGithub = async (
    credentials: Credentials | undefined,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<DatabaseItem | undefined> => {
    return await promptImportGithubDatabase(
      this.databaseManager,
      this.storagePath,
      credentials,
      progress,
      token,
      this.queryServer?.cliServer,
    );
  };

  async tryUpgradeCurrentDatabase(
    progress: ProgressCallback,
    token: CancellationToken,
  ) {
    await this.handleUpgradeCurrentDatabase(progress, token);
  }

  private handleSortByName = async () => {
    if (this.treeDataProvider.sortOrder === SortOrder.NameAsc) {
      this.treeDataProvider.sortOrder = SortOrder.NameDesc;
    } else {
      this.treeDataProvider.sortOrder = SortOrder.NameAsc;
    }
  };

  private handleSortByDateAdded = async () => {
    if (this.treeDataProvider.sortOrder === SortOrder.DateAddedAsc) {
      this.treeDataProvider.sortOrder = SortOrder.DateAddedDesc;
    } else {
      this.treeDataProvider.sortOrder = SortOrder.DateAddedAsc;
    }
  };

  private handleUpgradeCurrentDatabase = async (
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> => {
    await this.handleUpgradeDatabase(
      progress,
      token,
      this.databaseManager.currentDatabaseItem,
      [],
    );
  };

  private handleUpgradeDatabase = async (
    progress: ProgressCallback,
    token: CancellationToken,
    databaseItem: DatabaseItem | undefined,
    multiSelect: DatabaseItem[] | undefined,
  ): Promise<void> => {
    if (multiSelect?.length) {
      await Promise.all(
        multiSelect.map((dbItem) =>
          this.handleUpgradeDatabase(progress, token, dbItem, []),
        ),
      );
    }
    if (this.queryServer === undefined) {
      throw new Error(
        "Received request to upgrade database, but there is no running query server.",
      );
    }
    if (databaseItem === undefined) {
      throw new Error(
        "Received request to upgrade database, but no database was provided.",
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
  };

  private handleClearCache = async (
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> => {
    if (
      this.queryServer !== undefined &&
      this.databaseManager.currentDatabaseItem !== undefined
    ) {
      await this.queryServer.clearCacheInDatabase(
        this.databaseManager.currentDatabaseItem,
        progress,
        token,
      );
    }
  };

  private handleSetCurrentDatabase = async (
    progress: ProgressCallback,
    token: CancellationToken,
    uri: Uri,
  ): Promise<void> => {
    try {
      // Assume user has selected an archive if the file has a .zip extension
      if (uri.path.endsWith(".zip")) {
        await importArchiveDatabase(
          uri.toString(true),
          this.databaseManager,
          this.storagePath,
          progress,
          token,
          this.queryServer?.cliServer,
        );
      } else {
        await this.setCurrentDatabase(progress, token, uri);
      }
    } catch (e) {
      // rethrow and let this be handled by default error handling.
      throw new Error(
        `Could not set database to ${basename(
          uri.fsPath,
        )}. Reason: ${getErrorMessage(e)}`,
      );
    }
  };

  private handleRemoveDatabase = async (
    progress: ProgressCallback,
    token: CancellationToken,
    databaseItem: DatabaseItem,
    multiSelect: DatabaseItem[] | undefined,
  ): Promise<void> => {
    if (multiSelect?.length) {
      await Promise.all(
        multiSelect.map((dbItem) =>
          this.databaseManager.removeDatabaseItem(progress, token, dbItem),
        ),
      );
    } else {
      await this.databaseManager.removeDatabaseItem(
        progress,
        token,
        databaseItem,
      );
    }
  };

  private handleRenameDatabase = async (
    databaseItem: DatabaseItem,
    multiSelect: DatabaseItem[] | undefined,
  ): Promise<void> => {
    this.assertSingleDatabase(multiSelect);

    const newName = await window.showInputBox({
      prompt: "Choose new database name",
      value: databaseItem.name,
    });

    if (newName) {
      await this.databaseManager.renameDatabaseItem(databaseItem, newName);
    }
  };

  private handleOpenFolder = async (
    databaseItem: DatabaseItem,
    multiSelect: DatabaseItem[] | undefined,
  ): Promise<void> => {
    if (multiSelect?.length) {
      await Promise.all(
        multiSelect.map((dbItem) => env.openExternal(dbItem.databaseUri)),
      );
    } else {
      await env.openExternal(databaseItem.databaseUri);
    }
  };

  /**
   * Adds the source folder of a CodeQL database to the workspace.
   * When a database is first added in the "Databases" view, its source folder is added to the workspace.
   * If the source folder is removed from the workspace for some reason, we want to be able to re-add it if need be.
   */
  private handleAddSource = async (
    databaseItem: DatabaseItem,
    multiSelect: DatabaseItem[] | undefined,
  ): Promise<void> => {
    if (multiSelect?.length) {
      for (const dbItem of multiSelect) {
        await this.databaseManager.addDatabaseSourceArchiveFolder(dbItem);
      }
    } else {
      await this.databaseManager.addDatabaseSourceArchiveFolder(databaseItem);
    }
  };

  /**
   * Return the current database directory. If we don't already have a
   * current database, ask the user for one, and return that, or
   * undefined if they cancel.
   */
  public async getDatabaseItem(
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<DatabaseItem | undefined> {
    if (this.databaseManager.currentDatabaseItem === undefined) {
      await this.chooseAndSetDatabase(false, progress, token);
    }

    return this.databaseManager.currentDatabaseItem;
  }

  private async setCurrentDatabase(
    progress: ProgressCallback,
    token: CancellationToken,
    uri: Uri,
  ): Promise<DatabaseItem | undefined> {
    let databaseItem = this.databaseManager.findDatabaseItem(uri);
    if (databaseItem === undefined) {
      databaseItem = await this.databaseManager.openDatabase(
        progress,
        token,
        uri,
      );
    }
    await this.databaseManager.setCurrentDatabaseItem(databaseItem);

    return databaseItem;
  }

  /**
   * Ask the user for a database directory. Returns the chosen database, or `undefined` if the
   * operation was canceled.
   */
  private async chooseAndSetDatabase(
    byFolder: boolean,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<DatabaseItem | undefined> {
    const uri = await chooseDatabaseDir(byFolder);
    if (!uri) {
      return undefined;
    }

    if (byFolder) {
      const fixedUri = await this.fixDbUri(uri);
      // we are selecting a database folder
      return await this.setCurrentDatabase(progress, token, fixedUri);
    } else {
      // we are selecting a database archive. Must unzip into a workspace-controlled area
      // before importing.
      return await importArchiveDatabase(
        uri.toString(true),
        this.databaseManager,
        this.storagePath,
        progress,
        token,
        this.queryServer?.cliServer,
      );
    }
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

  private assertSingleDatabase(
    multiSelect: DatabaseItem[] = [],
    message = "Please select a single database.",
  ) {
    if (multiSelect.length > 1) {
      throw new Error(message);
    }
  }
}
