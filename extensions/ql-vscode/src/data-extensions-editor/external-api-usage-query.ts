import { CoreCompletedQuery, QueryRunner } from "../queryRunner";
import { qlpackOfDatabase } from "../contextual/queryResolver";
import { file } from "tmp-promise";
import { writeFile } from "fs-extra";
import { dump } from "js-yaml";
import { getOnDiskWorkspaceFolders } from "../helpers";
import { extLogger, TeeLogger } from "../common";
import { CancellationToken } from "vscode";
import { CodeQLCliServer } from "../cli";
import { DatabaseItem } from "../local-databases";
import { ProgressCallback } from "../progress";

export type RunQueryOptions = {
  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  databaseItem: DatabaseItem;
  queryStorageDir: string;

  progress: ProgressCallback;
  token: CancellationToken;
};

export async function runQuery({
  cliServer,
  queryRunner,
  databaseItem,
  queryStorageDir,
  progress,
  token,
}: RunQueryOptions): Promise<CoreCompletedQuery | undefined> {
  const qlpacks = await qlpackOfDatabase(cliServer, databaseItem);

  const packsToSearch = [qlpacks.dbschemePack];
  if (qlpacks.queryPack) {
    packsToSearch.push(qlpacks.queryPack);
  }

  const suiteFile = (
    await file({
      postfix: ".qls",
    })
  ).path;
  const suiteYaml = [];
  for (const qlpack of packsToSearch) {
    suiteYaml.push({
      from: qlpack,
      queries: ".",
      include: {
        id: `${databaseItem.language}/telemetry/fetch-external-apis`,
      },
    });
  }
  await writeFile(suiteFile, dump(suiteYaml), "utf8");

  const queries = await cliServer.resolveQueriesInSuite(
    suiteFile,
    getOnDiskWorkspaceFolders(),
  );

  if (queries.length !== 1) {
    void extLogger.log(`Expected exactly one query, got ${queries.length}`);
    return;
  }

  const query = queries[0];

  const queryRun = queryRunner.createQueryRun(
    databaseItem.databaseUri.fsPath,
    { queryPath: query, quickEvalPosition: undefined },
    false,
    getOnDiskWorkspaceFolders(),
    undefined,
    queryStorageDir,
    undefined,
    undefined,
  );

  return queryRun.evaluate(
    progress,
    token,
    new TeeLogger(queryRunner.logger, queryRun.outputDir.logPath),
  );
}

export type GetResultsOptions = {
  cliServer: CodeQLCliServer;
  bqrsPath: string;
};

export async function getResults({ cliServer, bqrsPath }: GetResultsOptions) {
  const bqrsInfo = await cliServer.bqrsInfo(bqrsPath);
  if (bqrsInfo["result-sets"].length !== 1) {
    void extLogger.log(
      `Expected exactly one result set, got ${bqrsInfo["result-sets"].length}`,
    );
    return undefined;
  }

  const resultSet = bqrsInfo["result-sets"][0];

  return cliServer.bqrsDecode(bqrsPath, resultSet.name);
}
