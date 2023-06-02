import vscode, { ExtensionContext } from "vscode";
import { extLogger, Logger } from "../../common";
import { DisposableObject } from "../../pure/disposable-object";
import { App } from "../../common/app";
import { QueryRunner } from "../../query-server";
import * as cli from "../../codeql-cli/cli";
import { ProgressCallback } from "../../common/vscode/progress";
import {
  getAutogenerateQlPacks,
  isCodespacesTemplate,
  setAutogenerateQlPacks,
} from "../../config";
import { join } from "path";
import { FullDatabaseOptions } from "./database-options";
import { DatabaseItemImpl } from "./database-item-impl";
import {
  getFirstWorkspaceFolder,
  isFolderAlreadyInWorkspace,
  isQueryLanguage,
  showNeverAskAgainDialog,
} from "../../helpers";
import { existsSync } from "fs";
import { QlPackGenerator } from "../../qlpack-generator";
import { asError, getErrorMessage } from "../../pure/helpers-pure";
import { DatabaseItem } from "./database-item";
import { remove } from "fs-extra";
import { containsPath } from "../../pure/files";
import { DatabaseChangedEvent, DatabaseEventKind } from "./database-events";
import { DatabaseResolver } from "./database-resolver";
import { DatabasePersistenceManager } from "./database-persistence-manager";
import { getPrimaryLanguage } from "./helpers";

/**
 * A promise that resolves to an event's result value when the event
 * `event` fires. If waiting for the event takes too long (by default
 * >1000ms) log a warning, and resolve to undefined.
 */
function eventFired<T>(
  event: vscode.Event<T>,
  timeoutMs = 1000,
): Promise<T | undefined> {
  return new Promise((res, _rej) => {
    const timeout = setTimeout(() => {
      void extLogger.log(
        `Waiting for event ${event} timed out after ${timeoutMs}ms`,
      );
      res(undefined);
      dispose();
    }, timeoutMs);
    const disposable = event((e) => {
      res(e);
      dispose();
    });
    function dispose() {
      clearTimeout(timeout);
      disposable.dispose();
    }
  });
}

export class DatabaseManager extends DisposableObject {
  private readonly _onDidChangeDatabaseItem = this.push(
    new vscode.EventEmitter<DatabaseChangedEvent>(),
  );

  readonly onDidChangeDatabaseItem = this._onDidChangeDatabaseItem.event;

  private readonly _onDidChangeCurrentDatabaseItem = this.push(
    new vscode.EventEmitter<DatabaseChangedEvent>(),
  );
  readonly onDidChangeCurrentDatabaseItem =
    this._onDidChangeCurrentDatabaseItem.event;

  private readonly _databaseItems: DatabaseItemImpl[] = [];
  private _currentDatabaseItem: DatabaseItem | undefined = undefined;

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly app: App,
    private readonly qs: QueryRunner,
    private readonly cli: cli.CodeQLCliServer,
    private readonly persistenceManager: DatabasePersistenceManager,
    public logger: Logger,
  ) {
    super();

    qs.onStart(this.reregisterDatabases.bind(this));
  }

  /**
   * Creates a {@link DatabaseItem} for the specified database, and adds it to the list of open
   * databases.
   */
  public async openDatabase(
    progress: ProgressCallback,
    token: vscode.CancellationToken,
    uri: vscode.Uri,
    makeSelected = true,
    displayName?: string,
    isTutorialDatabase?: boolean,
  ): Promise<DatabaseItem> {
    const databaseItem = await this.createDatabaseItem(uri, displayName);

    return await this.addExistingDatabaseItem(
      databaseItem,
      progress,
      makeSelected,
      token,
      isTutorialDatabase,
    );
  }

  /**
   * Adds a {@link DatabaseItem} to the list of open databases, if that database is not already on
   * the list.
   *
   * Typically, the item will have been created by {@link createOrOpenDatabaseItem} or {@link openDatabase}.
   */
  private async addExistingDatabaseItem(
    databaseItem: DatabaseItemImpl,
    progress: ProgressCallback,
    makeSelected: boolean,
    token: vscode.CancellationToken,
    isTutorialDatabase?: boolean,
  ): Promise<DatabaseItem> {
    const existingItem = this.findDatabaseItem(databaseItem.databaseUri);
    if (existingItem !== undefined) {
      if (makeSelected) {
        await this.setCurrentDatabaseItem(existingItem);
      }
      return existingItem;
    }

    await this.addDatabaseItem(progress, token, databaseItem);
    if (makeSelected) {
      await this.setCurrentDatabaseItem(databaseItem);
    }
    await this.addDatabaseSourceArchiveFolder(databaseItem);

    if (isCodespacesTemplate() && !isTutorialDatabase) {
      await this.createSkeletonPacks(databaseItem);
    }

    return databaseItem;
  }

  /**
   * Creates a {@link DatabaseItem} for the specified database, without adding it to the list of
   * open databases.
   */
  private async createDatabaseItem(
    uri: vscode.Uri,
    displayName: string | undefined,
  ): Promise<DatabaseItemImpl> {
    const contents = await DatabaseResolver.resolveDatabaseContents(uri);
    const fullOptions: FullDatabaseOptions = {
      // If a displayName is not passed in, the basename of folder containing the database is used.
      displayName,
      dateAdded: Date.now(),
      language: await getPrimaryLanguage(this.cli, uri.fsPath),
    };
    const databaseItem = new DatabaseItemImpl(uri, contents, fullOptions);

    return databaseItem;
  }

  /**
   * If the specified database is already on the list of open databases, returns that database's
   * {@link DatabaseItem}. Otherwise, creates a new {@link DatabaseItem} without adding it to the
   * list of open databases.
   *
   * The {@link DatabaseItem} can be added to the list of open databases later, via {@link addExistingDatabaseItem}.
   */
  public async createOrOpenDatabaseItem(
    uri: vscode.Uri,
  ): Promise<DatabaseItem> {
    const existingItem = this.findDatabaseItem(uri);
    if (existingItem !== undefined) {
      // Use the one we already have.
      return existingItem;
    }

    // We don't add this to the list automatically, but the user can add it later.
    return this.createDatabaseItem(uri, undefined);
  }

  public async createSkeletonPacks(databaseItem: DatabaseItem) {
    if (databaseItem === undefined) {
      void this.logger.log(
        "Could not create QL pack because no database is selected. Please add a database.",
      );
      return;
    }

    if (databaseItem.language === "") {
      void this.logger.log(
        "Could not create skeleton QL pack because the selected database's language is not set.",
      );
      return;
    }

    if (!isQueryLanguage(databaseItem.language)) {
      void this.logger.log(
        "Could not create skeleton QL pack because the selected database's language is not supported.",
      );
      return;
    }

    const firstWorkspaceFolder = getFirstWorkspaceFolder();
    const folderName = `codeql-custom-queries-${databaseItem.language}`;

    if (
      existsSync(join(firstWorkspaceFolder, folderName)) ||
      isFolderAlreadyInWorkspace(folderName)
    ) {
      return;
    }

    if (getAutogenerateQlPacks() === "never") {
      return;
    }

    const answer = await showNeverAskAgainDialog(
      `We've noticed you don't have a CodeQL pack available to analyze this database. Can we set up a query pack for you?`,
    );

    if (answer === "No") {
      return;
    }

    if (answer === "No, and never ask me again") {
      await setAutogenerateQlPacks("never");
      return;
    }

    try {
      const qlPackGenerator = new QlPackGenerator(
        folderName,
        databaseItem.language,
        this.cli,
        firstWorkspaceFolder,
      );
      await qlPackGenerator.generate();
    } catch (e: unknown) {
      void this.logger.log(
        `Could not create skeleton QL pack: ${getErrorMessage(e)}`,
      );
    }
  }

  private async reregisterDatabases(
    progress: ProgressCallback,
    token: vscode.CancellationToken,
  ) {
    let completed = 0;
    await Promise.all(
      this._databaseItems.map(async (databaseItem) => {
        await this.registerDatabase(progress, token, databaseItem);
        completed++;
        progress({
          maxStep: this._databaseItems.length,
          step: completed,
          message: "Re-registering databases",
        });
      }),
    );
  }

  public async addDatabaseSourceArchiveFolder(item: DatabaseItem) {
    // The folder may already be in workspace state from a previous
    // session. If not, add it.
    const index = this.getDatabaseWorkspaceFolderIndex(item);
    if (index === -1) {
      // Add that filesystem as a folder to the current workspace.
      //
      // It's important that we add workspace folders to the end,
      // rather than beginning of the list, because the first
      // workspace folder is special; if it gets updated, the entire
      // extension host is restarted. (cf.
      // https://github.com/microsoft/vscode/blob/e0d2ed907d1b22808c56127678fb436d604586a7/src/vs/workbench/contrib/relauncher/browser/relauncher.contribution.ts#L209-L214)
      //
      // This is undesirable, as we might be adding and removing many
      // workspace folders as the user adds and removes databases.
      const end = (vscode.workspace.workspaceFolders || []).length;

      const msg = item.verifyZippedSources();
      if (msg) {
        void extLogger.log(`Could not add source folder because ${msg}`);
        return;
      }

      const uri = item.getSourceArchiveExplorerUri();
      void extLogger.log(
        `Adding workspace folder for ${item.name} source archive at index ${end}`,
      );
      if ((vscode.workspace.workspaceFolders || []).length < 2) {
        // Adding this workspace folder makes the workspace
        // multi-root, which may surprise the user. Let them know
        // we're doing this.
        void vscode.window.showInformationMessage(
          `Adding workspace folder for source archive of database ${item.name}.`,
        );
      }
      vscode.workspace.updateWorkspaceFolders(end, 0, {
        name: `[${item.name} source archive]`,
        uri,
      });
      // vscode api documentation says we must to wait for this event
      // between multiple `updateWorkspaceFolders` calls.
      await eventFired(vscode.workspace.onDidChangeWorkspaceFolders);
    }
  }

  public get databaseItems(): readonly DatabaseItem[] {
    return this._databaseItems;
  }

  public get currentDatabaseItem(): DatabaseItem | undefined {
    return this._currentDatabaseItem;
  }

  public async setCurrentDatabaseItem(
    item: DatabaseItem | undefined,
    skipRefresh = false,
  ): Promise<void> {
    if (
      !skipRefresh &&
      item !== undefined &&
      item instanceof DatabaseItemImpl
    ) {
      await this.refreshDatabaseItem(item); // Will throw on invalid database.
    }
    if (this._currentDatabaseItem !== item) {
      this._currentDatabaseItem = item;
      await this.persistenceManager.setCurrentDatabaseItem(item);

      await this.app.commands.execute(
        "setContext",
        "codeQL.currentDatabaseItem",
        item?.name,
      );

      this._onDidChangeCurrentDatabaseItem.fire({
        item,
        kind: DatabaseEventKind.Change,
      });
    }
  }

  /**
   * Returns the index of the workspace folder that corresponds to the source archive of `item`
   * if there is one, and -1 otherwise.
   */
  private getDatabaseWorkspaceFolderIndex(item: DatabaseItem): number {
    return (vscode.workspace.workspaceFolders || []).findIndex((folder) =>
      item.belongsToSourceArchiveExplorerUri(folder.uri),
    );
  }

  public findDatabaseItem(uri: vscode.Uri): DatabaseItem | undefined {
    const uriString = uri.toString(true);
    return this._databaseItems.find(
      (item) => item.databaseUri.toString(true) === uriString,
    );
  }

  public findDatabaseItemBySourceArchive(
    uri: vscode.Uri,
  ): DatabaseItem | undefined {
    const uriString = uri.toString(true);
    return this._databaseItems.find(
      (item) =>
        item.sourceArchive && item.sourceArchive.toString(true) === uriString,
    );
  }

  public async addDatabaseItemWithoutPersistence(
    progress: ProgressCallback,
    token: vscode.CancellationToken,
    item: DatabaseItemImpl,
  ) {
    await this.addDatabaseItem(progress, token, item, false);
  }

  private async addDatabaseItem(
    progress: ProgressCallback,
    token: vscode.CancellationToken,
    item: DatabaseItemImpl,
    updatePersistedState = true,
  ) {
    this._databaseItems.push(item);

    if (updatePersistedState) {
      await this.persistenceManager.addDatabaseItem(item);
    }

    // Add this database item to the allow-list
    // Database items reconstituted from persisted state
    // will not have their contents yet.
    if (item.contents?.datasetUri) {
      await this.registerDatabase(progress, token, item);
    }
    // note that we use undefined as the item in order to reset the entire tree
    this._onDidChangeDatabaseItem.fire({
      item: undefined,
      kind: DatabaseEventKind.Add,
    });
  }

  public async renameDatabaseItem(
    item: DatabaseItem,
    newName: string,
    updatePersistedState = true,
  ) {
    if (updatePersistedState) {
      await this.persistenceManager.renameDatabaseItem(item, newName);
    }
    item.name = newName;
    this._onDidChangeDatabaseItem.fire({
      // pass undefined so that the entire tree is rebuilt in order to re-sort
      item: undefined,
      kind: DatabaseEventKind.Rename,
    });
  }

  public async setDatabaseItemLanguageAndDateAdded(
    item: DatabaseItem,
    language: string,
    dateAdded: number | undefined,
  ) {
    if (!(item instanceof DatabaseItemImpl)) {
      throw new Error("Cannot set language and date added for non-impl item");
    }
    item.setLanguageAndDateAdded(language, dateAdded);
    this._onDidChangeDatabaseItem.fire({
      // pass undefined so that the entire tree is rebuilt in order to re-sort
      item: undefined,
      kind: DatabaseEventKind.Rename,
    });
  }

  public async removeDatabaseItem(
    progress: ProgressCallback,
    token: vscode.CancellationToken,
    item: DatabaseItem,
    updatePersistedState = true,
  ) {
    if (this._currentDatabaseItem === item) {
      this._currentDatabaseItem = undefined;
    }
    const index = this.databaseItems.findIndex(
      (searchItem) => searchItem === item,
    );
    if (index >= 0) {
      this._databaseItems.splice(index, 1);
    }
    if (updatePersistedState) {
      await this.persistenceManager.removeDatabaseItem(item);
    }

    // Delete folder from workspace, if it is still there
    const folderIndex = (vscode.workspace.workspaceFolders || []).findIndex(
      (folder) => item.belongsToSourceArchiveExplorerUri(folder.uri),
    );
    if (folderIndex >= 0) {
      void extLogger.log(`Removing workspace folder at index ${folderIndex}`);
      vscode.workspace.updateWorkspaceFolders(folderIndex, 1);
    }

    // Remove this database item from the allow-list
    await this.deregisterDatabase(progress, token, item);

    // Delete folder from file system only if it is controlled by the extension
    if (this.isExtensionControlledLocation(item.databaseUri)) {
      void extLogger.log("Deleting database from filesystem.");
      await remove(item.databaseUri.fsPath).then(
        () => void extLogger.log(`Deleted '${item.databaseUri.fsPath}'`),
        (e: unknown) =>
          void extLogger.log(
            `Failed to delete '${
              item.databaseUri.fsPath
            }'. Reason: ${getErrorMessage(e)}`,
          ),
      );
    }

    // note that we use undefined as the item in order to reset the entire tree
    this._onDidChangeDatabaseItem.fire({
      item: undefined,
      kind: DatabaseEventKind.Remove,
    });
  }

  public async removeAllDatabases(
    progress: ProgressCallback,
    token: vscode.CancellationToken,
  ) {
    for (const item of this.databaseItems) {
      await this.removeDatabaseItem(progress, token, item);
    }
  }

  private async deregisterDatabase(
    progress: ProgressCallback,
    token: vscode.CancellationToken,
    dbItem: DatabaseItem,
  ) {
    try {
      await this.qs.deregisterDatabase(progress, token, dbItem);
    } catch (e) {
      const message = getErrorMessage(e);
      if (message === "Connection is disposed.") {
        // This is expected if the query server is not running.
        void extLogger.log(
          `Could not de-register database '${dbItem.name}' because query server is not running.`,
        );
        return;
      }
      throw e;
    }
  }

  public async registerDatabase(
    progress: ProgressCallback,
    token: vscode.CancellationToken,
    dbItem: DatabaseItem,
  ) {
    await this.qs.registerDatabase(progress, token, dbItem);
  }

  /**
   * Resolves the contents of the database.
   *
   * @remarks
   * The contents include the database directory, source archive, and metadata about the database.
   * If the database is invalid, `databaseItem.error` is updated with the error object that describes why
   * the database is invalid. This error is also thrown.
   */
  public async refreshDatabaseItem(databaseItem: DatabaseItemImpl) {
    try {
      try {
        databaseItem.contents = await DatabaseResolver.resolveDatabaseContents(
          databaseItem.databaseUri,
        );
        databaseItem.error = undefined;
      } catch (e) {
        databaseItem.contents = undefined;
        databaseItem.error = asError(e);
        throw e;
      }
    } finally {
      this._onDidChangeDatabaseItem.fire({
        kind: DatabaseEventKind.Refresh,
        item: databaseItem,
      });
    }
  }

  private isExtensionControlledLocation(uri: vscode.Uri) {
    const storageUri = this.ctx.storageUri || this.ctx.globalStorageUri;
    if (storageUri) {
      return containsPath(storageUri.fsPath, uri.fsPath, process.platform);
    }
    return false;
  }
}
