import * as fs from 'fs-extra';
import * as glob from 'glob-promise';
import * as path from 'path';
import * as vscode from 'vscode';
import * as xml2js from 'xml2js';
import { ExtensionContext } from 'vscode';
import { showAndLogErrorMessage, showAndLogWarningMessage, showAndLogInformationMessage } from './helpers';
import { zipArchiveScheme } from './archive-filesystem-provider';
import { DisposableObject } from 'semmle-vscode-utils';

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
const CURRENT_DB: string = 'currentDatabase';

/**
 * The name of the key in the workspaceState dictionary in which we
 * persist the list of databases across sessions.
 */
const DB_LIST: string = 'databaseList';

export interface DatabaseOptions {
  displayName?: string;
  ignoreSourceArchive?: boolean;
}

interface DbInfoFileData {
  ['ns2:dbinfo']: { sourceLocationPrefix: string };
}

interface FullDatabaseOptions extends DatabaseOptions {
  ignoreSourceArchive: boolean;
}

interface PersistedDatabaseItem {
  uri: string;
  options?: DatabaseOptions;
}

/**
 * The layout of the database
 */
export enum DatabaseKind {
  /** A database exported by `odasa export` */
  Exported,
  /** A database built by `odasa buildSnapshot` */
  Odasa,
  /** A raw QL dataset */
  Dataset
}

export interface DatabaseContents {
  /** The layout of the database */
  kind: DatabaseKind;
  /**
   * The name of the database.
   *
   * @remarks
   * If the project file for the database specifies a name, that name will be used. Otherwise, the
   * name is derived from the directory name of the database.
   */
  name: string;
  /** The URI of the QL database within the database. */
  datasetUri: vscode.Uri;
  /** The URI of the source archive within the database, if one exists. */
  sourceArchiveUri?: vscode.Uri;
  /** The URI of the QL database scheme within the database, if exactly one exists. */
  dbSchemeUri?: vscode.Uri;
}

/**
 * An error thrown when we cannot find a valid database in a putative
 * database directory.
 */
class InvalidDatabaseError extends Error {
}

async function readXmlFile(path: string): Promise<any> {
  const xml = await fs.readFile(path, 'utf8');
  return new Promise((resolve, reject) => {
    xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
      if (err) {
        reject(err);
      }
      else {
        resolve(result);
      }
    });
  });
}

function getXmlElementContent(xml: any, elementPath: string): string | undefined {
  let current = xml;
  for (const name of elementPath.split('.')) {
    if (typeof current !== 'object') {
      return undefined;
    }
    current = current[name];
  }
  if (typeof current === 'string') {
    return current;
  }
  else {
    return undefined;
  }
}

async function findDataset(parentDirectory: string): Promise<vscode.Uri> {
  const dbRelativePaths = await glob('db-*/', {
    cwd: parentDirectory
  });

  if (dbRelativePaths.length === 0) {
    throw new InvalidDatabaseError(`'${parentDirectory}' does not contain a dataset directory.`);
  }

  const dbAbsolutePath = path.join(parentDirectory, dbRelativePaths[0]);
  if (dbRelativePaths.length > 1) {
    showAndLogWarningMessage(`Found multiple dataset directories in database, using '${dbAbsolutePath}'.`);
  }

  return vscode.Uri.file(dbAbsolutePath);
}

async function findSourceArchive(databasePath: string, basePath: string):
  Promise<vscode.Uri | undefined> {

  const zipPath = basePath + '.zip';
  if (await fs.pathExists(basePath)) {
    return vscode.Uri.file(basePath);
  }
  else if (await fs.pathExists(zipPath)) {
    return vscode.Uri.file(zipPath).with({ scheme: zipArchiveScheme });
  }
  else {
    showAndLogInformationMessage(`Could not find source archive for database '${databasePath}'. Assuming paths are absolute.`);
    return undefined;
  }
}

async function resolveExportedDatabase(databasePath: string):
  Promise<DatabaseContents | undefined> {

  const dotProjectPath = path.join(databasePath, '.project');
  if (await fs.pathExists(dotProjectPath)) {
    // Looks like an exported database.

    const dotProjectXml = await readXmlFile(dotProjectPath);
    const name = getXmlElementContent(dotProjectXml, 'projectDescription.name') ||
      path.basename(databasePath);

    // Database and source archive are directly under the root of the database.
    const datasetUri = await findDataset(databasePath);
    const sourceArchiveUri = await findSourceArchive(databasePath, path.join(databasePath, 'src'));

    return {
      kind: DatabaseKind.Exported,
      name,
      datasetUri,
      sourceArchiveUri
    };
  }
  else {
    return undefined;
  }
}

async function resolveOdasaSnapshot(snapshotPath: string): Promise<DatabaseContents | undefined> {
  const snapshotFilePath = path.join(snapshotPath, 'snapshot');
  if (await fs.pathExists(snapshotFilePath)) {
    // Looks like an Odasa snapshot.
    const odasaProjectDirectory = path.resolve(snapshotPath, '..');
    const odasaProjectFilePath = path.join(odasaProjectDirectory, 'project');
    const projectXml = await readXmlFile(odasaProjectFilePath);
    const projectName = getXmlElementContent(projectXml, 'project.name') ||
      path.basename(odasaProjectDirectory);
    const name = `${projectName}/${path.basename(snapshotPath)}`;

    // Database directory is under the 'working' directory.
    const datasetUri = await findDataset(path.join(snapshotPath, 'working'));
    // Source archive is under the 'output' directory.
    const sourceArchiveUri = await findSourceArchive(snapshotPath,
      path.join(snapshotPath, 'output/src_archive'));

    return {
      kind: DatabaseKind.Odasa,
      name: name,
      datasetUri: datasetUri,
      sourceArchiveUri: sourceArchiveUri
    };
  }
  else {
    return undefined;
  }
}

/** Gets the relative paths of all `.dbscheme` files in the given directory. */
async function getDbSchemeFiles(dbDirectory: string): Promise<string[]> {
  return await glob('*.dbscheme', { cwd: dbDirectory });
}

async function resolveRawDatabase(datasetPath: string): Promise<DatabaseContents | undefined> {
  if ((await getDbSchemeFiles(datasetPath)).length > 0) {
    return {
      kind: DatabaseKind.Dataset,
      name: path.basename(datasetPath),
      datasetUri: vscode.Uri.file(datasetPath),
      sourceArchiveUri: undefined
    };
  }
  else {
    return undefined;
  }
}

async function resolveDatabaseContents(uri: vscode.Uri): Promise<DatabaseContents> {
  if (uri.scheme !== 'file') {
    throw new Error(`Database URI scheme '${uri.scheme}' not supported; only 'file' URIs are supported.`);
  }
  const databasePath = uri.fsPath;
  if (!await fs.pathExists(databasePath)) {
    throw new InvalidDatabaseError(`Database '${databasePath}' does not exist.`);
  }

  const contents = await resolveExportedDatabase(databasePath) ||
    await resolveOdasaSnapshot(databasePath) ||
    await resolveRawDatabase(databasePath);

  if (contents === undefined) {
    throw new InvalidDatabaseError(`'${databasePath}' is not a valid Database.`);
  }

  // Look for a single DB scheme file within the database.
  // This should be found in the database directory, regardless of the form of database.
  const dbPath = contents.datasetUri.fsPath;
  const dbSchemeFiles = await getDbSchemeFiles(dbPath);
  if (dbSchemeFiles.length === 0) {
    throw new InvalidDatabaseError(`Database '${databasePath}' does not contain a QL dbscheme under '${dbPath}'.`);
  }
  else if (dbSchemeFiles.length > 1) {
    throw new InvalidDatabaseError(`Database '${databasePath}' contains multiple QL dbschemes under '${dbPath}'.`);
  } else {
    contents.dbSchemeUri = vscode.Uri.file(path.resolve(dbPath, dbSchemeFiles[0]));
  }
  return contents;
}

/** An item in the list of available databases */
export interface DatabaseItem {
  /** The URI of the database */
  readonly databaseUri: vscode.Uri;
  /** The name of the database to be displayed in the UI */
  readonly name: string;
  /** The URI of the database's source archive, or `undefined` if no source archive is to be used. */
  readonly sourceArchive: vscode.Uri | undefined;
  /**
   * The contents of the database.
   * Will be `undefined` if the database is invalid. Can be updated by calling `refresh()`.
   */
  readonly contents: DatabaseContents | undefined;
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
   * Holds if the database item has a `.dbinfo` file.
   */
  hasDbInfo(): boolean;

  /**
   * Returns `sourceLocationPrefix` of exported database.
   */
  getSourceLocationPrefix(): Promise<string>;
}

class DatabaseItemImpl implements DatabaseItem {
  private _error: Error | undefined = undefined;
  private _contents: DatabaseContents | undefined;

  public constructor(public readonly databaseUri: vscode.Uri,
    contents: DatabaseContents | undefined, private options: FullDatabaseOptions,
    private readonly onChanged: (item: DatabaseItemImpl) => void) {

    this._contents = contents;
  }

  public get name(): string {
    if (this.options.displayName) {
      return this.options.displayName;
    }
    else if (this._contents) {
      return this._contents.name;
    }
    else {
      return path.basename(this.databaseUri.fsPath);
    }
  }

  public get sourceArchive(): vscode.Uri | undefined {
    if (this.options.ignoreSourceArchive || (this._contents === undefined)) {
      return undefined;
    }
    else {
      return this._contents.sourceArchiveUri;
    }
  }

  public get contents(): DatabaseContents | undefined {
    return this._contents;
  }

  public get error(): Error | undefined {
    return this._error;
  }

  public async refresh(): Promise<void> {
    try {
      try {
        this._contents = await resolveDatabaseContents(this.databaseUri);
        this._error = undefined;
      }
      catch (e) {
        this._contents = undefined;
        this._error = e;
        throw e;
      }
    }
    finally {
      this.onChanged(this);
    }
  }

  public resolveSourceFile(file: string | undefined): vscode.Uri {
    const sourceArchive = this.sourceArchive;
    if (sourceArchive === undefined) {
      if (file !== undefined) {
        // Treat it as an absolute path.
        return vscode.Uri.file(file);
      }
      else {
        return this.databaseUri;
      }
    }
    else {
      if (file !== undefined) {
        // Strip any leading slashes from the file path, and replace `:` with `_`.
        const relativeFilePath = file.replace(/^\/*/, '').replace(':', '_');
        if (sourceArchive.scheme == zipArchiveScheme)
          return sourceArchive.with({ fragment: relativeFilePath });
        else {
          let newPath = sourceArchive.path;
          if (!newPath.endsWith('/')) {
            // Ensure a trailing slash.
            newPath += '/';
          }
          newPath += relativeFilePath;

          return sourceArchive.with({ path: newPath });
        }
      }
      else {
        return sourceArchive;
      }
    }
  }

  /**
   * Gets the state of this database, to be persisted in the workspace state.
   */
  public getPersistedState(): PersistedDatabaseItem {
    return {
      uri: this.databaseUri.toString(true),
      options: this.options
    };
  }

  /**
   * Holds if the database item refers to an exported snapshot
   */
  public hasDbInfo(): boolean {
    return fs.existsSync(path.join(this.snapshotUri.fsPath, '.dbinfo'));
  }

  /**
   * Returns contents of `.dbinfo` xml file for this exported snapshot, as
   * nested plain js object.
   */
  private async dbInfo(): Promise<DbInfoFileData> {
    return await readXmlFile(path.join(this.snapshotUri.fsPath, '.dbinfo'));
  }

  /**
   * Returns `sourceLocationPrefix` of database. Requires that the database
   * has a `.dbinfo` file, which is the source of the prefix.
   */
  public async getSourceLocationPrefix(): Promise<string> {
    const dbInfo = await this.dbInfo();
    return dbInfo['ns2:dbinfo'].sourceLocationPrefix;
  }
}

export class DatabaseManager extends DisposableObject {
  private readonly _onDidChangeDatabaseItem =
    this.push(new vscode.EventEmitter<DatabaseItem | undefined>());
  readonly onDidChangeDatabaseItem = this._onDidChangeDatabaseItem.event;

  private readonly _onDidChangeCurrentDatabaseItem =
    this.push(new vscode.EventEmitter<DatabaseItem | undefined>());
  readonly onDidChangeCurrentDatabaseItem = this._onDidChangeCurrentDatabaseItem.event;

  private readonly _databaseItems: DatabaseItemImpl[] = [];
  private _currentDatabaseItem: DatabaseItem | undefined = undefined;

  constructor(private ctx: ExtensionContext) {
    super();

    this.loadPersistedState();  // Let this run async.
  }

  public async openDatabase(uri: vscode.Uri, options?: DatabaseOptions):
    Promise<DatabaseItem> {

    const contents = await resolveDatabaseContents(uri);
    const realOptions = options || {};
    // Ignore the source archive for QLTest databases by default.
    const isQLTestDatabase = path.extname(uri.fsPath) === '.testproj';
    const fullOptions: FullDatabaseOptions = {
      ignoreSourceArchive: (realOptions.ignoreSourceArchive !== undefined) ?
        realOptions.ignoreSourceArchive : isQLTestDatabase,
      displayName: realOptions.displayName
    };
    const databaseItem = new DatabaseItemImpl(uri, contents, fullOptions, (item) => {
      this._onDidChangeDatabaseItem.fire(item);
    });
    this.addDatabaseItem(databaseItem);

    return databaseItem;
  }

  private async createDatabaseItemFromPersistedState(state: PersistedDatabaseItem):
    Promise<DatabaseItem> {

    let displayName: string | undefined = undefined;
    let ignoreSourceArchive = false;
    if (state.options) {
      if (typeof state.options.displayName === 'string') {
        displayName = state.options.displayName;
      }
      if (typeof state.options.ignoreSourceArchive === 'boolean') {
        ignoreSourceArchive = state.options.ignoreSourceArchive;
      }
    }
    const fullOptions: FullDatabaseOptions = {
      ignoreSourceArchive: ignoreSourceArchive,
      displayName: displayName
    };
    const item = new DatabaseItemImpl(vscode.Uri.parse(state.uri), undefined, fullOptions,
      (item) => {
        this._onDidChangeDatabaseItem.fire(item)
      });
    this.addDatabaseItem(item);

    return item;
  }

  private async loadPersistedState(): Promise<void> {
    const currentDatabaseUri = this.ctx.workspaceState.get<string>(CURRENT_DB);
    const databases = this.ctx.workspaceState.get<PersistedDatabaseItem[]>(DB_LIST, []);

    try {
      for (const database of databases) {
        const databaseItem = await this.createDatabaseItemFromPersistedState(database);
        try {
          await databaseItem.refresh();
          if (currentDatabaseUri === database.uri) {
            this.setCurrentDatabaseItem(databaseItem, true);
          }
        }
        catch (e) {
          // When loading from persisted state, leave invalid databases in the list. They will be
          // marked as invalid, and cannot be set as the current database.
        }
      }
    } catch (e) {
      // database list had an unexpected type - nothing to be done?
      showAndLogErrorMessage('Database list loading failed: ${}', e.message);
    }
  }

  public get databaseItems(): readonly DatabaseItem[] {
    return this._databaseItems;
  }

  public get currentDatabaseItem(): DatabaseItem | undefined {
    return this._currentDatabaseItem;
  }

  public async setCurrentDatabaseItem(item: DatabaseItem | undefined,
    skipRefresh: boolean = false): Promise<void> {

    if (!skipRefresh && (item !== undefined)) {
      await item.refresh();  // Will throw on invalid database.
    }
    if (this._currentDatabaseItem !== item) {
      this._currentDatabaseItem = item;
      this.updatePersistedCurrentDatabaseItem();
      this._onDidChangeCurrentDatabaseItem.fire(item);
    }
  }

  public findDatabaseItem(uri: vscode.Uri): DatabaseItem | undefined {
    const uriString = uri.toString(true);
    return this._databaseItems.find(item => item.databaseUri.toString(true) === uriString);
  }

  private addDatabaseItem(item: DatabaseItemImpl) {
    this._databaseItems.push(item);
    this.updatePersistedDatabaseList();
    this._onDidChangeDatabaseItem.fire(undefined);
  }

  public removeDatabaseItem(item: DatabaseItem) {
    if (this._currentDatabaseItem == item)
      this._currentDatabaseItem = undefined;
    const index = this.databaseItems.findIndex(searchItem => searchItem === item);
    if (index >= 0) {
      this._databaseItems.splice(index, 1);
    }
    this.updatePersistedDatabaseList();
    this._onDidChangeDatabaseItem.fire(undefined);
  }

  private updatePersistedCurrentDatabaseItem(): void {
    this.ctx.workspaceState.update(CURRENT_DB, this._currentDatabaseItem ?
      this._currentDatabaseItem.databaseUri.toString(true) : undefined);
  }

  private updatePersistedDatabaseList(): void {
    this.ctx.workspaceState.update(DB_LIST, this._databaseItems.map(item => item.getPersistedState()));
  }
}
