import { CancellationToken } from "vscode";
import { DatabaseItem } from "../databases/local-databases";
import { basename } from "path";
import { QueryRunner } from "../query-server";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { ProgressCallback } from "../common/vscode/progress";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { ModeledMethod } from "./modeled-method";
import { runQuery } from "../local-queries/run-query";
import { QueryConstraints, resolveQueries } from "../local-queries";
import { DecodedBqrs } from "../common/bqrs-cli-types";

/**
 * Options that are set by the caller of `runGenerateQueries`.
 */
type GenerateQueriesQueryOptions = {
  queryConstraints: QueryConstraints;
  filterQueries?: (queryPath: string) => boolean;
  parseResults: (
    queryPath: string,
    results: DecodedBqrs,
  ) => ModeledMethod[] | Promise<ModeledMethod[]>;
};

/**
 * Options that are passed through by the caller of `runGenerateQueries`.
 */
export type GenerateQueriesOptions = {
  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  queryStorageDir: string;
  databaseItem: DatabaseItem;
  progress: ProgressCallback;
  token: CancellationToken;
  onResults: (results: ModeledMethod[]) => void | Promise<void>;
};

export async function runGenerateQueries(
  {
    queryConstraints,
    filterQueries,
    parseResults,
  }: GenerateQueriesQueryOptions,
  { onResults, ...options }: GenerateQueriesOptions,
) {
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
      await onResults(await parseResults(queryPath, bqrs));
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
  }: Omit<GenerateQueriesOptions, "onResults">,
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
