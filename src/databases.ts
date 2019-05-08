import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionContext, window as Window } from 'vscode';
import { ENOENT } from 'constants';

/**
 * databases.ts
 * ------------
 * Managing state of what the current database is, and what other
 * databases have been recently selected.
 *
 * The source of truth of the current state resides inside the
 * `TreeDataProvider` subclass below. Not sure I love this, since it
 * feels like mixing model and view a bit, but it works ok for now.
 */

/**
 * The name of the key in the workspaceState dictionary in which we
 * persist the current database across sessions.
 */
const CURRENT_DB: string = 'currentDatabase';

type ThemableIconPath = { light: string, dark: string } | string;

/**
 * Path to icons to display next to currently selected database.
 */
const SELECTED_DATABASE_ICON: ThemableIconPath = {
  light: 'media/check-light-mode.svg',
  dark: 'media/check-dark-mode.svg',
};

/**
 * The name of the key in the workspaceState dictionary in which we
 * persist the lsit of databases across sessions.
 */
const DB_LIST: string = 'databaseList';

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
 * Display file selection dialog. Expects the user to choose a
 * snapshot directory, which should be the parent directory of a
 * directory of the form `db-[language]`, for example, `db-cpp`.
 *
 * XXX: no validation is done other than checking the directory name
 * to make sure it really is a database directory.
 */
export async function chooseDatabaseDir(ctx: ExtensionContext): Promise<vscode.Uri | undefined> {
  const chosen = await Window.showOpenDialog(
    {
      openLabel: 'Choose Database',
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
    });
  if (chosen == undefined) {
    return undefined;
  }
  else {
    return chosen[0];
  }
}
 
/**
 * An error thrown when we cannot find a database in a putative
 * snapshot directory.
 */
class NoDatabaseError extends Error {

}

/**
 * One item in the user-displayed list of databases. Probably name
 * should be computed from a nearby .project file if it exists.
 */
export class DatabaseItem {
  snapshotUri: vscode.Uri;
  dbUri: vscode.Uri | undefined;
  srcRoot: vscode.Uri | undefined;
  name: string; // this is supposed to be human-readable, appears in interface
  constructor(uri: vscode.Uri, doRefresh: boolean = true) {
    this.snapshotUri = uri;
    this.name = path.basename(uri.fsPath);
    if(doRefresh) {
      this.refresh();
    }
  }

  public refresh() {
    const dbRelativePaths = DatabaseItem.findDb(this.snapshotUri);

    if (dbRelativePaths.length == 0) {
      this.dbUri = undefined;
      throw new NoDatabaseError(`${this.snapshotUri.fsPath} does not contain a database directory.`);
    }
    else {
      const dbAbsolutePath = path.join(this.snapshotUri.fsPath, dbRelativePaths[0]);
      if (dbRelativePaths.length > 1) {
        vscode.window.showWarningMessage(`Found multiple database directories in snapshot, using ${dbAbsolutePath}`);
      }
      this.dbUri = vscode.Uri.file(dbAbsolutePath);
      fs.exists(path.join(this.snapshotUri.fsPath, 'src'), (exists) => {
        if (exists) {
          this.srcRoot = vscode.Uri.file(path.join(this.snapshotUri.fsPath, 'src'));
        } else {
          vscode.window.showInformationMessage(`Could not determine source root for database ${this.snapshotUri}. Assuming paths are absolute.`);
          this.srcRoot = undefined;
        }
      });
    }
  }

  private static findDb(uri: vscode.Uri): string[] {
    try {
      let files = fs.readdirSync(uri.fsPath);
      
      let matches: string[] = [];
      files.forEach((file) => {
        if (file.startsWith('db-')) {
          matches.push(file);
        }
      })
      return matches;
    } catch (e) {
      if (e.code === 'ENOENT') {
        return [];
      } else {
        throw e;
      }
    }
  }
}

/**
 * Tree data provider for the databases view.
 */
class DatabaseTreeDataProvider implements vscode.TreeDataProvider<DatabaseItem> {

  /**
   * XXX: This idiom for how to get a `.fire()`-able event emitter was
   * cargo culted from another vscode extension. It seems rather
   * involved and I hope there's something better that can be done
   * instead.
   */
  private _onDidChangeTreeData: vscode.EventEmitter<DatabaseItem | undefined> = new vscode.EventEmitter<DatabaseItem | undefined>();
  readonly onDidChangeTreeData: vscode.Event<DatabaseItem | undefined> = this._onDidChangeTreeData.event;

  private ctx: ExtensionContext;
  private databases: DatabaseItem[] = [];

  /**
   * When not undefined, must be reference-equal to an item in `this.databases`.
   */
  private current: DatabaseItem | undefined;

  constructor(ctx: ExtensionContext, databases: DatabaseItem[], current: DatabaseItem | undefined) {
    this.ctx = ctx;
    this.databases = databases;
    this.current = current;
  }

  getTreeItem(element: DatabaseItem): vscode.TreeItem {
    const it = new vscode.TreeItem(element.name);
    if (element == this.current) {
      it.iconPath = joinThemableIconPath(this.ctx.extensionPath, SELECTED_DATABASE_ICON);
    } else if (element.dbUri == undefined) {
      it.iconPath = joinThemableIconPath(this.ctx.extensionPath, INVALID_DATABASE_ICON);
    }
    it.tooltip = element.snapshotUri.fsPath;
    return it;
  }

  getChildren(element?: DatabaseItem): vscode.ProviderResult<DatabaseItem[]> {
    if (element == undefined) {
      return this.databases;
    }
    else {
      return [];
    }
  }

  getParent(element: DatabaseItem): vscode.ProviderResult<DatabaseItem> {
    return null;
  }

  getCurrent(): DatabaseItem | undefined {
    return this.current;
  }

  setCurrentItem(item: DatabaseItem): void {
    this.current = item;
    this._onDidChangeTreeData.fire();
  }

  /**
   * Set the current database by providing a file uri. If the uri's
   * path already exists in the list of recently viewed databases,
   * reuse that item.
   */
  setCurrentUri(dir: vscode.Uri): void {
    let ix = this.databases.findIndex(it => it.snapshotUri.fsPath == dir.fsPath);

    if (ix == -1) {
      let item: DatabaseItem;
      try {
        item = new DatabaseItem(dir);
      }
      catch (e) {
        if (e instanceof NoDatabaseError) {
          vscode.window.showErrorMessage(e.message);
          return;
        }
        else {
          throw e;
        }
      }
      this.databases.push(item);
      this.setCurrentItem(item);
    }
    else {
      let item = this.databases[ix];
      try {
        item.refresh();
      }
      catch (e) {
        if (e instanceof NoDatabaseError) {
          vscode.window.showErrorMessage(e.message);
          this._onDidChangeTreeData.fire(item);
          return;
        }
        else {
          throw e;
        }
      }
      this.setCurrentItem(item);
    }
  }

  removeItem(dbi: DatabaseItem) {
    this.databases = this.databases.filter((entry:DatabaseItem) => {
      return entry != dbi;
    });
    this.ctx.workspaceState.update(DB_LIST, this.ctx.workspaceState.get<string[]>(DB_LIST, []).filter((entry:string) => {
      return entry != dbi.snapshotUri.fsPath;
    }));
    if (this.current == dbi) {
      this.current = undefined;
      this.ctx.workspaceState.update(CURRENT_DB, undefined);
    }
    this._onDidChangeTreeData.fire();
  }

  clearCurrentItem() {
    this.current = undefined;
  }

  updateItem(db: DatabaseItem) {
    this._onDidChangeTreeData.fire(db);
  }
}

export class DatabaseManager {
  treeDataProvider: DatabaseTreeDataProvider;
  ctx: ExtensionContext;

  constructor(ctx: ExtensionContext) {
    this.ctx = ctx;
    const current_db = this.ctx.workspaceState.get<string>(CURRENT_DB);

    let current_dbi: DatabaseItem | undefined = undefined;

    let dbs: DatabaseItem[] = [];
    let db_list = this.ctx.workspaceState.get<string[]>(DB_LIST, []);
    db_list.forEach(db => {
      try {
        let dbi = new DatabaseItem(vscode.Uri.file(db), false);
        dbs.push(dbi);
        if(current_db == db) {
          current_dbi = dbi
        }
        dbi.refresh();
      }
      catch (e) {
        if (e instanceof NoDatabaseError) {
          vscode.window.showErrorMessage(e.message);
        }
        else {
          throw e;
        }
      }
    });

    if (current_db != undefined && current_dbi == undefined) {
      try {
        current_dbi = new DatabaseItem(vscode.Uri.file(current_db), false);
        current_dbi.refresh()
      }
      catch (e) {
        if (e instanceof NoDatabaseError) {
          vscode.window.showErrorMessage(e.message);
          current_dbi = undefined;
          this.ctx.workspaceState.update(CURRENT_DB, undefined);
          this.ctx.workspaceState.update(DB_LIST, db_list.push(current_db));
        }
        else {
          throw e;
        }
      }
    }

    const treeDataProvider = this.treeDataProvider = new DatabaseTreeDataProvider(ctx, dbs, current_dbi);
    Window.createTreeView('qlDatabases', { treeDataProvider });
  }

  /**
   * Return the current database directory. If we don't already have a
   * current database, ask the user for one, and return that, or
   * undefined if they cancel.
   */
  async getDatabaseDir(): Promise<vscode.Uri | undefined> {
    const db = this.treeDataProvider.getCurrent();
    const chosen = db == undefined ? (await this.chooseAndSetDatabase()) : db.dbUri;
    return chosen;
  }

  setCurrentItem(db: DatabaseItem) {
    try {
      db.refresh();
    } catch(e) {
      if(e instanceof NoDatabaseError) {
        vscode.window.showErrorMessage(e.message);
        if(db == this.treeDataProvider.getCurrent()) {
          this.treeDataProvider.clearCurrentItem();
        } else {
          this.treeDataProvider.updateItem(db);
        }
        return;
      } else {
        throw e;
      }
    }
    this.treeDataProvider.setCurrentItem(db);
  }

  removeItem(db: DatabaseItem) {
    this.treeDataProvider.removeItem(db);
  }

  setCurrentDatabase(db: vscode.Uri) {
    if (db.scheme != 'file')
      throw new Error(`Database uri scheme ${db.scheme} not supported, only file uris are supported.`);
    this.treeDataProvider.setCurrentUri(db);
    this.ctx.workspaceState.update(CURRENT_DB, db.fsPath);
    let dbs = this.ctx.workspaceState.get<string[]>(DB_LIST, []);
    if(!(db.toString() in dbs)) {
      dbs.push(db.fsPath);
      this.ctx.workspaceState.update(DB_LIST, dbs);
    }
  }

  /**
   * Ask the user for a database directory. Has the side effect of
   * storing that choice in workspace state. Returns the chosen
   * database.
   */
  async chooseAndSetDatabase(): Promise<vscode.Uri | undefined> {
    const chosen = await chooseDatabaseDir(this.ctx);
    if (chosen != undefined)
      this.setCurrentDatabase(chosen);
    return chosen;
  }

  /**
   * Ask the user for a database directory. Has the side effect
   * of storing that choice in workspace state.
   */
  chooseAndSetDatabaseSync() {
    this.chooseAndSetDatabase().catch(e => console.error(e));
  }

}
