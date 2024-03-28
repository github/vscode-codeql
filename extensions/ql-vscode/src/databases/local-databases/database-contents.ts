import { pathExists, remove } from "fs-extra";
import { join } from "path";
import type { Uri } from "vscode";
import { zip } from "zip-a-folder";

/**
 * The layout of the database.
 */
export enum DatabaseKind {
  /** A CodeQL database */
  Database,
  /** A raw QL dataset */
  RawDataset,
}

export interface DatabaseContents {
  /** The layout of the database */
  kind: DatabaseKind;
  /**
   * The name of the database.
   */
  name: string;
  /** The URI of the QL dataset within the database. */
  datasetUri: Uri;
  /** The URI of the source archive within the database, if one exists. */
  sourceArchiveUri?: Uri;
  /** The URI of the CodeQL database scheme within the database, if exactly one exists. */
  dbSchemeUri?: Uri;
}

export interface DatabaseContentsWithDbScheme extends DatabaseContents {
  dbSchemeUri: Uri; // Always present
}

/**
 * Databases created by the old odasa tool will not have a zipped
 * source location. However, this extension works better if sources
 * are zipped.
 *
 * This function ensures that the source location is zipped. If the
 * `src` folder exists and the `src.zip` file does not, the `src`
 * folder will be zipped and then deleted.
 *
 * @param databasePath The full path to the unzipped database
 */
export async function ensureZippedSourceLocation(
  databasePath: string,
): Promise<void> {
  const srcFolderPath = join(databasePath, "src");
  const srcZipPath = `${srcFolderPath}.zip`;

  if ((await pathExists(srcFolderPath)) && !(await pathExists(srcZipPath))) {
    await zip(srcFolderPath, srcZipPath);
    await remove(srcFolderPath);
  }
}
