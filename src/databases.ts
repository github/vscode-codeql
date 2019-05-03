import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionContext, window as Window } from 'vscode';

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
 * persist the current database across sessions. We could instead
 * decide to persist more information (e.g. all 'recently chosen
 * databases') or less information, as eclipse does.
 */
const CURRENT_DB: string = 'currentDatabase';

/**
 * Path to an icon to display next to currently selected database.
 */
const CHECKMARK_ICON: string = 'media/check.svg';

/**
 * Display file selection dialog. Expects the user to choose the
 * database dir, not e.g. the project dir. Would be nice to perhaps
 * DWIM a little in case they do.
 *
 * XXX: no validation is done to make sure it really is a database
 * directory.
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
 * One item in the user-displayed list of databases. Probably name
 * should be computed from a nearby .project file if it exists.
 */
export class DatabaseItem {
  uri: vscode.Uri;
  name: string; // this is supposed to be human-readable, appears in interface
  constructor(uri: vscode.Uri) {
    this.uri = uri;
    this.name = path.basename(path.join(uri.fsPath, '..'));
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
    if (element == this.current)
      it.iconPath = vscode.Uri.file(path.join(this.ctx.extensionPath, CHECKMARK_ICON));
    it.tooltip = element.uri.fsPath;
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
    let item = new DatabaseItem(dir);
    let ix = this.databases.findIndex(it => it.uri.fsPath == dir.fsPath);
    if (ix == -1) {
      this.databases.push(item);
      this.setCurrentItem(item);
    }
    else {
      this.setCurrentItem(this.databases[ix]);
    }
  }
}

export class DatabaseManager {
  treeDataProvider: DatabaseTreeDataProvider;
  ctx: ExtensionContext;

  constructor(ctx: ExtensionContext) {
    this.ctx = ctx;
    const db = this.ctx.workspaceState.get<string>(CURRENT_DB);

    let dbi: DatabaseItem | undefined, dbs: DatabaseItem[];
    if (db == undefined) {
      dbi = undefined;
      dbs = [];
    }
    else {
      dbi = new DatabaseItem(vscode.Uri.file(db));
      dbs = [dbi];
    }
    const treeDataProvider = this.treeDataProvider = new DatabaseTreeDataProvider(ctx, dbs, dbi);
    Window.createTreeView('qlDatabases', { treeDataProvider });
  }

  /**
   * Return the current database directory. If we don't already have a
   * current database, ask the user for one, and return that, or
   * undefined if they cancel.
   */
  async getDatabaseDir(): Promise<vscode.Uri | undefined> {
    const db = this.treeDataProvider.getCurrent();
    const chosen = db == undefined ? (await this.chooseAndSetDatabase()) : db.uri;
    return chosen;
  }

  setCurrentItem(db: DatabaseItem) {
    this.treeDataProvider.setCurrentItem(db);
  }

  setCurrentDatabase(db: vscode.Uri) {
    if (db.scheme != 'file')
      throw new Error(`Database uri scheme ${db.scheme} not supported, only file uris are supported.`);
    this.treeDataProvider.setCurrentUri(db);
    this.ctx.workspaceState.update(CURRENT_DB, db.fsPath);
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
