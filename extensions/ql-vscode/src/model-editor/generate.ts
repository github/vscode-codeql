import type { CancellationToken } from "vscode";
import type { DatabaseItem } from "../databases/local-databases";
import { basename } from "path";
import type { QueryRunner } from "../query-server";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { ProgressCallback } from "../common/vscode/progress";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { runQuery } from "../local-queries/run-query";
import type { QueryConstraints } from "../local-queries";
import { resolveQueries } from "../local-queries";
import type { DecodedBqrs } from "../common/bqrs-cli-types";

type GenerateQueriesOptions = {
  queryConstraints: QueryConstraints;
  filterQueries?: (queryPath: string) => boolean;
  onResults: (queryPath: string, results: DecodedBqrs) => void | Promise<void>;

  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  queryStorageDir: string;
  databaseItem: DatabaseItem;
  progress: ProgressCallback;
  token: CancellationToken;
};

export async function runGenerateQueries(options: GenerateQueriesOptions) {
  const { queryConstraints, filterQueries, onResults } = options;

  options.progress({
    message: "Resolving queries",
    step: 1,
    maxStep: 5000,
  });

  const packsToSearch = [`codeql/${options.databaseItem.language}-queries`];
  const queryPaths = await resolveQueries(
    options.cliServer,
    packsToSearch,
    "generate model",
    queryConstraints,
  );

  const filteredQueryPaths = filterQueries
    ? queryPaths.filter(filterQueries)
    : queryPaths;

  const maxStep = filteredQueryPaths.length * 1000;

  for (let i = 0; i < filteredQueryPaths.length; i++) {
    const queryPath = filteredQueryPaths[i];

    const bqrs = await runSingleGenerateQuery(queryPath, i, maxStep, options);
    if (bqrs) {
      await onResults(queryPath, bqrs);
    }
  }
}

async function runSingleGenerateQuery(
  queryPath: string,
  queryStep: number,
  maxStep: number,
  {
    cliServer,
    queryRunner,
    queryStorageDir,
    databaseItem,
    progress,
    token,
  }: GenerateQueriesOptions,
): Promise<DecodedBqrs | undefined> {
  const queryBasename = basename(queryPath);

  // Run the query
  const completedQuery = await runQuery({
    queryRunner,
    databaseItem,
    queryPath,
    queryStorageDir,
    additionalPacks: getOnDiskWorkspaceFolders(),
    extensionPacks: undefined,
    progress: ({ step, message }) =>
      progress({
        message: `Generating model from ${queryBasename}: ${message}`,
        step: queryStep * 1000 + step,
        maxStep,
      }),
    token,
  });

  if (!completedQuery) {
    return undefined;
  }

  return cliServer.bqrsDecodeAll(completedQuery.outputDir.bqrsPath);
}
