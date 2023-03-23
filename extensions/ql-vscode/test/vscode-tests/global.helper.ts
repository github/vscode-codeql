import { join } from "path";
import { load, dump } from "js-yaml";
import { realpathSync, readFileSync, writeFileSync } from "fs-extra";
import { commands, extensions } from "vscode";
import { DatabaseManager } from "../../src/local-databases";
import { CodeQLCliServer } from "../../src/cli";
import { removeWorkspaceRefs } from "../../src/variant-analysis/run-remote-query";
import { CodeQLExtensionInterface } from "../../src/extension";

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

export function setStoragePath(path: string) {
  storagePath = path;
}

export async function getActivatedExtension(): Promise<CodeQLExtensionInterface> {
  const extension = await extensions
    .getExtension<CodeQLExtensionInterface | undefined>("GitHub.vscode-codeql")
    ?.activate();
  if (extension === undefined) {
    throw new Error("Unable to active CodeQL extension");
  }
  return extension;
}

export async function cleanDatabases(databaseManager: DatabaseManager) {
  for (const item of databaseManager.databaseItems) {
    await commands.executeCommand("codeQLDatabases.removeDatabase", item);
  }
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
    const qlpack = load(readFileSync(qlpackFileWithWorkspaceRefs, "utf8"));
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
  const qlpack = load(readFileSync(qlpackFileWithWorkspaceRefs, "utf8"));
  qlpack.dependencies = originalDeps;
  writeFileSync(qlpackFileWithWorkspaceRefs, dump(qlpack));
}
