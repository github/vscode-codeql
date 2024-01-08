import { Uri } from "vscode";
import { pathExists } from "fs-extra";
import { basename, join, resolve } from "path";
import type {
  DatabaseContents,
  DatabaseContentsWithDbScheme,
} from "./database-contents";
import { DatabaseKind } from "./database-contents";
import { glob } from "glob";
import { encodeArchiveBasePath } from "../../common/vscode/archive-filesystem-provider";
import {
  showAndLogInformationMessage,
  showAndLogWarningMessage,
} from "../../common/logging";
import { extLogger } from "../../common/logging/vscode";

export class DatabaseResolver {
  public static async resolveDatabaseContents(
    uri: Uri,
  ): Promise<DatabaseContentsWithDbScheme> {
    if (uri.scheme !== "file") {
      throw new Error(
        `Database URI scheme '${uri.scheme}' not supported; only 'file' URIs are supported.`,
      );
    }
    const databasePath = uri.fsPath;
    if (!(await pathExists(databasePath))) {
      throw new InvalidDatabaseError(
        `Database '${databasePath}' does not exist.`,
      );
    }

    const contents = await this.resolveDatabase(databasePath);

    if (contents === undefined) {
      throw new InvalidDatabaseError(
        `'${databasePath}' is not a valid database.`,
      );
    }

    // Look for a single dbscheme file within the database.
    // This should be found in the dataset directory, regardless of the form of database.
    const dbPath = contents.datasetUri.fsPath;
    const dbSchemeFiles = await getDbSchemeFiles(dbPath);
    if (dbSchemeFiles.length === 0) {
      throw new InvalidDatabaseError(
        `Database '${databasePath}' does not contain a CodeQL dbscheme under '${dbPath}'.`,
      );
    } else if (dbSchemeFiles.length > 1) {
      throw new InvalidDatabaseError(
        `Database '${databasePath}' contains multiple CodeQL dbschemes under '${dbPath}'.`,
      );
    } else {
      const dbSchemeUri = Uri.file(resolve(dbPath, dbSchemeFiles[0]));
      return {
        ...contents,
        dbSchemeUri,
      };
    }
  }

  public static async resolveDatabase(
    databasePath: string,
  ): Promise<DatabaseContents> {
    const name = basename(databasePath);

    // Look for dataset and source archive.
    const datasetUri = await findDataset(databasePath);
    const sourceArchiveUri = await findSourceArchive(databasePath);

    return {
      kind: DatabaseKind.Database,
      name,
      datasetUri,
      sourceArchiveUri,
    };
  }
}

/**
 * An error thrown when we cannot find a valid database in a putative
 * database directory.
 */
class InvalidDatabaseError extends Error {}

async function findDataset(parentDirectory: string): Promise<Uri> {
  /*
   * Look directly in the root
   */
  let dbRelativePaths = await glob("db-*/", {
    cwd: parentDirectory,
  });

  if (dbRelativePaths.length === 0) {
    /*
     * Check If they are in the old location
     */
    dbRelativePaths = await glob("working/db-*/", {
      cwd: parentDirectory,
    });
  }
  if (dbRelativePaths.length === 0) {
    throw new InvalidDatabaseError(
      `'${parentDirectory}' does not contain a dataset directory.`,
    );
  }

  const dbAbsolutePath = join(parentDirectory, dbRelativePaths[0]);
  if (dbRelativePaths.length > 1) {
    void showAndLogWarningMessage(
      extLogger,
      `Found multiple dataset directories in database, using '${dbAbsolutePath}'.`,
    );
  }

  return Uri.file(dbAbsolutePath);
}

/** Gets the relative paths of all `.dbscheme` files in the given directory. */
async function getDbSchemeFiles(dbDirectory: string): Promise<string[]> {
  return await glob("*.dbscheme", { cwd: dbDirectory });
}

// exported for testing
export async function findSourceArchive(
  databasePath: string,
): Promise<Uri | undefined> {
  const relativePaths = ["src", "output/src_archive"];

  for (const relativePath of relativePaths) {
    const basePath = join(databasePath, relativePath);
    const zipPath = `${basePath}.zip`;

    // Prefer using a zip archive over a directory.
    if (await pathExists(zipPath)) {
      return encodeArchiveBasePath(zipPath);
    } else if (await pathExists(basePath)) {
      return Uri.file(basePath);
    }
  }

  void showAndLogInformationMessage(
    extLogger,
    `Could not find source archive for database '${databasePath}'. Assuming paths are absolute.`,
  );
  return undefined;
}
