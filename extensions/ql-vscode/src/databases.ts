import { pathExists, stat, remove } from "fs-extra";
import { promise as glob } from "glob-promise";
import { join, basename, resolve, relative, dirname, extname } from "path";
import * as vscode from "vscode";
import * as cli from "./cli";
import { ExtensionContext } from "vscode";
import {
  showAndLogWarningMessage,
  showAndLogInformationMessage,
  isLikelyDatabaseRoot,
  showAndLogExceptionWithTelemetry,
} from "./helpers";
import { ProgressCallback, withProgress } from "./commandRunner";
import {
  zipArchiveScheme,
  encodeArchiveBasePath,
  decodeSourceArchiveUri,
  encodeSourceArchiveUri,
} from "./archive-filesystem-provider";
import { DisposableObject } from "./pure/disposable-object";
import { Logger, extLogger } from "./common";
import { asError, getErrorMessage } from "./pure/helpers-pure";
import { QueryRunner } from "./queryRunner";
import { pathsEqual } from "./pure/files";
import { redactableError } from "./pure/errors";

/**
 * databases.ts
 * ------------
 * Managing state of what the current database is, and what other
 * databases have been recently selected.
 *
 * The source of truth of the current state resides inside the
 * `DatabaseManager` class below.
 */

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

export interface DatabaseOptions {
  displayName?: string;
  ignoreSourceArchive?: boolean;
  dateAdded?: number | undefined;
  language?: string;
}

export interface FullDatabaseOptions extends DatabaseOptions {
  ignoreSourceArchive: boolean;
  dateAdded: number | undefined;
  language: string | undefined;
}

interface PersistedDatabaseItem {
  uri: string;
  options?: DatabaseOptions;
}

/**
 * The layout of the database.
 */
export enum DatabaseKind {
  /** A CodeQL database */
  Database,
  /** A raw QL dataset */
  RawDataset,
}

export interface DatabaseContents {
  /** The layout of the database */
  kind: DatabaseKind;
  /**
   * The name of the database.
   */
  name: string;
  /** The URI of the QL dataset within the database. */
  datasetUri: vscode.Uri;
  /** The URI of the source archive within the database, if one exists. */
  sourceArchiveUri?: vscode.Uri;
  /** The URI of the CodeQL database scheme within the database, if exactly one exists. */
  dbSchemeUri?: vscode.Uri;
}

/**
 * An error thrown when we cannot find a valid database in a putative
 * database directory.
 */
class InvalidDatabaseError extends Error {}

async function findDataset(parentDirectory: string): Promise<vscode.Uri> {
  /*
   * Look directly in the root
   */
  let dbRelativePaths = await glob("db-*/", {
    cwd: parentDirectory,
  });

  if (dbRelativePaths.length === 0) {
    /*
     * Check If they are in the old location
     */
    dbRelativePaths = await glob("working/db-*/", {
      cwd: parentDirectory,
    });
  }
  if (dbRelativePaths.length === 0) {
    throw new InvalidDatabaseError(
      `'${parentDirectory}' does not contain a dataset directory.`,
    );
  }

  const dbAbsolutePath = join(parentDirectory, dbRelativePaths[0]);
  if (dbRelativePaths.length > 1) {
    void showAndLogWarningMessage(
      `Found multiple dataset directories in database, using '${dbAbsolutePath}'.`,
    );
  }

  return vscode.Uri.file(dbAbsolutePath);
}

// exported for testing
export async function findSourceArchive(
  databasePath: string,
): Promise<vscode.Uri | undefined> {
  const relativePaths = ["src", "output/src_archive"];

  for (const relativePath of relativePaths) {
    const basePath = join(databasePath, relativePath);
    const zipPath = `${basePath}.zip`;

    // Prefer using a zip archive over a directory.
    if (await pathExists(zipPath)) {
      return encodeArchiveBasePath(zipPath);
    } else if (await pathExists(basePath)) {
      return vscode.Uri.file(basePath);
    }
  }

  void showAndLogInformationMessage(
    `Could not find source archive for database '${databasePath}'. Assuming paths are absolute.`,
  );
  return undefined;
}

async function resolveDatabase(
  databasePath: string,
): Promise<DatabaseContents> {
  const name = basename(databasePath);

  // Look for dataset and source archive.
  const datasetUri = await findDataset(databasePath);
  const sourceArchiveUri = await findSourceArchive(databasePath);

  return {
    kind: DatabaseKind.Database,
    name,
    datasetUri,
    sourceArchiveUri,
  };
}

/** Gets the relative paths of all `.dbscheme` files in the given directory. */
async function getDbSchemeFiles(dbDirectory: string): Promise<string[]> {
  return await glob("*.dbscheme", { cwd: dbDirectory });
}

async function resolveDatabaseContents(
  uri: vscode.Uri,
): Promise<DatabaseContents> {
  if (uri.scheme !== "file") {
    throw new Error(
      `Database URI scheme '${uri.scheme}' not supported; only 'file' URIs are supported.`,
    );
  }
  const databasePath = uri.fsPath;
  if (!(await pathExists(databasePath))) {
    throw new InvalidDatabaseError(
      `Database '${databasePath}' does not exist.`,
    );
  }

  const contents = await resolveDatabase(databasePath);

  if (contents === undefined) {
    throw new InvalidDatabaseError(
      `'${databasePath}' is not a valid database.`,
    );
  }

  // Look for a single dbscheme file within the database.
  // This should be found in the dataset directory, regardless of the form of database.
  const dbPath = contents.datasetUri.fsPath;
  const dbSchemeFiles = await getDbSchemeFiles(dbPath);
  if (dbSchemeFiles.length === 0) {
    throw new InvalidDatabaseError(
      `Database '${databasePath}' does not contain a CodeQL dbscheme under '${dbPath}'.`,
    );
  } else if (dbSchemeFiles.length > 1) {
    throw new InvalidDatabaseError(
      `Database '${databasePath}' contains multiple CodeQL dbschemes under '${dbPath}'.`,
    );
  } else {
    contents.dbSchemeUri = vscode.Uri.file(resolve(dbPath, dbSchemeFiles[0]));
  }
  return contents;
}

/** An item in the list of available databases */
export interface DatabaseItem {
  /** The URI of the database */
  readonly databaseUri: vscode.Uri;
  /** The name of the database to be displayed in the UI */
  name: string;

  /** The primary language of the database or empty string if unknown */
  readonly language: string;
  /** The URI of the database's source archive, or `undefined` if no source archive is to be used. */
  readonly sourceArchive: vscode.Uri | undefined;
  /**
   * The contents of the database.
   * Will be `undefined` if the database is invalid. Can be updated by calling `refresh()`.
   */
  readonly contents: DatabaseContents | undefined;

  /**
   * The date this database was added as a unix timestamp. Or undefined if we don't know.
   */
  readonly dateAdded: number | undefined;

  /** If the database is invalid, describes why. */
  readonly error: Error | undefined;
  /**
   * Resolves the contents of the database.
   *
   * @remarks
   * The contents include the database directory, source archive, and metadata about the database.
   * If the database is invalid, `this.error` is updated with the error object that describes why
   * the database is invalid. This error is also thrown.
   */
  refresh(): Promise<void>;
  /**
   * Resolves a filename to its URI in the source archive.
   *
   * @param file Filename within the source archive. May be `undefined` to return a dummy file path.
   */
  resolveSourceFile(file: string | undefined): vscode.Uri;

  /**
   * Holds if the database item has a `.dbinfo` or `codeql-database.yml` file.
   */
  hasMetadataFile(): Promise<boolean>;

  /**
   * Returns `sourceLocationPrefix` of exported database.
   */
  getSourceLocationPrefix(server: cli.CodeQLCliServer): Promise<string>;

  /**
   * Returns dataset folder of exported database.
   */
  getDatasetFolder(server: cli.CodeQLCliServer): Promise<string>;

  /**
   * Returns the root uri of the virtual filesystem for this database's source archive,
   * as displayed in the filesystem explorer.
   */
  getSourceArchiveExplorerUri(): vscode.Uri;

  /**
   * Holds if `uri` belongs to this database's source archive.
   */
  belongsToSourceArchiveExplorerUri(uri: vscode.Uri): boolean;

  /**
   * Whether the database may be affected by test execution for the given path.
   */
  isAffectedByTest(testPath: string): Promise<boolean>;

  /**
   * Gets the state of this database, to be persisted in the workspace state.
   */
  getPersistedState(): PersistedDatabaseItem;

  /**
   * Verifies that this database item has a zipped source folder. Returns an error message if it does not.
   */
  verifyZippedSources(): string | undefined;
}

export enum DatabaseEventKind {
  Add = "Add",
  Remove = "Remove",

  // Fired when databases are refreshed from persisted state
  Refresh = "Refresh",

  // Fired when the current database changes
  Change = "Change",

  Rename = "Rename",
}

export interface DatabaseChangedEvent {
  kind: DatabaseEventKind;
  item: DatabaseItem | undefined;
}

// Exported for testing
export class DatabaseItemImpl implements DatabaseItem {
  private _error: Error | undefined = undefined;
  private _contents: DatabaseContents | undefined;
  /** A cache of database info */
  private _dbinfo: cli.DbInfo | undefined;

  public constructor(
    public readonly databaseUri: vscode.Uri,
    contents: DatabaseContents | undefined,
    private options: FullDatabaseOptions,
    private readonly onChanged: (event: DatabaseChangedEvent) => void,
  ) {
    this._contents = contents;
  }

  public get name(): string {
    if (this.options.displayName) {
      return this.options.displayName;
    } else if (this._contents) {
      return this._contents.name;
    } else {
      return basename(this.databaseUri.fsPath);
    }
  }

  public set name(newName: string) {
    this.options.displayName = newName;
  }

  public get sourceArchive(): vscode.Uri | undefined {
    if (this.options.ignoreSourceArchive || this._contents === undefined) {
      return undefined;
    } else {
      return this._contents.sourceArchiveUri;
    }
  }

  public get contents(): DatabaseContents | undefined {
    return this._contents;
  }

  public get dateAdded(): number | undefined {
    return this.options.dateAdded;
  }

  public get error(): Error | undefined {
    return this._error;
  }

  public async refresh(): Promise<void> {
    try {
      try {
        this._contents = await resolveDatabaseContents(this.databaseUri);
        this._error = undefined;
      } catch (e) {
        this._contents = undefined;
        this._error = asError(e);
        throw e;
      }
    } finally {
      this.onChanged({
        kind: DatabaseEventKind.Refresh,
        item: this,
      });
    }
  }

  public resolveSourceFile(uriStr: string | undefined): vscode.Uri {
    const sourceArchive = this.sourceArchive;
    const uri = uriStr ? vscode.Uri.parse(uriStr, true) : undefined;
    if (uri && uri.scheme !== "file") {
      throw new Error(
        `Invalid uri scheme in ${uriStr}. Only 'file' is allowed.`,
      );
    }
    if (!sourceArchive) {
      if (uri) {
        return uri;
      } else {
        return this.databaseUri;
      }
    }

    if (uri) {
      const relativeFilePath = decodeURI(uri.path)
        .replace(":", "_")
        .replace(/^\/*/, "");
      if (sourceArchive.scheme === zipArchiveScheme) {
        const zipRef = decodeSourceArchiveUri(sourceArchive);
        const pathWithinSourceArchive =
          zipRef.pathWithinSourceArchive === "/"
            ? relativeFilePath
            : `${zipRef.pathWithinSourceArchive}/${relativeFilePath}`;
        return encodeSourceArchiveUri({
          pathWithinSourceArchive,
          sourceArchiveZipPath: zipRef.sourceArchiveZipPath,
        });
      } else {
        let newPath = sourceArchive.path;
        if (!newPath.endsWith("/")) {
          // Ensure a trailing slash.
          newPath += "/";
        }
        newPath += relativeFilePath;

        return sourceArchive.with({ path: newPath });
      }
    } else {
      return sourceArchive;
    }
  }

  /**
   * Gets the state of this database, to be persisted in the workspace state.
   */
  public getPersistedState(): PersistedDatabaseItem {
    return {
      uri: this.databaseUri.toString(true),
      options: this.options,
    };
  }

  /**
   * Holds if the database item refers to an exported snapshot
   */
  public async hasMetadataFile(): Promise<boolean> {
    return await isLikelyDatabaseRoot(this.databaseUri.fsPath);
  }

  /**
   * Returns information about a database.
   */
  private async getDbInfo(server: cli.CodeQLCliServer): Promise<cli.DbInfo> {
    if (this._dbinfo === undefined) {
      this._dbinfo = await server.resolveDatabase(this.databaseUri.fsPath);
    }
    return this._dbinfo;
  }

  /**
   * Returns `sourceLocationPrefix` of database. Requires that the database
   * has a `.dbinfo` file, which is the source of the prefix.
   */
  public async getSourceLocationPrefix(
    server: cli.CodeQLCliServer,
  ): Promise<string> {
    const dbInfo = await this.getDbInfo(server);
    return dbInfo.sourceLocationPrefix;
  }

  /**
   * Returns path to dataset folder of database.
   */
  public async getDatasetFolder(server: cli.CodeQLCliServer): Promise<string> {
    const dbInfo = await this.getDbInfo(server);
    return dbInfo.datasetFolder;
  }

  public get language() {
    return this.options.language || "";
  }

  /**
   * Returns the root uri of the virtual filesystem for this database's source archive.
   */
  public getSourceArchiveExplorerUri(): vscode.Uri {
    const sourceArchive = this.sourceArchive;
    if (sourceArchive === undefined || !sourceArchive.fsPath.endsWith(".zip")) {
      throw new Error(this.verifyZippedSources());
    }
    return encodeArchiveBasePath(sourceArchive.fsPath);
  }

  public verifyZippedSources(): string | undefined {
    const sourceArchive = this.sourceArchive;
    if (sourceArchive === undefined) {
      return `${this.name} has no source archive.`;
    }

    if (!sourceArchive.fsPath.endsWith(".zip")) {
      return `${this.name} has a source folder that is unzipped.`;
    }
    return;
  }

  /**
   * Holds if `uri` belongs to this database's source archive.
   */
  public belongsToSourceArchiveExplorerUri(uri: vscode.Uri): boolean {
    if (this.sourceArchive === undefined) return false;
    return (
      uri.scheme === zipArchiveScheme &&
      decodeSourceArchiveUri(uri).sourceArchiveZipPath ===
        this.sourceArchive.fsPath
    );
  }

  public async isAffectedByTest(testPath: string): Promise<boolean> {
    const databasePath = this.databaseUri.fsPath;
    if (!databasePath.endsWith(".testproj")) {
      return false;
    }
    try {
      const stats = await stat(testPath);
      if (stats.isDirectory()) {
        return !relative(testPath, databasePath).startsWith("..");
      } else {
        // database for /one/two/three/test.ql is at /one/two/three/three.testproj
        const testdir = dirname(testPath);
        const testdirbase = basename(testdir);
        return pathsEqual(
          databasePath,
          join(testdir, `${testdirbase}.testproj`),
          process.platform,
        );
      }
    } catch {
      // No information available for test path - assume database is unaffected.
      return false;
    }
  }
}

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

  private readonly _databaseItems: DatabaseItem[] = [];
  private _currentDatabaseItem: DatabaseItem | undefined = undefined;

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly qs: QueryRunner,
    private readonly cli: cli.CodeQLCliServer,
    public logger: Logger,
  ) {
    super();

    qs.onStart(this.reregisterDatabases.bind(this));
  }

  public async openDatabase(
    progress: ProgressCallback,
    token: vscode.CancellationToken,
    uri: vscode.Uri,
    displayName?: string,
  ): Promise<DatabaseItem> {
    const contents = await resolveDatabaseContents(uri);
    // Ignore the source archive for QLTest databases by default.
    const isQLTestDatabase = extname(uri.fsPath) === ".testproj";
    const fullOptions: FullDatabaseOptions = {
      ignoreSourceArchive: isQLTestDatabase,
      // If a displayName is not passed in, the basename of folder containing the database is used.
      displayName,
      dateAdded: Date.now(),
      language: await this.getPrimaryLanguage(uri.fsPath),
    };
    const databaseItem = new DatabaseItemImpl(
      uri,
      contents,
      fullOptions,
      (event) => {
        this._onDidChangeDatabaseItem.fire(event);
      },
    );

    await this.addDatabaseItem(progress, token, databaseItem);
    await this.addDatabaseSourceArchiveFolder(databaseItem);

    return databaseItem;
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

  private async createDatabaseItemFromPersistedState(
    progress: ProgressCallback,
    token: vscode.CancellationToken,
    state: PersistedDatabaseItem,
  ): Promise<DatabaseItem> {
    let displayName: string | undefined = undefined;
    let ignoreSourceArchive = false;
    let dateAdded = undefined;
    let language = undefined;
    if (state.options) {
      if (typeof state.options.displayName === "string") {
        displayName = state.options.displayName;
      }
      if (typeof state.options.ignoreSourceArchive === "boolean") {
        ignoreSourceArchive = state.options.ignoreSourceArchive;
      }
      if (typeof state.options.dateAdded === "number") {
        dateAdded = state.options.dateAdded;
      }
      language = state.options.language;
    }

    const dbBaseUri = vscode.Uri.parse(state.uri, true);
    if (language === undefined) {
      // we haven't been successful yet at getting the language. try again
      language = await this.getPrimaryLanguage(dbBaseUri.fsPath);
    }

    const fullOptions: FullDatabaseOptions = {
      ignoreSourceArchive,
      displayName,
      dateAdded,
      language,
    };
    const item = new DatabaseItemImpl(
      dbBaseUri,
      undefined,
      fullOptions,
      (event) => {
        this._onDidChangeDatabaseItem.fire(event);
      },
    );

    // Avoid persisting the database state after adding since that should happen only after
    // all databases have been added.
    await this.addDatabaseItem(progress, token, item, false);
    return item;
  }

  public async loadPersistedState(): Promise<void> {
    return withProgress(
      {
        location: vscode.ProgressLocation.Notification,
      },
      async (progress, token) => {
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
              message: `Loading ${
                database.options?.displayName || "databases"
              }`,
              step: ++step,
            });

            const databaseItem =
              await this.createDatabaseItemFromPersistedState(
                progress,
                token,
                database,
              );
            try {
              await databaseItem.refresh();
              await this.registerDatabase(progress, token, databaseItem);
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
            redactableError(
              asError(e),
            )`Database list loading failed: ${getErrorMessage(e)}`,
          );
        }

        void this.logger.log("Finished loading persisted databases.");
      },
    );
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
    if (!skipRefresh && item !== undefined) {
      await item.refresh(); // Will throw on invalid database.
    }
    if (this._currentDatabaseItem !== item) {
      this._currentDatabaseItem = item;
      this.updatePersistedCurrentDatabaseItem();

      await vscode.commands.executeCommand(
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

  private async addDatabaseItem(
    progress: ProgressCallback,
    token: vscode.CancellationToken,
    item: DatabaseItem,
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
      await this.registerDatabase(progress, token, item);
    }
    // note that we use undefined as the item in order to reset the entire tree
    this._onDidChangeDatabaseItem.fire({
      item: undefined,
      kind: DatabaseEventKind.Add,
    });
  }

  public async renameDatabaseItem(item: DatabaseItem, newName: string) {
    item.name = newName;
    await this.updatePersistedDatabaseList();
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
  ) {
    if (this._currentDatabaseItem == item) {
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

  private async deregisterDatabase(
    progress: ProgressCallback,
    token: vscode.CancellationToken,
    dbItem: DatabaseItem,
  ) {
    await this.qs.deregisterDatabase(progress, token, dbItem);
  }
  private async registerDatabase(
    progress: ProgressCallback,
    token: vscode.CancellationToken,
    dbItem: DatabaseItem,
  ) {
    await this.qs.registerDatabase(progress, token, dbItem);
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
    const storagePath = this.ctx.storagePath || this.ctx.globalStoragePath;
    // the uri.fsPath function on windows returns a lowercase drive letter,
    // but storagePath will have an uppercase drive letter. Be sure to compare
    // URIs to URIs only
    if (storagePath) {
      return uri.fsPath.startsWith(vscode.Uri.file(storagePath).fsPath);
    }
    return false;
  }

  private async getPrimaryLanguage(dbPath: string) {
    const dbInfo = await this.cli.resolveDatabase(dbPath);
    return dbInfo.languages?.[0] || "";
  }
}

/**
 * Get the set of directories containing upgrades, given a list of
 * scripts returned by the cli's upgrade resolution.
 */
export function getUpgradesDirectories(scripts: string[]): vscode.Uri[] {
  const parentDirs = scripts.map((dir) => dirname(dir));
  const uniqueParentDirs = new Set(parentDirs);
  return Array.from(uniqueParentDirs).map((filePath) =>
    vscode.Uri.file(filePath),
  );
}
