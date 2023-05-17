import * as vscode from "vscode";
import { dirname, basename, join, normalize, relative } from "path";
import { Discovery } from "../common/discovery";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { pathExists } from "fs-extra";

/**
 * A node in the tree of queries. This will be either a `QueryDirectory` or a `QueryFile`.
 */
export abstract class QueryNode {
  constructor(private _path: string, private _name: string) {}

  public get path(): string {
    return this._path;
  }

  public get name(): string {
    return this._name;
  }

  public abstract get children(): readonly QueryNode[];

  public abstract finish(): void;
}

/**
 * A directory containing one or more query files or other query directories.
 */
export class QueryDirectory extends QueryNode {
  constructor(
    _path: string,
    _name: string,
    private _children: QueryNode[] = [],
  ) {
    super(_path, _name);
  }

  public get children(): readonly QueryNode[] {
    return this._children;
  }

  public addChild(child: QueryNode): void {
    this._children.push(child);
  }

  public createDirectory(relativePath: string): QueryDirectory {
    const dirName = dirname(relativePath);
    if (dirName === ".") {
      return this.createChildDirectory(relativePath);
    } else {
      const parent = this.createDirectory(dirName);
      return parent.createDirectory(basename(relativePath));
    }
  }

  public finish(): void {
    // remove empty directories
    this._children.filter(
      (child) => child instanceof QueryFile || child.children.length > 0,
    );
    this._children.sort((a, b) =>
      a.name.localeCompare(b.name, vscode.env.language),
    );
    this._children.forEach((child, i) => {
      child.finish();
      if (
        child.children?.length === 1 &&
        child.children[0] instanceof QueryDirectory
      ) {
        // collapse children
        const replacement = new QueryDirectory(
          child.children[0].path,
          `${child.name} / ${child.children[0].name}`,
          Array.from(child.children[0].children),
        );
        this._children[i] = replacement;
      }
    });
  }

  private createChildDirectory(name: string): QueryDirectory {
    const existingChild = this._children.find((child) => child.name === name);
    if (existingChild !== undefined) {
      return existingChild as QueryDirectory;
    } else {
      const newChild = new QueryDirectory(join(this.path, name), name);
      this.addChild(newChild);
      return newChild;
    }
  }
}

/**
 * A single query file, i.e. a file with `.ql` extension.
 */
export class QueryFile extends QueryNode {
  constructor(_path: string, _name: string) {
    super(_path, _name);
  }

  public get children(): readonly QueryNode[] {
    return [];
  }

  public finish(): void {
    /**/
  }
}

/**
 * The results of discovering queries.
 */
interface QueryDiscoveryResults {
  /**
   * A directory that contains one or more query files or other query directories.
   */
  queryDirectory: QueryDirectory | undefined;

  /**
   * The file system path to a directory to watch. If any ql file changes in
   * this directory, then this signifies a change in queries.
   */
  watchPath: string;
}

/**
 * Discovers all query files contained in the QL packs in a given workspace folder.
 */
export class QueryDiscovery extends Discovery<QueryDiscoveryResults> {
  private _queryDirectory: QueryDirectory | undefined;

  constructor(
    private readonly workspaceFolder: vscode.WorkspaceFolder,
    private readonly cliServer: CodeQLCliServer,
  ) {
    super("Query Discovery");
  }

  /**
   * The root directory. There is at least one query in this directory, or
   * in a subdirectory of this.
   */
  public get queryDirectory(): QueryDirectory | undefined {
    return this._queryDirectory;
  }

  protected async discover(): Promise<QueryDiscoveryResults> {
    const queryDirectory = await this.discoverQueries();
    return {
      queryDirectory,
      watchPath: this.workspaceFolder.uri.fsPath,
    };
  }

  protected update(results: QueryDiscoveryResults): void {
    this._queryDirectory = results.queryDirectory;
  }

  /**
   * Discover all queries in the specified directory and its subdirectories.
   * @returns A `QueryDirectory` object describing the contents of the directory, or `undefined` if
   *   no queries were found.
   */
  private async discoverQueries(): Promise<QueryDirectory> {
    const fullPath = this.workspaceFolder.uri.fsPath;
    const name = this.workspaceFolder.name;
    const rootDirectory = new QueryDirectory(fullPath, name);

    // Don't try discovery on workspace folders that don't exist on the filesystem
    if (await pathExists(fullPath)) {
      const resolvedQueries = await this.cliServer.resolveQueries(fullPath);
      for (const queryPath of resolvedQueries) {
        const relativePath = normalize(relative(fullPath, queryPath));
        const dirName = dirname(relativePath);
        const parentDirectory = rootDirectory.createDirectory(dirName);
        parentDirectory.addChild(new QueryFile(queryPath, basename(queryPath)));
      }

      rootDirectory.finish();
    }
    return rootDirectory;
  }
}
