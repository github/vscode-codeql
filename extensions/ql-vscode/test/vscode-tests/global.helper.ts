import { join } from "path";
import { load, dump } from "js-yaml";
import { realpathSync, readFileSync, writeFileSync } from "fs-extra";
import { Uri, extensions } from "vscode";
import {
  DatabaseItem,
  DatabaseManager,
} from "../../src/databases/local-databases";
import { CodeQLCliServer } from "../../src/codeql-cli/cli";
import { removeWorkspaceRefs } from "../../src/variant-analysis/run-remote-query";
import { CodeQLExtensionInterface } from "../../src/extension";
import { importArchiveDatabase } from "../../src/databases/database-fetcher";
import { createMockCommandManager } from "../__mocks__/commandsMock";

// This file contains helpers shared between tests that work with an activated extension.

export const DB_URL =
  "https://github.com/github/vscode-codeql/files/5586722/simple-db.zip";

// We need to resolve the path, but the final three segments won't exist until later, so we only resolve the
// first portion of the path.
export const dbLoc = join(
  realpathSync(join(__dirname, "../../../")),
  "build/tests/db.zip",
);
export let storagePath: string;

/**
 * Removes any existing databases from the database panel, and loads the test database.
 */
export async function ensureTestDatabase(
  databaseManager: DatabaseManager,
  cli: CodeQLCliServer | undefined,
): Promise<DatabaseItem> {
  // Add a database, but make sure the database manager is empty first
  await cleanDatabases(databaseManager);
  const uri = Uri.file(dbLoc);
  const maybeDbItem = await importArchiveDatabase(
    createMockCommandManager(),
    uri.toString(true),
    databaseManager,
    storagePath,
    (_p) => {
      /**/
    },
    cli,
  );

  if (!maybeDbItem) {
    throw new Error("Could not import database");
  }

  return maybeDbItem;
}

export function setStoragePath(path: string) {
  storagePath = path;
}

export async function getActivatedExtension(): Promise<CodeQLExtensionInterface> {
  const extension = await extensions
    .getExtension<CodeQLExtensionInterface | undefined>("GitHub.vscode-codeql")
    ?.activate();
  if (extension === undefined) {
    throw new Error(
      "Unable to active CodeQL extension. Make sure cli is downloaded and installed properly.",
    );
  }
  return extension;
}

export async function cleanDatabases(databaseManager: DatabaseManager) {
  await databaseManager.removeAllDatabases();
}

/**
 * Conditionally removes `${workspace}` references from a qlpack.yml or codeql-pack.yml file.
 * CLI versions earlier than 2.11.3 do not support `${workspace}` references in the dependencies block.
 * If workspace references are removed, the qlpack.yml or codeql-pack.yml file is re-written to disk
 * without the `${workspace}` references and the original dependencies are returned.
 *
 * @param qlpackFileWithWorkspaceRefs The qlpack.yml or codeql-pack.yml file with workspace refs
 * @param cli The cli to use to check version constraints
 * @returns The original dependencies with workspace refs, or undefined if the CLI version supports workspace refs and no changes were made
 */
export async function fixWorkspaceReferences(
  qlpackFileWithWorkspaceRefs: string,
  cli: CodeQLCliServer,
): Promise<Record<string, string> | undefined> {
  if (!(await cli.cliConstraints.supportsWorkspaceReferences())) {
    // remove the workspace references from the qlpack
    const qlpack = load(readFileSync(qlpackFileWithWorkspaceRefs, "utf8")) as {
      dependencies: Record<string, string>;
    };
    const originalDeps = { ...qlpack.dependencies };
    removeWorkspaceRefs(qlpack);
    writeFileSync(qlpackFileWithWorkspaceRefs, dump(qlpack));
    return originalDeps;
  }
  return undefined;
}

/**
 * Restores the original dependencies with `${workspace}` refs to a qlpack.yml or codeql-pack.yml file.
 * See `fixWorkspaceReferences` for more details.
 *
 * @param qlpackFileWithWorkspaceRefs The qlpack.yml or codeql-pack.yml file to restore workspace refs
 * @param originalDeps the original dependencies with workspace refs or undefined if
 *  no changes were made.
 */
export async function restoreWorkspaceReferences(
  qlpackFileWithWorkspaceRefs: string,
  originalDeps?: Record<string, string>,
) {
  if (!originalDeps) {
    return;
  }
  const qlpack = load(readFileSync(qlpackFileWithWorkspaceRefs, "utf8")) as {
    dependencies: Record<string, string>;
  };
  qlpack.dependencies = originalDeps;
  writeFileSync(qlpackFileWithWorkspaceRefs, dump(qlpack));
}
