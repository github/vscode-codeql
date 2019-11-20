import { EventEmitter, Event, Uri, workspace, WorkspaceFolder, RelativePattern } from 'vscode';
import { CodeQLCliServer, ResolvedQLPacks } from './cli';
import { Discovery } from './discovery';

export interface QLPack {
  name: string;
  uri: Uri;
};

/**
 * Service to discover all available QL packs in a workspace folder.
 */
export class QLPackDiscovery extends Discovery<ResolvedQLPacks> {
  private readonly _onDidChangeQLPacks = this.push(new EventEmitter<void>());
  private _qlPacks: readonly QLPack[] = [];

  constructor(private readonly workspaceFolder: WorkspaceFolder,
    private readonly cliServer: CodeQLCliServer) {

    super();

    // Watch for any changes to `qlpack.yml` files in this workspace folder.
    // TODO: The CLI server should tell us what paths to watch for.
    const watcher = workspace.createFileSystemWatcher(
      new RelativePattern(this.workspaceFolder, '**/qlpack.yml'));
    this.push(watcher);
    this.push(watcher.onDidChange(this.handleQLPackFileChanged, this));
    this.push(watcher.onDidCreate(this.handleQLPackFileChanged, this));
    this.push(watcher.onDidDelete(this.handleQLPackFileChanged, this));

    this.refresh();
  }

  public get onDidChangeQLPacks(): Event<void> { return this._onDidChangeQLPacks.event; }

  public get qlPacks(): readonly QLPack[] { return this._qlPacks; }

  private handleQLPackFileChanged(uri: Uri): void {
    this.refresh();
  }

  protected discover(): Promise<ResolvedQLPacks> {
    // Only look for QL packs in this workspace folder.
    return this.cliServer.resolveQLPacks([this.workspaceFolder.uri.fsPath], []);
  }

  protected update(results: ResolvedQLPacks): void {
    const qlPacks: QLPack[] = [];
    for (const id in results) {
      qlPacks.push(...results[id].map(fsPath => {
        return {
          name: id,
          uri: Uri.file(fsPath)
        };
      }));
    }
    this._qlPacks = qlPacks;
    this._onDidChangeQLPacks.fire();
  }
}
