import { CoreCompletedQuery, QueryRunner } from "../query-server";
import { dir } from "tmp-promise";
import { writeFile } from "fs-extra";
import { dump as dumpYaml } from "js-yaml";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { extLogger, TeeLogger } from "../common";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import { isQueryLanguage } from "../common/query-language";
import { CancellationToken } from "vscode";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { DatabaseItem } from "../databases/local-databases";
import { ProgressCallback } from "../common/vscode/progress";
import { fetchExternalApiQueries } from "./queries";
import { QueryResultType } from "../pure/new-messages";
import { join } from "path";
import { redactableError } from "../common/errors";
import { telemetryListener } from "../common/vscode/telemetry";

export type RunQueryOptions = {
  cliServer: Pick<CodeQLCliServer, "resolveQlpacks">;
  queryRunner: Pick<QueryRunner, "createQueryRun" | "logger">;
  databaseItem: Pick<DatabaseItem, "contents" | "databaseUri" | "language">;
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
  // The below code is temporary to allow for rapid prototyping of the queries. Once the queries are stabilized, we will
  // move these queries into the `github/codeql` repository and use them like any other contextual (e.g. AST) queries.
  // This is intentionally not pretty code, as it will be removed soon.
  // For a reference of what this should do in the future, see the previous implementation in
  // https://github.com/github/vscode-codeql/blob/089d3566ef0bc67d9b7cc66e8fd6740b31c1c0b0/extensions/ql-vscode/src/data-extensions-editor/external-api-usage-query.ts#L33-L72

  if (!isQueryLanguage(databaseItem.language)) {
    void showAndLogExceptionWithTelemetry(
      extLogger,
      telemetryListener,
      redactableError`Unsupported database language ${databaseItem.language}`,
    );
    return;
  }

  const query = fetchExternalApiQueries[databaseItem.language];
  if (!query) {
    void showAndLogExceptionWithTelemetry(
      extLogger,
      telemetryListener,
      redactableError`No external API usage query found for language ${databaseItem.language}`,
    );
    return;
  }

  const queryDir = (await dir({ unsafeCleanup: true })).path;
  const queryFile = join(queryDir, "FetchExternalApis.ql");
  await writeFile(queryFile, query.mainQuery, "utf8");

  if (query.dependencies) {
    for (const [filename, contents] of Object.entries(query.dependencies)) {
      const dependencyFile = join(queryDir, filename);
      await writeFile(dependencyFile, contents, "utf8");
    }
  }

  const syntheticQueryPack = {
    name: "codeql/external-api-usage",
    version: "0.0.0",
    dependencies: {
      [`codeql/${databaseItem.language}-all`]: "*",
    },
  };

  const qlpackFile = join(queryDir, "codeql-pack.yml");
  await writeFile(qlpackFile, dumpYaml(syntheticQueryPack), "utf8");

  const additionalPacks = getOnDiskWorkspaceFolders();
  const extensionPacks = Object.keys(
    await cliServer.resolveQlpacks(additionalPacks, true),
  );

  const queryRun = queryRunner.createQueryRun(
    databaseItem.databaseUri.fsPath,
    {
      queryPath: queryFile,
      quickEvalPosition: undefined,
      quickEvalCountOnly: false,
    },
    false,
    getOnDiskWorkspaceFolders(),
    extensionPacks,
    queryStorageDir,
    undefined,
    undefined,
  );

  const completedQuery = await queryRun.evaluate(
    progress,
    token,
    new TeeLogger(queryRunner.logger, queryRun.outputDir.logPath),
  );

  if (completedQuery.resultType !== QueryResultType.SUCCESS) {
    void showAndLogExceptionWithTelemetry(
      extLogger,
      telemetryListener,
      redactableError`External API usage query failed: ${
        completedQuery.message ?? "No message"
      }`,
    );
    return;
  }

  return completedQuery;
}

export type GetResultsOptions = {
  cliServer: Pick<CodeQLCliServer, "bqrsInfo" | "bqrsDecode">;
  bqrsPath: string;
};

export async function readQueryResults({
  cliServer,
  bqrsPath,
}: GetResultsOptions) {
  const bqrsInfo = await cliServer.bqrsInfo(bqrsPath);
  if (bqrsInfo["result-sets"].length !== 1) {
    void showAndLogExceptionWithTelemetry(
      extLogger,
      telemetryListener,
      redactableError`Expected exactly one result set, got ${bqrsInfo["result-sets"].length}`,
    );
    return undefined;
  }

  const resultSet = bqrsInfo["result-sets"][0];

  return cliServer.bqrsDecode(bqrsPath, resultSet.name);
}
