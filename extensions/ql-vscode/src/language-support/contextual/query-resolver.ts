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
import { createLockFileForStandardQuery } from "../../local-queries/standard-queries";

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
  await cleanup?.();
  return results;
}
