import { dirname, basename, normalize, relative } from "path";
import { Discovery } from "../common/discovery";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { Event, RelativePattern, Uri, WorkspaceFolder } from "vscode";
import { MultiFileSystemWatcher } from "../common/vscode/multi-file-system-watcher";
import { App } from "../common/app";
import { FileTreeDirectory, FileTreeLeaf } from "../common/file-tree-nodes";
import { getOnDiskWorkspaceFoldersObjects } from "../helpers";
import { AppEventEmitter } from "../common/events";
import { QueryDiscoverer } from "./query-tree-data-provider";
import { extLogger } from "../common";

/**
 * The results of discovering queries.
 */
export interface QueryDiscoveryResults {
  /**
   * A tree of directories and query files.
   * May have multiple roots because of multiple workspaces.
   */
  queries: Array<FileTreeDirectory<string>>;

  /**
   * File system paths to watch. If any ql file changes in these directories
   * or any subdirectories, then this could signify a change in queries.
   */
  watchPaths: Uri[];
}

/**
 * Discovers all query files contained in the QL packs in a given workspace folder.
 */
export class QueryDiscovery
  extends Discovery<QueryDiscoveryResults>
  implements QueryDiscoverer
{
  private results: QueryDiscoveryResults | undefined;

  private readonly onDidChangeQueriesEmitter: AppEventEmitter<void>;
  private readonly watcher: MultiFileSystemWatcher = this.push(
    new MultiFileSystemWatcher(),
  );

  constructor(
    private readonly app: App,
    private readonly cliServer: CodeQLCliServer,
  ) {
    super("Query Discovery", extLogger);

    this.onDidChangeQueriesEmitter = this.push(app.createEventEmitter<void>());
    this.push(app.onDidChangeWorkspaceFolders(this.refresh.bind(this)));
    this.push(this.watcher.onDidChange(this.refresh.bind(this)));
  }

  public get queries(): Array<FileTreeDirectory<string>> | undefined {
    return this.results?.queries;
  }

  /**
   * Event to be fired when the set of discovered queries may have changed.
   */
  public get onDidChangeQueries(): Event<void> {
    return this.onDidChangeQueriesEmitter.event;
  }

  protected async discover(): Promise<QueryDiscoveryResults> {
    const workspaceFolders = getOnDiskWorkspaceFoldersObjects();
    if (workspaceFolders.length === 0) {
      return {
        queries: [],
        watchPaths: [],
      };
    }

    const queries = await this.discoverQueries(workspaceFolders);

    return {
      queries,
      watchPaths: workspaceFolders.map((f) => f.uri),
    };
  }

  protected update(results: QueryDiscoveryResults): void {
    this.results = results;

    this.watcher.clear();
    for (const watchPath of results.watchPaths) {
      // Watch for changes to any `.ql` file
      this.watcher.addWatch(new RelativePattern(watchPath, "**/*.{ql}"));
      // need to explicitly watch for changes to directories themselves.
      this.watcher.addWatch(new RelativePattern(watchPath, "**/"));
    }
    this.onDidChangeQueriesEmitter.fire();
  }

  /**
   * Discover all queries in the specified directory and its subdirectories.
   * @returns A `QueryDirectory` object describing the contents of the directory, or `undefined` if
   *   no queries were found.
   */
  private async discoverQueries(
    workspaceFolders: readonly WorkspaceFolder[],
  ): Promise<Array<FileTreeDirectory<string>>> {
    const rootDirectories = [];
    for (const workspaceFolder of workspaceFolders) {
      const root = await this.discoverQueriesInWorkspace(workspaceFolder);
      if (root !== undefined) {
        rootDirectories.push(root);
      }
    }
    return rootDirectories;
  }

  private async discoverQueriesInWorkspace(
    workspaceFolder: WorkspaceFolder,
  ): Promise<FileTreeDirectory<string> | undefined> {
    const fullPath = workspaceFolder.uri.fsPath;
    const name = workspaceFolder.name;

    // We don't want to log each invocation of resolveQueries, since it clutters up the log.
    const silent = true;
    const resolvedQueries = await this.cliServer.resolveQueries(
      fullPath,
      silent,
    );
    if (resolvedQueries.length === 0) {
      return undefined;
    }

    const rootDirectory = new FileTreeDirectory<string>(
      fullPath,
      name,
      this.app.environment,
    );
    for (const queryPath of resolvedQueries) {
      const relativePath = normalize(relative(fullPath, queryPath));
      const dirName = dirname(relativePath);
      const parentDirectory = rootDirectory.createDirectory(dirName);
      parentDirectory.addChild(
        new FileTreeLeaf<string>(queryPath, basename(queryPath), "language"),
      );
    }

    rootDirectory.finish();
    return rootDirectory;
  }
}
