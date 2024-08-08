import { getOnDiskWorkspaceFolders } from "../../common/vscode/workspace-folders";
import type { QlPacksForLanguage } from "../../databases/qlpack";
import type { KeyType } from "./key-type";
import { kindOfKeyType, nameOfKeyType, tagOfKeyType } from "./key-type";
import type { CodeQLCliServer } from "../../codeql-cli/cli";
import type { DatabaseItem } from "../../databases/local-databases";
import {
  qlpackOfDatabase,
  resolveQueriesByLanguagePack as resolveLocalQueriesByLanguagePack,
} from "../../local-queries/query-resolver";
import { extLogger } from "../../common/logging/vscode";
import { TeeLogger } from "../../common/logging";
import type { CancellationToken } from "vscode";
import type { ProgressCallback } from "../../common/vscode/progress";
import type { CoreCompletedQuery, QueryRunner } from "../../query-server";
import { createLockFileForStandardQuery } from "../../local-queries/standard-queries";

/**
 * This wil try to determine the qlpacks for a given database. If it can't find a matching
 * dbscheme with downloaded packs, it will download the default packs instead.
 *
 * @param cli The CLI server to use
 * @param databaseItem The database item to find the qlpacks for
 */
export async function resolveContextualQlPacksForDatabase(
  cli: CodeQLCliServer,
  databaseItem: DatabaseItem,
): Promise<QlPacksForLanguage> {
  try {
    return await qlpackOfDatabase(cli, databaseItem);
  } catch {
    // If we can't find the qlpacks for the database, use the defaults instead
  }

  const dbInfo = await cli.resolveDatabase(databaseItem.databaseUri.fsPath);
  const primaryLanguage = dbInfo.languages?.[0];
  if (!primaryLanguage) {
    throw new Error("Unable to determine primary language of database");
  }

  const libraryPack = `codeql/${primaryLanguage}-all`;
  const queryPack = `codeql/${primaryLanguage}-queries`;

  await cli.packDownload([libraryPack, queryPack]);

  // Return the default packs. If these weren't valid packs, the download would have failed.
  return {
    dbschemePack: libraryPack,
    dbschemePackIsLibraryPack: true,
    queryPack,
  };
}

export async function resolveContextualQueries(
  cli: CodeQLCliServer,
  qlpacks: QlPacksForLanguage,
  keyType: KeyType,
): Promise<string[]> {
  return resolveLocalQueriesByLanguagePack(
    cli,
    qlpacks,
    nameOfKeyType(keyType),
    {
      kind: kindOfKeyType(keyType),
      "tags contain": [tagOfKeyType(keyType)],
    },
  );
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
  const { cleanup } = await createLockFileForStandardQuery(cli, query);
  const queryRun = qs.createQueryRun(
    db.databaseUri.fsPath,
    { queryPath: query, quickEvalPosition: undefined },
    false,
    getOnDiskWorkspaceFolders(),
    undefined,
    {},
    queryStorageDir,
    undefined,
    templates,
  );
  void extLogger.log(
    `Running contextual query ${query}; results will be stored in ${queryRun.outputDir.querySaveDir}`,
  );
  const teeLogger = new TeeLogger(qs.logger, queryRun.outputDir.logPath);

  try {
    return await queryRun.evaluate(progress, token, teeLogger);
  } finally {
    await cleanup?.();
    teeLogger.dispose();
  }
}
