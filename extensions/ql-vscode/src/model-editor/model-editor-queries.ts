import type { QueryRunner } from "../query-server";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import type { NotificationLogger } from "../common/logging";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import type { CancellationToken } from "vscode";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { DatabaseItem } from "../databases/local-databases";
import type { ProgressCallback } from "../common/vscode/progress";
import { UserCancellationException } from "../common/vscode/progress";
import { redactableError } from "../common/errors";
import { telemetryListener } from "../common/vscode/telemetry";
import { join } from "path";
import { Mode } from "./shared/mode";
import { outputFile, writeFile } from "fs-extra";
import type { QueryLanguage } from "../common/query-language";
import { fetchExternalApiQueries } from "./queries";
import type { Method } from "./method";
import { runQuery } from "../local-queries/run-query";
import { decodeBqrsToMethods } from "./bqrs";
import { resolveQueriesFromPacks } from "../local-queries";
import { modeTag } from "./mode-tag";

export const syntheticQueryPackName = "codeql/model-editor-queries";

type RunQueryOptions = {
  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  logger: NotificationLogger;
  databaseItem: DatabaseItem;
  language: QueryLanguage;
  queryStorageDir: string;
  queryDir: string;

  progress: ProgressCallback;
  token: CancellationToken;
};

export async function prepareModelEditorQueries(
  logger: NotificationLogger,
  queryDir: string,
  language: QueryLanguage,
): Promise<boolean> {
  // Resolve the query that we want to run.
  const query = fetchExternalApiQueries[language];
  if (!query) {
    void showAndLogExceptionWithTelemetry(
      logger,
      telemetryListener,
      redactableError`No bundled model editor query found for language ${language}`,
    );
    return false;
  }
  // Create the query file.
  await Promise.all(
    Object.values(Mode).map(async (mode) => {
      const queryFile = join(queryDir, queryNameFromMode(mode));
      await writeFile(queryFile, query[`${mode}ModeQuery`], "utf8");
    }),
  );

  // Create any dependencies
  if (query.dependencies) {
    for (const [filename, contents] of Object.entries(query.dependencies)) {
      const dependencyFile = join(queryDir, filename);
      await outputFile(dependencyFile, contents, "utf8");
    }
  }
  return true;
}

export const externalApiQueriesProgressMaxStep = 2000;

export async function runModelEditorQueries(
  mode: Mode,
  {
    cliServer,
    queryRunner,
    logger,
    databaseItem,
    language,
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

  if (token.isCancellationRequested) {
    throw new UserCancellationException(
      "Run model editor queries cancelled.",
      true,
    );
  }

  progress({
    message: "Resolving QL packs",
    step: 1,
    maxStep: externalApiQueriesProgressMaxStep,
  });
  const additionalPacks = getOnDiskWorkspaceFolders();
  const extensionPacks = Object.keys(
    await cliServer.resolveQlpacks(additionalPacks, true),
  );

  if (token.isCancellationRequested) {
    throw new UserCancellationException(
      "Run model editor queries cancelled.",
      true,
    );
  }

  progress({
    message: "Resolving query",
    step: 2,
    maxStep: externalApiQueriesProgressMaxStep,
  });

  // Resolve the queries from either codeql/java-queries or from the temporary queryDir
  const queryPath = await resolveEndpointsQuery(
    cliServer,
    databaseItem.language,
    mode,
    [syntheticQueryPackName],
    [queryDir],
  );
  if (!queryPath) {
    void showAndLogExceptionWithTelemetry(
      logger,
      telemetryListener,
      redactableError`The ${mode} model editor query could not be found. Try re-opening the model editor. If that doesn't work, try upgrading the CodeQL libraries.`,
    );
    return;
  }

  // Run the actual query
  const completedQuery = await runQuery({
    queryRunner,
    databaseItem,
    queryPath,
    queryStorageDir,
    additionalPacks,
    extensionPacks,
    progress: (update) =>
      progress({
        step: update.step + 500,
        maxStep: externalApiQueriesProgressMaxStep,
        message: update.message,
      }),
    token,
  });

  if (!completedQuery) {
    return;
  }

  if (token.isCancellationRequested) {
    throw new UserCancellationException(
      "Run model editor queries cancelled.",
      true,
    );
  }

  // Read the results and covert to internal representation
  progress({
    message: "Decoding results",
    step: 1600,
    maxStep: externalApiQueriesProgressMaxStep,
  });

  const bqrsChunk = await readQueryResults({
    cliServer,
    logger,
    bqrsPath: completedQuery.outputDir.bqrsPath,
  });
  if (!bqrsChunk) {
    return;
  }

  if (token.isCancellationRequested) {
    throw new UserCancellationException(
      "Run model editor queries cancelled.",
      true,
    );
  }

  progress({
    message: "Finalizing results",
    step: 1950,
    maxStep: externalApiQueriesProgressMaxStep,
  });

  return decodeBqrsToMethods(bqrsChunk, mode, language);
}

type GetResultsOptions = {
  cliServer: Pick<CodeQLCliServer, "bqrsInfo" | "bqrsDecode">;
  logger: NotificationLogger;
  bqrsPath: string;
};

export async function readQueryResults({
  cliServer,
  logger,
  bqrsPath,
}: GetResultsOptions) {
  const bqrsInfo = await cliServer.bqrsInfo(bqrsPath);
  if (bqrsInfo["result-sets"].length !== 1) {
    void showAndLogExceptionWithTelemetry(
      logger,
      telemetryListener,
      redactableError`Expected exactly one result set, got ${bqrsInfo["result-sets"].length}`,
    );
    return undefined;
  }

  const resultSet = bqrsInfo["result-sets"][0];

  return cliServer.bqrsDecode(bqrsPath, resultSet.name);
}

/**
 * Resolve the query path to the model editor endpoints query. All queries are tagged like this:
 * modeleditor endpoints <mode>
 * Example: modeleditor endpoints framework-mode
 *
 * @param cliServer The CodeQL CLI server to use.
 * @param language The language of the query pack to use.
 * @param mode The mode to resolve the query for.
 * @param additionalPackNames Additional pack names to search.
 * @param additionalPackPaths Additional pack paths to search.
 */
export async function resolveEndpointsQuery(
  cliServer: CodeQLCliServer,
  language: string,
  mode: Mode,
  additionalPackNames: string[] = [],
  additionalPackPaths: string[] = [],
): Promise<string | undefined> {
  const packsToSearch = [`codeql/${language}-queries`, ...additionalPackNames];

  // First, resolve the query that we want to run.
  // All queries are tagged like this:
  // internal extract automodel <mode> <queryTag>
  // Example: internal extract automodel framework-mode candidates
  const queries = await resolveQueriesFromPacks(
    cliServer,
    packsToSearch,
    {
      kind: "table",
      "tags contain all": ["modeleditor", "endpoints", modeTag(mode)],
    },
    additionalPackPaths,
  );
  if (queries.length > 1) {
    throw new Error(
      `Found multiple endpoints queries for ${mode}. Can't continue`,
    );
  }

  if (queries.length === 0) {
    return undefined;
  }

  return queries[0];
}

function queryNameFromMode(mode: Mode): string {
  return `${mode.charAt(0).toUpperCase() + mode.slice(1)}ModeEndpoints.ql`;
}
