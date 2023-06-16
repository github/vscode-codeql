import { dirname, basename, normalize, relative } from "path";
import { Event } from "vscode";
import { EnvironmentContext } from "../common/app";
import {
  FileTreeDirectory,
  FileTreeLeaf,
  FileTreeNode,
} from "../common/file-tree-nodes";
import { QueryDiscoverer } from "./query-tree-data-provider";
import { FilePathDiscovery } from "../common/vscode/file-path-discovery";
import { containsPath } from "../pure/files";
import { getOnDiskWorkspaceFoldersObjects } from "../common/vscode/workspace-folders";
import { QueryLanguage } from "../common/query-language";

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
  constructor(
    private readonly env: EnvironmentContext,
    private readonly queryPackDiscovery: QueryPackDiscoverer,
  ) {
    super("Query Discovery", `**/*${QUERY_FILE_EXTENSION}`);

    this.push(
      this.queryPackDiscovery.onDidChangeQueryPacks(
        this.recomputeAllQueryLanguages.bind(this),
      ),
    );
  }

  /**
   * Event that fires when the set of queries in the workspace changes.
   */
  public get onDidChangeQueries(): Event<void> {
    return this.onDidChangePathsEmitter.event;
  }

  /**
   * Return all known queries, represented as a tree.
   *
   * Trivial directories where there is only one child will be collapsed into a single node.
   */
  public buildQueryTree(): Array<FileTreeNode<string>> {
    const roots = [];
    for (const workspaceFolder of getOnDiskWorkspaceFoldersObjects()) {
      const queriesInRoot = this.paths.filter((query) =>
        containsPath(workspaceFolder.uri.fsPath, query.path),
      );
      if (queriesInRoot.length > 0) {
        const root = new FileTreeDirectory<string>(
          workspaceFolder.uri.fsPath,
          workspaceFolder.name,
          this.env,
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

  private recomputeAllQueryLanguages() {
    // All we know is that something has changed in the set of known query packs.
    // We have no choice but to recompute the language for all queries.
    for (const query of this.paths) {
      query.language = this.determineQueryLanguage(query.path);
    }
    this.onDidChangePathsEmitter.fire();
  }

  private determineQueryLanguage(path: string): QueryLanguage | undefined {
    return this.queryPackDiscovery.getLanguageForQueryFile(path);
  }
}
