import vscode from "vscode";
import * as cli from "../../codeql-cli/cli";
import { DatabaseContents } from "./database-contents";

/** An item in the list of available databases */
export interface DatabaseItem {
  /** The URI of the database */
  readonly databaseUri: vscode.Uri;
  /** The name of the database to be displayed in the UI */
  name: string;

  /** The primary language of the database or empty string if unknown */
  readonly language: string;
  /** The URI of the database's source archive, or `undefined` if no source archive is to be used. */
  readonly sourceArchive: vscode.Uri | undefined;
  /**
   * The contents of the database.
   * Will be `undefined` if the database is invalid. Can be updated by calling `refresh()`.
   */
  readonly contents: DatabaseContents | undefined;

  /**
   * The date this database was added as a unix timestamp. Or undefined if we don't know.
   */
  readonly dateAdded: number | undefined;

  /** If the database is invalid, describes why. */
  readonly error: Error | undefined;

  /**
   * Resolves a filename to its URI in the source archive.
   *
   * @param file Filename within the source archive. May be `undefined` to return a dummy file path.
   */
  resolveSourceFile(file: string | undefined): vscode.Uri;

  /**
   * Holds if the database item has a `.dbinfo` or `codeql-database.yml` file.
   */
  hasMetadataFile(): Promise<boolean>;

  /**
   * Returns `sourceLocationPrefix` of exported database.
   */
  getSourceLocationPrefix(server: cli.CodeQLCliServer): Promise<string>;

  /**
   * Returns dataset folder of exported database.
   */
  getDatasetFolder(server: cli.CodeQLCliServer): Promise<string>;

  /**
   * Returns the root uri of the virtual filesystem for this database's source archive,
   * as displayed in the filesystem explorer.
   */
  getSourceArchiveExplorerUri(): vscode.Uri;

  /**
   * Holds if `uri` belongs to this database's source archive.
   */
  belongsToSourceArchiveExplorerUri(uri: vscode.Uri): boolean;

  /**
   * Whether the database may be affected by test execution for the given path.
   */
  isAffectedByTest(testPath: string): Promise<boolean>;

  /**
   * Verifies that this database item has a zipped source folder. Returns an error message if it does not.
   */
  verifyZippedSources(): string | undefined;
}
