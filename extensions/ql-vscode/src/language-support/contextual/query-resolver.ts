import { promises } from "fs-extra";
import { basename, dirname, resolve } from "path";

import { getOnDiskWorkspaceFolders } from "../../common/vscode/workspace-folders";
import { QlPacksForLanguage } from "../../databases/qlpack";
import {
  KeyType,
  kindOfKeyType,
  nameOfKeyType,
  tagOfKeyType,
} from "./key-type";
import { CodeQLCliServer } from "../../codeql-cli/cli";
import { DatabaseItem } from "../../databases/local-databases";
import { resolveQueries as resolveLocalQueries } from "../../local-queries/query-resolver";
import { extLogger } from "../../common/logging/vscode";
import { TeeLogger } from "../../common/logging";
import { CancellationToken } from "vscode";
import { ProgressCallback } from "../../common/vscode/progress";
import { CoreCompletedQuery, QueryRunner } from "../../query-server";
import { QLPACK_FILENAMES } from "../../common/ql";

export async function resolveQueries(
  cli: CodeQLCliServer,
  qlpacks: QlPacksForLanguage,
  keyType: KeyType,
): Promise<string[]> {
  return resolveLocalQueries(cli, qlpacks, nameOfKeyType(keyType), {
    kind: kindOfKeyType(keyType),
    "tags contain": [tagOfKeyType(keyType)],
  });
}

async function resolveContextualQuery(
  cli: CodeQLCliServer,
  query: string,
): Promise<{ packPath: string; createdTempLockFile: boolean }> {
  // Contextual queries now live within the standard library packs.
  // This simplifies distribution (you don't need the standard query pack to use the AST viewer),
  // but if the library pack doesn't have a lockfile, we won't be able to find
  // other pack dependencies of the library pack.

  // Work out the enclosing pack.
  const packContents = await cli.packPacklist(query, false);
  const packFilePath = packContents.find((p) =>
    QLPACK_FILENAMES.includes(basename(p)),
  );
  if (packFilePath === undefined) {
    // Should not happen; we already resolved this query.
    throw new Error(
      `Could not find a CodeQL pack file for the pack enclosing the contextual query ${query}`,
    );
  }
  const packPath = dirname(packFilePath);
  const lockFilePath = packContents.find((p) =>
    ["codeql-pack.lock.yml", "qlpack.lock.yml"].includes(basename(p)),
  );
  let createdTempLockFile = false;
  if (!lockFilePath) {
    // No lock file, likely because this library pack is in the package cache.
    // Create a lock file so that we can resolve dependencies and library path
    // for the contextual query.
    void extLogger.log(
      `Library pack ${packPath} is missing a lock file; creating a temporary lock file`,
    );
    await cli.packResolveDependencies(packPath);
    createdTempLockFile = true;
    // Clear CLI server pack cache before installing dependencies,
    // so that it picks up the new lock file, not the previously cached pack.
    void extLogger.log("Clearing the CodeQL CLI server's pack cache");
    await cli.clearCache();
    // Install dependencies.
    void extLogger.log(
      `Installing package dependencies for library pack ${packPath}`,
    );
    await cli.packInstall(packPath);
  }
  return { packPath, createdTempLockFile };
}

async function removeTemporaryLockFile(packPath: string) {
  const tempLockFilePath = resolve(packPath, "codeql-pack.lock.yml");
  void extLogger.log(
    `Deleting temporary package lock file at ${tempLockFilePath}`,
  );
  // It's fine if the file doesn't exist.
  await promises.rm(resolve(packPath, "codeql-pack.lock.yml"), {
    force: true,
  });
}

export async function runContextualQuery(
  query: string,
  db: DatabaseItem,
  queryStorageDir: string,
  qs: QueryRunner,
  cli: CodeQLCliServer,
  progress: ProgressCallback,
  token: CancellationToken,
  templates: Record<string, string>,
): Promise<CoreCompletedQuery> {
  const { packPath, createdTempLockFile } = await resolveContextualQuery(
    cli,
    query,
  );
  const queryRun = qs.createQueryRun(
    db.databaseUri.fsPath,
    { queryPath: query, quickEvalPosition: undefined },
    false,
    getOnDiskWorkspaceFolders(),
    undefined,
    queryStorageDir,
    undefined,
    templates,
  );
  void extLogger.log(
    `Running contextual query ${query}; results will be stored in ${queryRun.outputDir.querySaveDir}`,
  );
  const results = await queryRun.evaluate(
    progress,
    token,
    new TeeLogger(qs.logger, queryRun.outputDir.logPath),
  );
  if (createdTempLockFile) {
    await removeTemporaryLockFile(packPath);
  }
  return results;
}
