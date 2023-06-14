// Exported for testing
import * as cli from "../../codeql-cli/cli";
import vscode from "vscode";
import { FullDatabaseOptions } from "./database-options";
import { basename, dirname, extname, join } from "path";
import {
  decodeSourceArchiveUri,
  encodeArchiveBasePath,
  encodeSourceArchiveUri,
  zipArchiveScheme,
} from "../../common/vscode/archive-filesystem-provider";
import { DatabaseItem, PersistedDatabaseItem } from "./database-item";
import { isLikelyDatabaseRoot } from "./db-contents-heuristics";
import { stat } from "fs-extra";
import { containsPath, pathsEqual } from "../../pure/files";
import { DatabaseContents } from "./database-contents";

export class DatabaseItemImpl implements DatabaseItem {
  // These are only public in the implementation, they are readonly in the interface
  public error: Error | undefined = undefined;
  public contents: DatabaseContents | undefined;
  /** A cache of database info */
  private _dbinfo: cli.DbInfo | undefined;

  public constructor(
    public readonly databaseUri: vscode.Uri,
    contents: DatabaseContents | undefined,
    private options: FullDatabaseOptions,
  ) {
    this.contents = contents;
  }

  public get name(): string {
    if (this.options.displayName) {
      return this.options.displayName;
    } else if (this.contents) {
      return this.contents.name;
    } else {
      return basename(this.databaseUri.fsPath);
    }
  }

  public set name(newName: string) {
    this.options.displayName = newName;
  }

  public get sourceArchive(): vscode.Uri | undefined {
    if (this.ignoreSourceArchive || this.contents === undefined) {
      return undefined;
    } else {
      return this.contents.sourceArchiveUri;
    }
  }

  private get ignoreSourceArchive(): boolean {
    // Ignore the source archive for QLTest databases.
    return extname(this.databaseUri.fsPath) === ".testproj";
  }

  public get dateAdded(): number | undefined {
    return this.options.dateAdded;
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
        return containsPath(testPath, databasePath);
      } else {
        // database for /one/two/three/test.ql is at /one/two/three/three.testproj
        const testdir = dirname(testPath);
        const testdirbase = basename(testdir);
        return pathsEqual(
          databasePath,
          join(testdir, `${testdirbase}.testproj`),
        );
      }
    } catch {
      // No information available for test path - assume database is unaffected.
      return false;
    }
  }
}
