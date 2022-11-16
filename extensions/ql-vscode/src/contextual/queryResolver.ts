import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import * as tmp from "tmp-promise";
import * as path from "path";

import * as helpers from "../helpers";
import { KeyType, kindOfKeyType, nameOfKeyType, tagOfKeyType } from "./keyType";
import { CodeQLCliServer } from "../cli";
import { DatabaseItem } from "../databases";
import { QlPacksForLanguage } from "../helpers";
import { logger } from "../logging";
import { createInitialQueryInfo } from "../run-queries-shared";
import { CancellationToken, Uri } from "vscode";
import { ProgressCallback } from "../commandRunner";
import { QueryRunner } from "../queryRunner";

export async function qlpackOfDatabase(
  cli: CodeQLCliServer,
  db: DatabaseItem,
): Promise<QlPacksForLanguage> {
  if (db.contents === undefined) {
    throw new Error("Database is invalid and cannot infer QLPack.");
  }
  const datasetPath = db.contents.datasetUri.fsPath;
  const dbscheme = await helpers.getPrimaryDbscheme(datasetPath);
  return await helpers.getQlPackForDbscheme(cli, dbscheme);
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
    await tmp.file({
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
  await fs.writeFile(suiteFile, yaml.dump(suiteYaml), "utf8");

  const queries = await cli.resolveQueriesInSuite(
    suiteFile,
    helpers.getOnDiskWorkspaceFolders(),
  );
  return queries;
}

export async function resolveQueries(
  cli: CodeQLCliServer,
  qlpacks: QlPacksForLanguage,
  keyType: KeyType,
): Promise<string[]> {
  const cliCanHandleLibraryPack =
    await cli.cliConstraints.supportsAllowLibraryPacksInResolveQueries();
  const packsToSearch: string[] = [];
  let blameCli: boolean;

  if (cliCanHandleLibraryPack) {
    // The CLI can handle both library packs and query packs, so search both packs in order.
    packsToSearch.push(qlpacks.dbschemePack);
    if (qlpacks.queryPack !== undefined) {
      packsToSearch.push(qlpacks.queryPack);
    }
    // If we don't find the query, it's because it's not there, not because the CLI was unable to
    // search the pack.
    blameCli = false;
  } else {
    // Older CLIs can't handle `codeql resolve queries` with a suite that references a library pack.
    if (qlpacks.dbschemePackIsLibraryPack) {
      if (qlpacks.queryPack !== undefined) {
        // Just search the query pack, because some older library/query releases still had the
        // contextual queries in the query pack.
        packsToSearch.push(qlpacks.queryPack);
      }
      // If we don't find it, it's because the CLI was unable to search the library pack that
      // actually contains the query. Blame any failure on the CLI, not the packs.
      blameCli = true;
    } else {
      // We have an old CLI, but the dbscheme pack is old enough that it's still a unified pack with
      // both libraries and queries. Just search that pack.
      packsToSearch.push(qlpacks.dbschemePack);
      // Any CLI should be able to search the single query pack, so if we don't find it, it's
      // because the language doesn't support it.
      blameCli = false;
    }
  }

  const queries = await resolveQueriesFromPacks(cli, packsToSearch, keyType);
  if (queries.length > 0) {
    return queries;
  }

  // No queries found. Determine the correct error message for the various scenarios.
  const errorMessage = blameCli
    ? `Your current version of the CodeQL CLI, '${
        (await cli.getVersion()).version
      }', \
    is unable to use contextual queries from recent versions of the standard CodeQL libraries. \
    Please upgrade to the latest version of the CodeQL CLI.`
    : `No ${nameOfKeyType(keyType)} queries (tagged "${tagOfKeyType(
        keyType,
      )}") could be found in the current library path. \
    Try upgrading the CodeQL libraries. If that doesn't work, then ${nameOfKeyType(
      keyType,
    )} queries are not yet available \
    for this language.`;

  void helpers.showAndLogErrorMessage(errorMessage);
  throw new Error(
    `Couldn't find any queries tagged ${tagOfKeyType(
      keyType,
    )} in any of the following packs: ${packsToSearch.join(", ")}.`,
  );
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
    ["codeql-pack.yml", "qlpack.yml"].includes(path.basename(p)),
  );
  if (packFilePath === undefined) {
    // Should not happen; we already resolved this query.
    throw new Error(
      `Could not find a CodeQL pack file for the pack enclosing the contextual query ${query}`,
    );
  }
  const packPath = path.dirname(packFilePath);
  const lockFilePath = packContents.find((p) =>
    ["codeql-pack.lock.yml", "qlpack.lock.yml"].includes(path.basename(p)),
  );
  let createdTempLockFile = false;
  if (!lockFilePath) {
    // No lock file, likely because this library pack is in the package cache.
    // Create a lock file so that we can resolve dependencies and library path
    // for the contextual query.
    void logger.log(
      `Library pack ${packPath} is missing a lock file; creating a temporary lock file`,
    );
    await cli.packResolveDependencies(packPath);
    createdTempLockFile = true;
    // Clear CLI server pack cache before installing dependencies,
    // so that it picks up the new lock file, not the previously cached pack.
    void logger.log("Clearing the CodeQL CLI server's pack cache");
    await cli.clearCache();
    // Install dependencies.
    void logger.log(
      `Installing package dependencies for library pack ${packPath}`,
    );
    await cli.packInstall(packPath);
  }
  return { packPath, createdTempLockFile };
}

async function removeTemporaryLockFile(packPath: string) {
  const tempLockFilePath = path.resolve(packPath, "codeql-pack.lock.yml");
  void logger.log(
    `Deleting temporary package lock file at ${tempLockFilePath}`,
  );
  // It's fine if the file doesn't exist.
  await fs.promises.rm(path.resolve(packPath, "codeql-pack.lock.yml"), {
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
  void logger.log(
    `Running contextual query ${query}; results will be stored in ${queryStorageDir}`,
  );
  const queryResult = await qs.compileAndRunQueryAgainstDatabase(
    db,
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
