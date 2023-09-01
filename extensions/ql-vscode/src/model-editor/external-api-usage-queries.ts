import { QueryRunner } from "../query-server";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { extLogger } from "../common/logging/vscode";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import { CancellationToken } from "vscode";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { DatabaseItem } from "../databases/local-databases";
import { ProgressCallback } from "../common/vscode/progress";
import { redactableError } from "../common/errors";
import { telemetryListener } from "../common/vscode/telemetry";
import { join } from "path";
import { Mode } from "./shared/mode";
import { writeFile } from "fs-extra";
import { QueryLanguage } from "../common/query-language";
import { fetchExternalApiQueries } from "./queries";
import { Method } from "./method";
import { runQuery } from "../local-queries/run-query";
import { decodeBqrsToExternalApiUsages } from "./bqrs";

type RunQueryOptions = {
  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  databaseItem: DatabaseItem;
  queryStorageDir: string;
  queryDir: string;

  progress: ProgressCallback;
  token: CancellationToken;
};

export async function prepareExternalApiQuery(
  queryDir: string,
  language: QueryLanguage,
): Promise<boolean> {
  // Resolve the query that we want to run.
  const query = fetchExternalApiQueries[language];
  if (!query) {
    void showAndLogExceptionWithTelemetry(
      extLogger,
      telemetryListener,
      redactableError`No external API usage query found for language ${language}`,
    );
    return false;
  }
  // Create the query file.
  Object.values(Mode).map(async (mode) => {
    const queryFile = join(queryDir, queryNameFromMode(mode));
    await writeFile(queryFile, query[`${mode}ModeQuery`], "utf8");
  });

  // Create any dependencies
  if (query.dependencies) {
    for (const [filename, contents] of Object.entries(query.dependencies)) {
      const dependencyFile = join(queryDir, filename);
      await writeFile(dependencyFile, contents, "utf8");
    }
  }
  return true;
}

export async function runExternalApiQueries(
  mode: Mode,
  {
    cliServer,
    queryRunner,
    databaseItem,
    queryStorageDir,
    queryDir,
    progress,
    token,
  }: RunQueryOptions,
): Promise<Method[] | undefined> {
  // The below code is temporary to allow for rapid prototyping of the queries. Once the queries are stabilized, we will
  // move these queries into the `github/codeql` repository and use them like any other contextual (e.g. AST) queries.
  // This is intentionally not pretty code, as it will be removed soon.
  // For a reference of what this should do in the future, see the previous implementation in
  // https://github.com/github/vscode-codeql/blob/089d3566ef0bc67d9b7cc66e8fd6740b31c1c0b0/extensions/ql-vscode/src/data-extensions-editor/external-api-usage-query.ts#L33-L72

  const additionalPacks = getOnDiskWorkspaceFolders();
  const extensionPacks = Object.keys(
    await cliServer.resolveQlpacks(additionalPacks, true),
  );

  const queryPath = join(queryDir, queryNameFromMode(mode));

  // Run the actual query
  const completedQuery = await runQuery({
    cliServer,
    queryRunner,
    databaseItem,
    queryPath,
    queryStorageDir,
    additionalPacks,
    extensionPacks,
    progress,
    token,
    // We need to create a lock file, because the query is inside our own pack
    createLockFile: true,
  });

  if (!completedQuery) {
    return;
  }

  // Read the results and covert to internal representation
  progress({
    message: "Decoding results",
    step: 1100,
    maxStep: 1500,
  });

  const bqrsChunk = await readQueryResults({
    cliServer,
    bqrsPath: completedQuery.outputDir.bqrsPath,
  });
  if (!bqrsChunk) {
    return;
  }

  progress({
    message: "Finalizing results",
    step: 1450,
    maxStep: 1500,
  });

  return decodeBqrsToExternalApiUsages(bqrsChunk);
}

type GetResultsOptions = {
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

function queryNameFromMode(mode: Mode): string {
  return `FetchExternalApis${
    mode.charAt(0).toUpperCase() + mode.slice(1)
  }Mode.ql`;
}
