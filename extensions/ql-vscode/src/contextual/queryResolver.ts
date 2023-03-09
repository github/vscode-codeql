import { writeFile, promises } from "fs-extra";
import { dump } from "js-yaml";
import { file } from "tmp-promise";
import { basename, dirname, resolve } from "path";

import {
  getPrimaryDbscheme,
  getQlPackForDbscheme,
  getOnDiskWorkspaceFolders,
  QlPacksForLanguage,
  showAndLogExceptionWithTelemetry,
} from "../helpers";
import { KeyType, kindOfKeyType, nameOfKeyType, tagOfKeyType } from "./keyType";
import { CodeQLCliServer } from "../cli";
import { DatabaseItem } from "../local-databases";
import { extLogger } from "../common";
import { createInitialQueryInfo } from "../run-queries-shared";
import { CancellationToken, Uri } from "vscode";
import { ProgressCallback } from "../commandRunner";
import { QueryRunner, validateDatabase } from "../queryRunner";
import { redactableError } from "../pure/errors";
import { QLPACK_FILENAMES } from "../pure/ql";

export async function qlpackOfDatabase(
  cli: CodeQLCliServer,
  db: DatabaseItem,
): Promise<QlPacksForLanguage> {
  if (db.contents === undefined) {
    throw new Error("Database is invalid and cannot infer QLPack.");
  }
  const datasetPath = db.contents.datasetUri.fsPath;
  const dbscheme = await getPrimaryDbscheme(datasetPath);
  return await getQlPackForDbscheme(cli, dbscheme);
}

/**
 * Finds the contextual queries with the specified key in a list of CodeQL packs.
 *
 * @param cli The CLI instance to use.
 * @param qlpacks The list of packs to search.
 * @param keyType The contextual query key of the query to search for.
 * @returns The found queries from the first pack in which any matching queries were found.
 */
async function resolveQueriesFromPacks(
  cli: CodeQLCliServer,
  qlpacks: string[],
  keyType: KeyType,
): Promise<string[]> {
  const suiteFile = (
    await file({
      postfix: ".qls",
    })
  ).path;
  const suiteYaml = [];
  for (const qlpack of qlpacks) {
    suiteYaml.push({
      from: qlpack,
      queries: ".",
      include: {
        kind: kindOfKeyType(keyType),
        "tags contain": tagOfKeyType(keyType),
      },
    });
  }
  await writeFile(suiteFile, dump(suiteYaml), "utf8");

  const queries = await cli.resolveQueriesInSuite(
    suiteFile,
    getOnDiskWorkspaceFolders(),
  );
  return queries;
}

export async function resolveQueries(
  cli: CodeQLCliServer,
  qlpacks: QlPacksForLanguage,
  keyType: KeyType,
): Promise<string[]> {
  const packsToSearch: string[] = [];

  // The CLI can handle both library packs and query packs, so search both packs in order.
  packsToSearch.push(qlpacks.dbschemePack);
  if (qlpacks.queryPack !== undefined) {
    packsToSearch.push(qlpacks.queryPack);
  }

  const queries = await resolveQueriesFromPacks(cli, packsToSearch, keyType);
  if (queries.length > 0) {
    return queries;
  }

  // No queries found. Determine the correct error message for the various scenarios.
  const keyTypeName = nameOfKeyType(keyType);
  const keyTypeTag = tagOfKeyType(keyType);
  const joinedPacksToSearch = packsToSearch.join(", ");
  const error = redactableError`No ${keyTypeName} queries (tagged "${keyTypeTag}") could be found in the \
current library path (tried searching the following packs: ${joinedPacksToSearch}). \
Try upgrading the CodeQL libraries. If that doesn't work, then ${keyTypeName} queries are not yet available \
for this language.`;

  void showAndLogExceptionWithTelemetry(error);
  throw error;
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
) {
  const { packPath, createdTempLockFile } = await resolveContextualQuery(
    cli,
    query,
  );
  const initialInfo = await createInitialQueryInfo(
    Uri.file(query),
    {
      name: db.name,
      databaseUri: db.databaseUri.toString(),
    },
    false,
  );
  void extLogger.log(
    `Running contextual query ${query}; results will be stored in ${queryStorageDir}`,
  );
  const queryResult = await qs.compileAndRunQueryAgainstDatabase(
    await validateDatabase(db),
    initialInfo,
    queryStorageDir,
    progress,
    token,
    templates,
  );
  if (createdTempLockFile) {
    await removeTemporaryLockFile(packPath);
  }
  return queryResult;
}
