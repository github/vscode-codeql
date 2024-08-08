import type { ExtensionContext } from "vscode";
import vscode from "vscode";
import type { Logger } from "../../common/logging";
import { showAndLogExceptionWithTelemetry } from "../../common/logging";
import { extLogger } from "../../common/logging/vscode";
import { DisposableObject } from "../../common/disposable-object";
import type { App } from "../../common/app";
import type { QueryRunner } from "../../query-server";
import type { CodeQLCliServer } from "../../codeql-cli/cli";
import type { ProgressCallback } from "../../common/vscode/progress";
import { withProgress } from "../../common/vscode/progress";
import {
  addDatabaseSourceToWorkspace,
  getAutogenerateQlPacks,
  isCodespacesTemplate,
  setAutogenerateQlPacks,
} from "../../config";
import { join } from "path";
import type { FullDatabaseOptions } from "./database-options";
import { DatabaseItemImpl } from "./database-item-impl";
import {
  showBinaryChoiceDialog,
  showNeverAskAgainDialog,
} from "../../common/vscode/dialog";
import {
  getFirstWorkspaceFolder,
  isFolderAlreadyInWorkspace,
} from "../../common/vscode/workspace-folders";
import {
  isQueryLanguage,
  tryGetQueryLanguage,
} from "../../common/query-language";
import { existsSync } from "fs";
import { QlPackGenerator } from "../../local-queries/qlpack-generator";
import { asError, getErrorMessage } from "../../common/helpers-pure";
import type { DatabaseItem, PersistedDatabaseItem } from "./database-item";
import { redactableError } from "../../common/errors";
import { copy, remove, stat } from "fs-extra";
import { containsPath } from "../../common/files";
import type { DatabaseChangedEvent } from "./database-events";
import { DatabaseEventKind } from "./database-events";
import { DatabaseResolver } from "./database-resolver";
import { telemetryListener } from "../../common/vscode/telemetry";
import type { LanguageContextStore } from "../../language-context-store";
import type { DatabaseOrigin } from "./database-origin";
import { ensureZippedSourceLocation } from "./database-contents";

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

type OpenDatabaseOptions = {
  /**
   * A location that is managed by the extension.
   */
  extensionManagedLocation?: string;
  isTutorialDatabase?: boolean;
  /**
   * Whether to add a workspace folder containing the source archive to the workspace. Default is true.
   */
  addSourceArchiveFolder?: boolean;
};

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
    private readonly cli: CodeQLCliServer,
    private readonly languageContext: LanguageContextStore,
    public logger: Logger,
  ) {
    super();

    qs.onStart(this.reregisterDatabases.bind(this));
    qs.onQueryRunStarting(this.maybeReimportTestDatabase.bind(this));

    this.push(
      this.languageContext.onLanguageContextChanged(async () => {
        if (
          this.currentDatabaseItem !== undefined &&
          !this.languageContext.shouldInclude(
            tryGetQueryLanguage(this.currentDatabaseItem.language),
          )
        ) {
          await this.setCurrentDatabaseItem(undefined);
        }
      }),
    );
  }

  /**
   * Creates a {@link DatabaseItem} for the specified database, and adds it to the list of open
   * databases.
   */
  public async openDatabase(
    uri: vscode.Uri,
    origin: DatabaseOrigin | undefined,
    makeSelected = true,
    displayName?: string,
    {
      extensionManagedLocation,
      isTutorialDatabase = false,
      addSourceArchiveFolder = addDatabaseSourceToWorkspace(),
    }: OpenDatabaseOptions = {},
  ): Promise<DatabaseItem> {
    const databaseItem = await this.createDatabaseItem(
      uri,
      origin,
      displayName,
      extensionManagedLocation,
    );

    return await this.addExistingDatabaseItem(
      databaseItem,
      makeSelected,
      isTutorialDatabase,
      addSourceArchiveFolder,
    );
  }

  /**
   * Finds a test database that was originally imported from `uri`.
   * A test database is creeated by the `codeql test run` command
   * and ends with `.testproj`.
   * @param uri The original location of the database
   * @returns The first database item found that matches the uri
   */
  public findTestDatabase(uri: vscode.Uri): DatabaseItem | undefined {
    const originPath = uri.fsPath;
    for (const item of this._databaseItems) {
      if (item.origin?.type === "testproj" && item.origin.path === originPath) {
        return item;
      }
    }
    return undefined;
  }

  public async maybeReimportTestDatabase(
    databaseUri: vscode.Uri,
    forceImport = false,
  ): Promise<void> {
    const res = await this.isTestDatabaseOutdated(databaseUri);
    if (!res) {
      return;
    }
    const doit =
      forceImport ||
      (await showBinaryChoiceDialog(
        "This test database is outdated. Do you want to reimport it?",
      ));

    if (doit) {
      await this.reimportTestDatabase(databaseUri);
    }
  }

  /**
   * Checks if the origin of the imported database is newer.
   * The imported database must be a test database.
   * @param databaseUri the URI of the imported database to check
   * @returns true if both databases exist and the origin database is newer.
   */
  private async isTestDatabaseOutdated(
    databaseUri: vscode.Uri,
  ): Promise<boolean> {
    const dbItem = this.findDatabaseItem(databaseUri);
    if (dbItem === undefined || dbItem.origin?.type !== "testproj") {
      return false;
    }

    // Compare timestmps of the codeql-database.yml files of the original and the
    // imported databases.
    const originDbYml = join(dbItem.origin.path, "codeql-database.yml");
    const importedDbYml = join(
      dbItem.databaseUri.fsPath,
      "codeql-database.yml",
    );

    let originStat;
    try {
      originStat = await stat(originDbYml);
    } catch {
      // if there is an error here, assume that the origin database
      // is no longer available. Safely ignore and do not try to re-import.
      return false;
    }

    try {
      const importedStat = await stat(importedDbYml);
      return originStat.mtimeMs > importedStat.mtimeMs;
    } catch {
      // If either of the files does not exist, we assume the origin is newer.
      // This shouldn't happen unless the user manually deleted one of the files.
      return true;
    }
  }

  /**
   * Reimport the specified imported database from its origin.
   * The imported databsae must be a testproj database.
   *
   * @param databaseUri the URI of the imported database to reimport
   */
  private async reimportTestDatabase(databaseUri: vscode.Uri): Promise<void> {
    const dbItem = this.findDatabaseItem(databaseUri);
    if (dbItem === undefined || dbItem.origin?.type !== "testproj") {
      throw new Error(`Database ${databaseUri} is not a testproj.`);
    }

    await this.removeDatabaseItem(dbItem);
    await copy(dbItem.origin.path, databaseUri.fsPath);
    await ensureZippedSourceLocation(databaseUri.fsPath);
    const newDbItem = new DatabaseItemImpl(databaseUri, dbItem.contents, {
      dateAdded: Date.now(),
      language: dbItem.language,
      origin: dbItem.origin,
      extensionManagedLocation: dbItem.extensionManagedLocation,
    });
    await this.addDatabaseItem(newDbItem);
    await this.setCurrentDatabaseItem(newDbItem);
  }

  /**
   * Adds a {@link DatabaseItem} to the list of open databases, if that database is not already on
   * the list.
   *
   * Typically, the item will have been created by {@link createOrOpenDatabaseItem} or {@link openDatabase}.
   */
  private async addExistingDatabaseItem(
    databaseItem: DatabaseItemImpl,
    makeSelected: boolean,
    isTutorialDatabase?: boolean,
    addSourceArchiveFolder = addDatabaseSourceToWorkspace(),
  ): Promise<DatabaseItem> {
    const existingItem = this.findDatabaseItem(databaseItem.databaseUri);
    if (existingItem !== undefined) {
      if (makeSelected) {
        await this.setCurrentDatabaseItem(existingItem);
      }
      return existingItem;
    }

    await this.addDatabaseItem(databaseItem);
    if (makeSelected) {
      await this.setCurrentDatabaseItem(databaseItem);
    }
    if (addSourceArchiveFolder) {
      await this.addDatabaseSourceArchiveFolder(databaseItem);
    }

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
    origin: DatabaseOrigin | undefined,
    displayName: string | undefined,
    extensionManagedLocation?: string,
  ): Promise<DatabaseItemImpl> {
    const contents = await DatabaseResolver.resolveDatabaseContents(uri);
    const fullOptions: FullDatabaseOptions = {
      // If a displayName is not passed in, the basename of folder containing the database is used.
      displayName,
      dateAdded: Date.now(),
      language: await this.getPrimaryLanguage(uri.fsPath),
      origin,
      extensionManagedLocation,
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
    origin: DatabaseOrigin | undefined,
  ): Promise<DatabaseItem> {
    const existingItem = this.findDatabaseItem(uri);
    if (existingItem !== undefined) {
      // Use the one we already have.
      return existingItem;
    }

    // We don't add this to the list automatically, but the user can add it later.
    return this.createDatabaseItem(uri, origin, undefined);
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

    const qlpackStoragePath = join(firstWorkspaceFolder, folderName);

    if (
      existsSync(qlpackStoragePath) ||
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

    if (answer === "No" || answer === undefined) {
      return;
    }

    if (answer === "No, and never ask me again") {
      await setAutogenerateQlPacks("never");
      return;
    }

    try {
      const qlPackGenerator = new QlPackGenerator(
        databaseItem.language,
        this.cli,
        qlpackStoragePath,
        qlpackStoragePath,
      );
      await qlPackGenerator.generate();
    } catch (e: unknown) {
      void this.logger.log(
        `Could not create skeleton QL pack: ${getErrorMessage(e)}`,
      );
    }
  }

  private async reregisterDatabases(progress: ProgressCallback) {
    let completed = 0;
    await Promise.all(
      this._databaseItems.map(async (databaseItem) => {
        await this.registerDatabase(databaseItem);
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

  private async createDatabaseItemFromPersistedState(
    state: PersistedDatabaseItem,
  ): Promise<DatabaseItemImpl> {
    let displayName: string | undefined = undefined;
    let dateAdded = undefined;
    let language = undefined;
    let origin = undefined;
    let extensionManagedLocation = undefined;
    if (state.options) {
      if (typeof state.options.displayName === "string") {
        displayName = state.options.displayName;
      }
      if (typeof state.options.dateAdded === "number") {
        dateAdded = state.options.dateAdded;
      }
      language = state.options.language;
      origin = state.options.origin;
      extensionManagedLocation = state.options.extensionManagedLocation;
    }

    const dbBaseUri = vscode.Uri.parse(state.uri, true);
    if (language === undefined) {
      // we haven't been successful yet at getting the language. try again
      language = await this.getPrimaryLanguage(dbBaseUri.fsPath);
    }

    const fullOptions: FullDatabaseOptions = {
      displayName,
      dateAdded,
      language,
      origin,
      extensionManagedLocation,
    };
    const item = new DatabaseItemImpl(dbBaseUri, undefined, fullOptions);

    // Avoid persisting the database state after adding since that should happen only after
    // all databases have been added.
    await this.addDatabaseItem(item, false);
    return item;
  }

  public async loadPersistedState(): Promise<void> {
    return withProgress(async (progress) => {
      const currentDatabaseUri =
        this.ctx.workspaceState.get<string>(CURRENT_DB);
      const databases = this.ctx.workspaceState.get<PersistedDatabaseItem[]>(
        DB_LIST,
        [],
      );
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

          const databaseItem =
            await this.createDatabaseItemFromPersistedState(database);
          try {
            await this.refreshDatabase(databaseItem);
            await this.registerDatabase(databaseItem);
            if (currentDatabaseUri === database.uri) {
              await this.setCurrentDatabaseItem(databaseItem, true);
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
        await this.updatePersistedDatabaseList();
      } catch (e) {
        // database list had an unexpected type - nothing to be done?
        void showAndLogExceptionWithTelemetry(
          extLogger,
          telemetryListener,
          redactableError(
            asError(e),
          )`Database list loading failed: ${getErrorMessage(e)}`,
        );
      }

      void this.logger.log("Finished loading persisted databases.");
    });
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
      await this.refreshDatabase(item); // Will throw on invalid database.
    }
    if (this._currentDatabaseItem !== item) {
      this._currentDatabaseItem = item;
      this.updatePersistedCurrentDatabaseItem();

      await this.app.commands.execute(
        "setContext",
        "codeQL.currentDatabaseItem",
        item?.name,
      );

      this._onDidChangeCurrentDatabaseItem.fire({
        item,
        kind: DatabaseEventKind.Change,
        fullRefresh: false,
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

  private async addDatabaseItem(
    item: DatabaseItemImpl,
    updatePersistedState = true,
  ) {
    this._databaseItems.push(item);

    if (updatePersistedState) {
      await this.updatePersistedDatabaseList();
    }

    // Add this database item to the allow-list
    // Database items reconstituted from persisted state
    // will not have their contents yet.
    if (item.contents?.datasetUri) {
      await this.registerDatabase(item);
    }
    // note that we use undefined as the item in order to reset the entire tree
    this._onDidChangeDatabaseItem.fire({
      item,
      kind: DatabaseEventKind.Add,
      fullRefresh: true,
    });
  }

  public async renameDatabaseItem(item: DatabaseItem, newName: string) {
    item.name = newName;
    await this.updatePersistedDatabaseList();
    this._onDidChangeDatabaseItem.fire({
      item,
      kind: DatabaseEventKind.Rename,
      fullRefresh: true,
    });
  }

  public async removeDatabaseItem(item: DatabaseItem) {
    if (this._currentDatabaseItem === item) {
      this._currentDatabaseItem = undefined;
    }
    const index = this.databaseItems.findIndex(
      (searchItem) => searchItem === item,
    );
    if (index >= 0) {
      this._databaseItems.splice(index, 1);
    }
    await this.updatePersistedDatabaseList();

    // Delete folder from workspace, if it is still there
    const folderIndex = (vscode.workspace.workspaceFolders || []).findIndex(
      (folder) => item.belongsToSourceArchiveExplorerUri(folder.uri),
    );
    if (folderIndex >= 0) {
      void extLogger.log(`Removing workspace folder at index ${folderIndex}`);
      vscode.workspace.updateWorkspaceFolders(folderIndex, 1);
    }

    // Remove this database item from the allow-list
    await this.deregisterDatabase(item);

    // Find whether we know directly which directory we should remove
    const directoryToRemove = item.extensionManagedLocation
      ? vscode.Uri.file(item.extensionManagedLocation)
      : item.databaseUri;

    // Delete folder from file system only if it is controlled by the extension
    if (this.isExtensionControlledLocation(directoryToRemove)) {
      void extLogger.log("Deleting database from filesystem.");
      await remove(directoryToRemove.fsPath).then(
        () => void extLogger.log(`Deleted '${directoryToRemove.fsPath}'`),
        (e: unknown) =>
          void extLogger.log(
            `Failed to delete '${
              directoryToRemove.fsPath
            }'. Reason: ${getErrorMessage(e)}`,
          ),
      );
    }

    this._onDidChangeDatabaseItem.fire({
      item,
      kind: DatabaseEventKind.Remove,
      fullRefresh: true,
    });
  }

  public async removeAllDatabases() {
    for (const item of this.databaseItems) {
      await this.removeDatabaseItem(item);
    }
  }

  private async deregisterDatabase(dbItem: DatabaseItem) {
    try {
      await this.qs.deregisterDatabase(dbItem);
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
  private async registerDatabase(dbItem: DatabaseItem) {
    await this.qs.registerDatabase(dbItem);
  }

  /**
   * Resolves the contents of the database.
   *
   * @remarks
   * The contents include the database directory, source archive, and metadata about the database.
   * If the database is invalid, `databaseItem.error` is updated with the error object that describes why
   * the database is invalid. This error is also thrown.
   */
  private async refreshDatabase(databaseItem: DatabaseItemImpl) {
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
        fullRefresh: false,
      });
    }
  }

  private updatePersistedCurrentDatabaseItem(): void {
    void this.ctx.workspaceState.update(
      CURRENT_DB,
      this._currentDatabaseItem
        ? this._currentDatabaseItem.databaseUri.toString(true)
        : undefined,
    );
  }

  private async updatePersistedDatabaseList(): Promise<void> {
    await this.ctx.workspaceState.update(
      DB_LIST,
      this._databaseItems.map((item) => item.getPersistedState()),
    );
  }

  private isExtensionControlledLocation(uri: vscode.Uri) {
    const storageUri = this.ctx.storageUri || this.ctx.globalStorageUri;
    if (storageUri) {
      return containsPath(storageUri.fsPath, uri.fsPath);
    }
    return false;
  }

  private async getPrimaryLanguage(dbPath: string) {
    const dbInfo = await this.cli.resolveDatabase(dbPath);
    return dbInfo.languages?.[0] || "";
  }
}
