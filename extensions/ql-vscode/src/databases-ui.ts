import { DisposableObject } from "semmle-vscode-utils";
import { DatabaseItem, DatabaseManager } from "./databases";
import { TreeDataProvider, Event, EventEmitter, ExtensionContext, TreeItem, ProviderResult, window, commands, Uri } from "vscode";
import * as qsClient from './queryserver-client';
import * as path from 'path';
import { clearCacheInDatabase, upgradeDatabase } from "./queries";
import { logger } from "./logging";

type ThemableIconPath = { light: string, dark: string } | string;

/**
 * Path to icons to display next to currently selected database.
 */
const SELECTED_DATABASE_ICON: ThemableIconPath = {
  light: 'media/check-light-mode.svg',
  dark: 'media/check-dark-mode.svg',
};

/**
 * Path to icon to display next to an invalid database.
 */
const INVALID_DATABASE_ICON: ThemableIconPath = 'media/red-x.svg';

function joinThemableIconPath(base: string, iconPath: ThemableIconPath): ThemableIconPath {
  if (typeof iconPath == 'object')
    return {
      light: path.join(base, iconPath.light),
      dark: path.join(base, iconPath.dark)
    };
  else
    return path.join(base, iconPath);
}

/**
 * Tree data provider for the databases view.
 */
class DatabaseTreeDataProvider extends DisposableObject
  implements TreeDataProvider<DatabaseItem> {

  private readonly _onDidChangeTreeData = new EventEmitter<DatabaseItem | undefined>();
  private currentDatabaseItem: DatabaseItem | undefined;

  constructor(private ctx: ExtensionContext, private databaseManager: DatabaseManager) {
    super();

    this.currentDatabaseItem = databaseManager.currentDatabaseItem;

    this.push(this.databaseManager.onDidChangeDatabaseItem(this.handleDidChangeDatabaseItem));
    this.push(this.databaseManager.onDidChangeCurrentDatabaseItem(
      this.handleDidChangeCurrentDatabaseItem));
  }

  public get onDidChangeTreeData(): Event<DatabaseItem | undefined> {
    return this._onDidChangeTreeData.event;
  }

  private handleDidChangeDatabaseItem = (databaseItem: DatabaseItem | undefined): void => {
    this._onDidChangeTreeData.fire(databaseItem);
  }

  private handleDidChangeCurrentDatabaseItem = (databaseItem: DatabaseItem | undefined): void => {
    if (this.currentDatabaseItem) {
      this._onDidChangeTreeData.fire(this.currentDatabaseItem);
    }
    this.currentDatabaseItem = databaseItem;
    if (this.currentDatabaseItem) {
      this._onDidChangeTreeData.fire(this.currentDatabaseItem);
    }
  }

  public getTreeItem(element: DatabaseItem): TreeItem {
    const item = new TreeItem(element.name);
    if (element === this.currentDatabaseItem) {
      item.iconPath = joinThemableIconPath(this.ctx.extensionPath, SELECTED_DATABASE_ICON);
    } else if (element.error !== undefined) {
      item.iconPath = joinThemableIconPath(this.ctx.extensionPath, INVALID_DATABASE_ICON);
    }
    item.tooltip = element.snapshotUri.fsPath;
    return item;
  }

  public getChildren(element?: DatabaseItem): ProviderResult<DatabaseItem[]> {
    if (element === undefined) {
      return this.databaseManager.databaseItems.slice(0);
    }
    else {
      return [];
    }
  }

  public getParent(element: DatabaseItem): ProviderResult<DatabaseItem> {
    return null;
  }

  public getCurrent(): DatabaseItem | undefined {
    return this.currentDatabaseItem;
  }
}

/** Gets the first element in the given list, if any, or undefined if the list is empty or undefined. */
function getFirst(list: Uri[] | undefined): Uri | undefined {
  if (list === undefined || list.length === 0) {
    return undefined;
  }
  else {
    return list[0];
  }
}

/**
 * Displays file selection dialog. Expects the user to choose a
 * snapshot directory, which should be the parent directory of a
 * directory of the form `db-[language]`, for example, `db-cpp`.
 *
 * XXX: no validation is done other than checking the directory name
 * to make sure it really is a database directory.
 */
async function chooseDatabaseDir(): Promise<Uri | undefined> {
  const chosen = await window.showOpenDialog({
    openLabel: 'Choose Snapshot',
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false
  });
  return getFirst(chosen);
}

/**
 * Displays file selection dialog. Expects the user to choose a
 * QL database scheme file with the extension `.dbscheme`.
 */
async function chooseDbSchemeFile(): Promise<Uri | undefined> {
  const chosen = await window.showOpenDialog({
    openLabel: 'Choose QL database scheme',
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {'QL database scheme files': ['dbscheme']}
  });
  return getFirst(chosen);
}

/**
 * Displays file selection dialog. Expects the user to choose a
 * QL database scheme file with the extension `.dbscheme`.
 */
async function chooseUpgradesDirectory(): Promise<Uri | undefined> {
  const chosen = await window.showOpenDialog({
    openLabel: 'Choose QL database upgrades directory',
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false
  });
  return getFirst(chosen);
}

export class DatabaseUI extends DisposableObject {
  public constructor(private ctx: ExtensionContext, private databaseManager: DatabaseManager,
    private readonly queryServer: qsClient.Server | undefined) {

    super();

    const treeDataProvider = this.push(new DatabaseTreeDataProvider(ctx, databaseManager));
    this.push(window.createTreeView('qlDatabases', { treeDataProvider }));

    ctx.subscriptions.push(commands.registerCommand('ql.chooseDatabase', this.handleChooseDatabase));
    ctx.subscriptions.push(commands.registerCommand('ql.setCurrentDatabase', this.handleSetCurrentDatabase));
    ctx.subscriptions.push(commands.registerCommand('ql.upgradeCurrentDatabase', this.handleUpgradeCurrentDatabase));
    ctx.subscriptions.push(commands.registerCommand('ql.clearCache', this.handleClearCache));
    ctx.subscriptions.push(commands.registerCommand('qlDatabases.setCurrentDatabase', this.handleMakeCurrentDatabase));
    ctx.subscriptions.push(commands.registerCommand('qlDatabases.removeDatabase', this.handleRemoveDatabase));
    ctx.subscriptions.push(commands.registerCommand('qlDatabases.upgradeDatabase', this.handleUpgradeDatabase));
  }

  private handleMakeCurrentDatabase = async (databaseItem: DatabaseItem): Promise<void> => {
    await this.databaseManager.setCurrentDatabaseItem(databaseItem);
  }

  private handleChooseDatabase = async (): Promise<DatabaseItem | undefined> => {
    return await this.chooseAndSetDatabase();
  }

  private handleUpgradeCurrentDatabase = async (): Promise<void> => {
    await this.handleUpgradeDatabase(this.databaseManager.currentDatabaseItem);
  }

  private handleUpgradeDatabase = async (databaseItem: DatabaseItem | undefined): Promise<void> => {
    if (this.queryServer === undefined) {
      logger.log('Received request to upgrade database, but there is no running query server.');
      return;
    }
    if (databaseItem === undefined) {
      logger.log('Received request to upgrade database, but no database was provided.');
      return;
    }
    // TODO: use the DB scheme and upgrades paths configured for the current workspace
    const targetDbSchemeUri = await chooseDbSchemeFile();
    if (targetDbSchemeUri === undefined)
      return;
    const upgradesDirectory = await chooseUpgradesDirectory();
    if (upgradesDirectory === undefined)
      return;
    await upgradeDatabase(this.queryServer, databaseItem, targetDbSchemeUri, upgradesDirectory);
  }

  private handleClearCache = async (): Promise<void> => {
    if ((this.queryServer !== undefined) &&
      (this.databaseManager.currentDatabaseItem !== undefined)) {

      await clearCacheInDatabase(this.queryServer, this.databaseManager.currentDatabaseItem);
    }
  }

  private handleSetCurrentDatabase = async (uri: Uri): Promise<DatabaseItem | undefined> => {
    return await this.setCurrentDatabase(uri);
  }

  private handleRemoveDatabase = (databaseItem: DatabaseItem): void => {
    this.databaseManager.removeDatabaseItem(databaseItem);
  }

  /**
   * Return the current database directory. If we don't already have a
   * current database, ask the user for one, and return that, or
   * undefined if they cancel.
   */
  public async getDatabaseItem(): Promise<DatabaseItem | undefined> {
    if (this.databaseManager.currentDatabaseItem === undefined) {
      await this.chooseAndSetDatabase();
    }

    return this.databaseManager.currentDatabaseItem;
  }

  private async setCurrentDatabase(uri: Uri): Promise<DatabaseItem | undefined> {
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
  private async chooseAndSetDatabase(): Promise<DatabaseItem | undefined> {
    const uri = await chooseDatabaseDir();
    if (uri !== undefined) {
      return await this.setCurrentDatabase(uri);
    }
    else {
      return undefined;
    }
  }
}
