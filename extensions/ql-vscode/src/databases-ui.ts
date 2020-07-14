import * as path from 'path';
import { DisposableObject } from './vscode-utils/disposable-object';
import {
  commands,
  Event,
  EventEmitter,
  ExtensionContext,
  ProviderResult,
  TreeDataProvider,
  TreeItem,
  Uri,
  window,
  env,
} from 'vscode';
import * as fs from 'fs-extra';

import * as cli from './cli';
import {
  DatabaseItem,
  DatabaseManager,
  getUpgradesDirectories,
} from './databases';
import { getOnDiskWorkspaceFolders, showAndLogErrorMessage } from './helpers';
import { logger } from './logging';
import { clearCacheInDatabase, UserCancellationException } from './run-queries';
import * as qsClient from './queryserver-client';
import { upgradeDatabase } from './upgrades';
import {
  importArchiveDatabase,
  promptImportInternetDatabase,
  promptImportLgtmDatabase,
} from './databaseFetcher';

type ThemableIconPath = { light: string; dark: string } | string;

/**
 * Path to icons to display next to currently selected database.
 */
const SELECTED_DATABASE_ICON: ThemableIconPath = {
  light: 'media/light/check.svg',
  dark: 'media/dark/check.svg',
};

/**
 * Path to icon to display next to an invalid database.
 */
const INVALID_DATABASE_ICON: ThemableIconPath = 'media/red-x.svg';

function joinThemableIconPath(
  base: string,
  iconPath: ThemableIconPath
): ThemableIconPath {
  if (typeof iconPath == 'object')
    return {
      light: path.join(base, iconPath.light),
      dark: path.join(base, iconPath.dark),
    };
  else return path.join(base, iconPath);
}

enum SortOrder {
  NameAsc = 'NameAsc',
  NameDesc = 'NameDesc',
  DateAddedAsc = 'DateAddedAsc',
  DateAddedDesc = 'DateAddedDesc',
}

/**
 * Tree data provider for the databases view.
 */
class DatabaseTreeDataProvider extends DisposableObject
  implements TreeDataProvider<DatabaseItem> {
  private _sortOrder = SortOrder.NameAsc;

  private readonly _onDidChangeTreeData = new EventEmitter<
    DatabaseItem | undefined
  >();
  private currentDatabaseItem: DatabaseItem | undefined;

  constructor(
    private ctx: ExtensionContext,
    private databaseManager: DatabaseManager
  ) {
    super();

    this.currentDatabaseItem = databaseManager.currentDatabaseItem;

    this.push(
      this.databaseManager.onDidChangeDatabaseItem(
        this.handleDidChangeDatabaseItem
      )
    );
    this.push(
      this.databaseManager.onDidChangeCurrentDatabaseItem(
        this.handleDidChangeCurrentDatabaseItem
      )
    );
  }

  public get onDidChangeTreeData(): Event<DatabaseItem | undefined> {
    return this._onDidChangeTreeData.event;
  }

  private handleDidChangeDatabaseItem = (
    databaseItem: DatabaseItem | undefined
  ): void => {
    this._onDidChangeTreeData.fire(databaseItem);
  };

  private handleDidChangeCurrentDatabaseItem = (
    databaseItem: DatabaseItem | undefined
  ): void => {
    if (this.currentDatabaseItem) {
      this._onDidChangeTreeData.fire(this.currentDatabaseItem);
    }
    this.currentDatabaseItem = databaseItem;
    if (this.currentDatabaseItem) {
      this._onDidChangeTreeData.fire(this.currentDatabaseItem);
    }
  };

  public getTreeItem(element: DatabaseItem): TreeItem {
    const item = new TreeItem(element.name);
    if (element === this.currentDatabaseItem) {
      item.iconPath = joinThemableIconPath(
        this.ctx.extensionPath,
        SELECTED_DATABASE_ICON
      );
    } else if (element.error !== undefined) {
      item.iconPath = joinThemableIconPath(
        this.ctx.extensionPath,
        INVALID_DATABASE_ICON
      );
    }
    item.tooltip = element.databaseUri.fsPath;
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
    this._onDidChangeTreeData.fire();
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
    openLabel: byFolder ? 'Choose Database folder' : 'Choose Database archive',
    canSelectFiles: !byFolder,
    canSelectFolders: byFolder,
    canSelectMany: false,
    filters: byFolder ? {} : { Archives: ['zip'] },
  });
  return getFirst(chosen);
}

export class DatabaseUI extends DisposableObject {
  private treeDataProvider: DatabaseTreeDataProvider;

  public constructor(
    ctx: ExtensionContext,
    private cliserver: cli.CodeQLCliServer,
    private databaseManager: DatabaseManager,
    private readonly queryServer: qsClient.QueryServerClient | undefined,
    private readonly storagePath: string
  ) {
    super();

    this.treeDataProvider = this.push(
      new DatabaseTreeDataProvider(ctx, databaseManager)
    );
    this.push(
      window.createTreeView('codeQLDatabases', {
        treeDataProvider: this.treeDataProvider,
        canSelectMany: true,
      })
    );

    logger.log('Registering database panel commands.');
    ctx.subscriptions.push(
      commands.registerCommand(
        'codeQL.setCurrentDatabase',
        this.handleSetCurrentDatabase
      )
    );
    ctx.subscriptions.push(
      commands.registerCommand(
        'codeQL.upgradeCurrentDatabase',
        this.handleUpgradeCurrentDatabase
      )
    );
    ctx.subscriptions.push(
      commands.registerCommand('codeQL.clearCache', this.handleClearCache)
    );

    ctx.subscriptions.push(
      commands.registerCommand(
        'codeQLDatabases.chooseDatabaseFolder',
        this.handleChooseDatabaseFolder
      )
    );
    ctx.subscriptions.push(
      commands.registerCommand(
        'codeQLDatabases.chooseDatabaseArchive',
        this.handleChooseDatabaseArchive
      )
    );
    ctx.subscriptions.push(
      commands.registerCommand(
        'codeQLDatabases.chooseDatabaseInternet',
        this.handleChooseDatabaseInternet
      )
    );
    ctx.subscriptions.push(
      commands.registerCommand(
        'codeQLDatabases.chooseDatabaseLgtm',
        this.handleChooseDatabaseLgtm
      )
    );
    ctx.subscriptions.push(
      commands.registerCommand(
        'codeQLDatabases.setCurrentDatabase',
        this.handleMakeCurrentDatabase
      )
    );
    ctx.subscriptions.push(
      commands.registerCommand(
        'codeQLDatabases.sortByName',
        this.handleSortByName
      )
    );
    ctx.subscriptions.push(
      commands.registerCommand(
        'codeQLDatabases.sortByDateAdded',
        this.handleSortByDateAdded
      )
    );
    ctx.subscriptions.push(
      commands.registerCommand(
        'codeQLDatabases.removeDatabase',
        this.handleRemoveDatabase
      )
    );
    ctx.subscriptions.push(
      commands.registerCommand(
        'codeQLDatabases.upgradeDatabase',
        this.handleUpgradeDatabase
      )
    );
    ctx.subscriptions.push(
      commands.registerCommand(
        'codeQLDatabases.renameDatabase',
        this.handleRenameDatabase
      )
    );
    ctx.subscriptions.push(
      commands.registerCommand(
        'codeQLDatabases.openDatabaseFolder',
        this.handleOpenFolder
      )
    );
  }

  private handleMakeCurrentDatabase = async (
    databaseItem: DatabaseItem
  ): Promise<void> => {
    await this.databaseManager.setCurrentDatabaseItem(databaseItem);
  };

  handleChooseDatabaseFolder = async (): Promise<DatabaseItem | undefined> => {
    try {
      return await this.chooseAndSetDatabase(true);
    } catch (e) {
      showAndLogErrorMessage(e.message);
      return undefined;
    }
  };

  handleChooseDatabaseArchive = async (): Promise<DatabaseItem | undefined> => {
    try {
      return await this.chooseAndSetDatabase(false);
    } catch (e) {
      showAndLogErrorMessage(e.message);
      return undefined;
    }
  };

  handleChooseDatabaseInternet = async (): Promise<
    DatabaseItem | undefined
  > => {
    return await promptImportInternetDatabase(
      this.databaseManager,
      this.storagePath
    );
  };

  handleChooseDatabaseLgtm = async (): Promise<DatabaseItem | undefined> => {
    return await promptImportLgtmDatabase(
      this.databaseManager,
      this.storagePath
    );
  };

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

  private handleUpgradeCurrentDatabase = async (): Promise<void> => {
    await this.handleUpgradeDatabase(
      this.databaseManager.currentDatabaseItem,
      []
    );
  };

  private handleUpgradeDatabase = async (
    databaseItem: DatabaseItem | undefined,
    multiSelect: DatabaseItem[] | undefined
  ): Promise<void> => {
    try {
      if (multiSelect?.length) {
        await Promise.all(
          multiSelect.map((dbItem) => this.handleUpgradeDatabase(dbItem, []))
        );
      }
      if (this.queryServer === undefined) {
        logger.log(
          'Received request to upgrade database, but there is no running query server.'
        );
        return;
      }
      if (databaseItem === undefined) {
        logger.log(
          'Received request to upgrade database, but no database was provided.'
        );
        return;
      }
      if (databaseItem.contents === undefined) {
        logger.log(
          'Received request to upgrade database, but database contents could not be found.'
        );
        return;
      }
      if (databaseItem.contents.dbSchemeUri === undefined) {
        logger.log(
          'Received request to upgrade database, but database has no schema.'
        );
        return;
      }

      // Search for upgrade scripts in any workspace folders available
      const searchPath: string[] = getOnDiskWorkspaceFolders();

      const upgradeInfo = await this.cliserver.resolveUpgrades(
        databaseItem.contents.dbSchemeUri.fsPath,
        searchPath
      );

      const { scripts, finalDbscheme } = upgradeInfo;

      if (finalDbscheme === undefined) {
        logger.log('Could not determine target dbscheme to upgrade to.');
        return;
      }
      const targetDbSchemeUri = Uri.file(finalDbscheme);

      await upgradeDatabase(
        this.queryServer,
        databaseItem,
        targetDbSchemeUri,
        getUpgradesDirectories(scripts)
      );
    } catch (e) {
      if (e instanceof UserCancellationException) {
        logger.log(e.message);
      } else throw e;
    }
  };

  private handleClearCache = async (): Promise<void> => {
    if (
      this.queryServer !== undefined &&
      this.databaseManager.currentDatabaseItem !== undefined
    ) {
      await clearCacheInDatabase(
        this.queryServer,
        this.databaseManager.currentDatabaseItem
      );
    }
  };

  private handleSetCurrentDatabase = async (
    uri: Uri
  ): Promise<DatabaseItem | undefined> => {
    try {
      // Assume user has selected an archive if the file has a .zip extension
      if (uri.path.endsWith('.zip')) {
        return await importArchiveDatabase(
          uri.toString(true),
          this.databaseManager,
          this.storagePath
        );
      }

      return await this.setCurrentDatabase(uri);
    } catch (e) {
      showAndLogErrorMessage(
        `Could not set database to ${path.basename(uri.fsPath)}. Reason: ${
        e.message
        }`
      );
      return undefined;
    }
  };

  private handleRemoveDatabase = (
    databaseItem: DatabaseItem,
    multiSelect: DatabaseItem[] | undefined
  ): void => {
    try {
      if (multiSelect?.length) {
        multiSelect.forEach((dbItem) =>
          this.databaseManager.removeDatabaseItem(dbItem)
        );
      } else {
        this.databaseManager.removeDatabaseItem(databaseItem);
      }
    } catch (e) {
      showAndLogErrorMessage(e.message);
    }
  };

  private handleRenameDatabase = async (
    databaseItem: DatabaseItem,
    multiSelect: DatabaseItem[] | undefined
  ): Promise<void> => {
    try {
      this.assertSingleDatabase(multiSelect);

      const newName = await window.showInputBox({
        prompt: 'Choose new database name',
        value: databaseItem.name,
      });

      if (newName) {
        this.databaseManager.renameDatabaseItem(databaseItem, newName);
      }
    } catch (e) {
      showAndLogErrorMessage(e.message);
    }
  };

  private handleOpenFolder = async (
    databaseItem: DatabaseItem,
    multiSelect: DatabaseItem[] | undefined
  ): Promise<void> => {
    try {
      if (multiSelect?.length) {
        await Promise.all(
          multiSelect.map((dbItem) => env.openExternal(dbItem.databaseUri))
        );
      } else {
        await env.openExternal(databaseItem.databaseUri);
      }
    } catch (e) {
      showAndLogErrorMessage(e.message);
    }
  };

  /**
   * Return the current database directory. If we don't already have a
   * current database, ask the user for one, and return that, or
   * undefined if they cancel.
   */
  public async getDatabaseItem(): Promise<DatabaseItem | undefined> {
    if (this.databaseManager.currentDatabaseItem === undefined) {
      await this.chooseAndSetDatabase(false);
    }

    return this.databaseManager.currentDatabaseItem;
  }

  private async setCurrentDatabase(
    uri: Uri
  ): Promise<DatabaseItem | undefined> {
    let databaseItem = this.databaseManager.findDatabaseItem(uri);
    if (databaseItem === undefined) {
      databaseItem = await this.databaseManager.openDatabase(uri);
    }
    await this.databaseManager.setCurrentDatabaseItem(databaseItem);

    return databaseItem;
  }

  /**
   * Ask the user for a database directory. Returns the chosen database, or `undefined` if the
   * operation was canceled.
   */
  private async chooseAndSetDatabase(
    byFolder: boolean
  ): Promise<DatabaseItem | undefined> {
    const uri = await chooseDatabaseDir(byFolder);

    if (!uri) {
      return undefined;
    }

    if (byFolder) {
      const fixedUri = await this.fixDbUri(uri);
      // we are selecting a database folder
      return await this.setCurrentDatabase(fixedUri);
    } else {
      // we are selecting a database archive. Must unzip into a workspace-controlled area
      // before importing.
      return await importArchiveDatabase(
        uri.toString(true),
        this.databaseManager,
        this.storagePath
      );
    }
  }

  /**
   * Perform some heuristics to ensure a proper database location is chosen.
   *
   * 1. If the selected URI to add is a file, choose the containing directory
   * 2. If the selected URI is a directory matching db-*, choose the containing directory
   * 3. choose the current directory
   *
   * @param uri a URI that is a datbase folder or inside it
   *
   * @return the actual database folder found by using the heuristics above.
   */
  private async fixDbUri(uri: Uri): Promise<Uri> {
    let dbPath = uri.fsPath;
    if ((await fs.stat(dbPath)).isFile()) {
      dbPath = path.dirname(dbPath);
    }

    if (isLikelyDbFolder(dbPath)) {
      dbPath = path.dirname(dbPath);
    }
    return Uri.file(dbPath);
  }

  private assertSingleDatabase(
    multiSelect: DatabaseItem[] = [],
    message = 'Please select a single database.'
  ) {
    if (multiSelect.length > 1) {
      throw new Error(message);
    }
  }
}

const dbRegeEx = /^db-(javascript|go|cpp|java|python)$/;
function isLikelyDbFolder(dbPath: string) {
  return path.basename(dbPath).match(dbRegeEx);
}
