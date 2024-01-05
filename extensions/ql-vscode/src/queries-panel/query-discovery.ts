import { dirname, basename, normalize, relative } from "path";
import type { Event } from "vscode";
import type { App } from "../common/app";
import type { FileTreeNode } from "../common/file-tree-nodes";
import { FileTreeDirectory, FileTreeLeaf } from "../common/file-tree-nodes";
import type { QueryDiscoverer } from "./query-tree-data-provider";
import { FilePathDiscovery } from "../common/vscode/file-path-discovery";
import { containsPath } from "../common/files";
import { getOnDiskWorkspaceFoldersObjects } from "../common/vscode/workspace-folders";
import type { QueryLanguage } from "../common/query-language";
import type { LanguageContextStore } from "../language-context-store";
import type { AppEvent, AppEventEmitter } from "../common/events";

const QUERY_FILE_EXTENSION = ".ql";

export interface QueryPackDiscoverer {
  getLanguageForQueryFile(queryPath: string): QueryLanguage | undefined;
  onDidChangeQueryPacks: Event<void>;
}

interface Query {
  path: string;
  language: QueryLanguage | undefined;
}

/**
 * Discovers all query files in the workspace.
 */
export class QueryDiscovery
  extends FilePathDiscovery<Query>
  implements QueryDiscoverer
{
  public readonly onDidChangeQueries: AppEvent<void>;
  private readonly onDidChangeQueriesEmitter: AppEventEmitter<void>;

  constructor(
    private readonly app: App,
    private readonly queryPackDiscovery: QueryPackDiscoverer,
    private readonly languageContext: LanguageContextStore,
  ) {
    super("Query Discovery", `**/*${QUERY_FILE_EXTENSION}`);

    // Set up event emitters
    this.onDidChangeQueriesEmitter = this.push(app.createEventEmitter<void>());
    this.onDidChangeQueries = this.onDidChangeQueriesEmitter.event;

    // Handlers
    this.push(
      this.queryPackDiscovery.onDidChangeQueryPacks(
        this.recomputeAllData.bind(this),
      ),
    );
    this.push(
      this.onDidChangePathData(() => {
        this.onDidChangeQueriesEmitter.fire();
      }),
    );
    this.push(
      this.languageContext.onLanguageContextChanged(() => {
        this.onDidChangeQueriesEmitter.fire();
      }),
    );
  }

  /**
   * Return all known queries, represented as a tree.
   *
   * Trivial directories where there is only one child will be collapsed into a single node.
   */
  public buildQueryTree(): Array<FileTreeNode<string>> | undefined {
    const pathData = this.getPathData();
    if (pathData === undefined) {
      return undefined;
    }

    const roots = [];
    for (const workspaceFolder of getOnDiskWorkspaceFoldersObjects()) {
      const queriesInRoot = pathData.filter(
        (query) =>
          containsPath(workspaceFolder.uri.fsPath, query.path) &&
          this.languageContext.shouldInclude(query.language),
      );
      if (queriesInRoot.length === 0) {
        continue;
      }
      const root = new FileTreeDirectory<string>(
        workspaceFolder.uri.fsPath,
        workspaceFolder.name,
        this.app.environment,
      );
      for (const query of queriesInRoot) {
        const dirName = dirname(normalize(relative(root.path, query.path)));
        const parentDirectory = root.createDirectory(dirName);
        parentDirectory.addChild(
          new FileTreeLeaf<string>(
            query.path,
            basename(query.path),
            query.language,
          ),
        );
      }
      root.finish();
      roots.push(root);
    }
    return roots;
  }

  protected async getDataForPath(path: string): Promise<Query> {
    const language = this.determineQueryLanguage(path);
    return { path, language };
  }

  protected pathIsRelevant(path: string): boolean {
    return path.endsWith(QUERY_FILE_EXTENSION);
  }

  protected shouldOverwriteExistingData(
    newData: Query,
    existingData: Query,
  ): boolean {
    return newData.language !== existingData.language;
  }

  private determineQueryLanguage(path: string): QueryLanguage | undefined {
    return this.queryPackDiscovery.getLanguageForQueryFile(path);
  }
}
