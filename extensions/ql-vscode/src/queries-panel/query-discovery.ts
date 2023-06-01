import { dirname, basename, normalize, relative } from "path";
import { Discovery } from "../common/discovery";
import { CodeQLCliServer, QueryInfoByLanguage } from "../codeql-cli/cli";
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
  queries: FileTreeDirectory[];

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

  constructor(app: App, private readonly cliServer: CodeQLCliServer) {
    super("Query Discovery", extLogger);

    this.onDidChangeQueriesEmitter = this.push(app.createEventEmitter<void>());
    this.push(app.onDidChangeWorkspaceFolders(this.refresh.bind(this)));
    this.push(this.watcher.onDidChange(this.refresh.bind(this)));
  }

  public get queries(): FileTreeDirectory[] | undefined {
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
    workspaceFolders: WorkspaceFolder[],
  ): Promise<FileTreeDirectory[]> {
    const rootDirectories = [];
    const allWorkspceFolderPaths = workspaceFolders.map((f) => f.uri.fsPath);
    for (const workspaceFolder of workspaceFolders) {
      const root = await this.discoverQueriesInWorkspaceFolder(
        workspaceFolder,
        allWorkspceFolderPaths,
      );
      if (root !== undefined) {
        rootDirectories.push(root);
      }
    }
    return rootDirectories;
  }

  private async discoverQueriesInWorkspaceFolder(
    workspaceFolder: WorkspaceFolder,
    allWorkspaceFolderPaths: string[],
  ): Promise<FileTreeDirectory | undefined> {
    // We don't want to log each invocation of resolveQueries, since it clutters up the log.
    const silent = true;
    const resolvedQueries = await this.cliServer.resolveQueryByLanguage(
      workspaceFolder.uri,
      allWorkspaceFolderPaths,
      silent,
    );

    const queries = getQueryPaths(resolvedQueries);
    if (queries.length === 0) {
      return undefined;
    }

    const rootDirectory = new FileTreeDirectory(
      workspaceFolder.uri.fsPath,
      workspaceFolder.name,
    );
    for (const query of queries) {
      const relativePath = normalize(
        relative(workspaceFolder.uri.fsPath, query.path),
      );
      const dirName = dirname(relativePath);
      const parentDirectory = rootDirectory.createDirectory(dirName);
      parentDirectory.addChild(
        new FileTreeLeaf(query.path, basename(query.path)),
      );
    }

    rootDirectory.finish();
    return rootDirectory;
  }
}

interface QueryData {
  path: string;
  language: string | undefined;
}

function getQueryPaths(resolvedQueries: QueryInfoByLanguage): QueryData[] {
  const queryPaths: QueryData[] = [];

  const languages = Object.keys(resolvedQueries.byLanguage);
  for (const language of languages) {
    for (const path of Object.keys(resolvedQueries.byLanguage[language])) {
      queryPaths.push({ path, language });
    }
  }

  for (const path of Object.keys(resolvedQueries.multipleDeclaredLanguages)) {
    queryPaths.push({ path, language: undefined });
  }

  for (const path of Object.keys(resolvedQueries.noDeclaredLanguage)) {
    queryPaths.push({ path, language: undefined });
  }

  return queryPaths;
}
