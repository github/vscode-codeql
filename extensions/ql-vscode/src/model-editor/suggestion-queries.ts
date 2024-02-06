import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { Mode } from "./shared/mode";
import type { QueryConstraints } from "../local-queries";
import { resolveQueriesFromPacks } from "../local-queries";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import type { NotificationLogger } from "../common/logging";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import { telemetryListener } from "../common/vscode/telemetry";
import { redactableError } from "../common/errors";
import { runQuery } from "../local-queries/run-query";
import type { QueryRunner } from "../query-server";
import type { DatabaseItem } from "../databases/local-databases";
import type { ProgressCallback } from "../common/vscode/progress";
import type { CancellationToken } from "vscode";
import type { DecodedBqrsChunk } from "../common/bqrs-cli-types";
import type {
  AccessPathSuggestionRow,
  AccessPathSuggestionRows,
} from "./suggestions";

type RunQueryOptions = {
  parseResults: (
    results: DecodedBqrsChunk,
  ) => AccessPathSuggestionRow[] | Promise<AccessPathSuggestionRow[]>;
  queryConstraints: QueryConstraints;

  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  logger: NotificationLogger;
  databaseItem: DatabaseItem;
  queryStorageDir: string;

  progress: ProgressCallback;
  token: CancellationToken;
};

const maxStep = 2000;

export async function runSuggestionsQuery(
  mode: Mode,
  {
    parseResults,
    queryConstraints,
    cliServer,
    queryRunner,
    logger,
    databaseItem,
    queryStorageDir,
    progress,
    token,
  }: RunQueryOptions,
): Promise<AccessPathSuggestionRows | undefined> {
  progress({
    message: "Resolving QL packs",
    step: 1,
    maxStep,
  });
  const additionalPacks = getOnDiskWorkspaceFolders();
  const extensionPacks = Object.keys(
    await cliServer.resolveQlpacks(additionalPacks, true),
  );

  progress({
    message: "Resolving query",
    step: 2,
    maxStep,
  });

  const queryPath = await resolveSuggestionsQuery(
    cliServer,
    databaseItem.language,
    mode,
    queryConstraints,
  );
  if (!queryPath) {
    void showAndLogExceptionWithTelemetry(
      logger,
      telemetryListener,
      redactableError`The ${mode} access path suggestions query could not be found. Try re-opening the model editor. If that doesn't work, try upgrading the CodeQL libraries.`,
    );
    return undefined;
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
        maxStep,
        message: update.message,
      }),
    token,
  });

  if (!completedQuery) {
    return undefined;
  }

  // Read the results and convert to internal representation
  progress({
    message: "Decoding results",
    step: 1600,
    maxStep,
  });

  const bqrs = await cliServer.bqrsDecodeAll(completedQuery.outputDir.bqrsPath);

  progress({
    message: "Finalizing results",
    step: 1950,
    maxStep,
  });

  const inputChunk = bqrs["input"];
  const outputChunk = bqrs["output"];

  if (!inputChunk && !outputChunk) {
    void logger.log(
      `No results found for ${mode} access path suggestions query`,
    );
    return undefined;
  }

  const inputSuggestions = inputChunk ? await parseResults(inputChunk) : [];
  const outputSuggestions = outputChunk ? await parseResults(outputChunk) : [];

  return {
    input: inputSuggestions,
    output: outputSuggestions,
  };
}

/**
 * Resolve the query path to the model editor access path suggestions query. All queries are tagged like this:
 * modeleditor access-path-suggestions <mode>
 * Example: modeleditor access-path-suggestions framework-mode
 *
 * @param cliServer The CodeQL CLI server to use.
 * @param language The language of the query pack to use.
 * @param mode The mode to resolve the query for.
 * @param queryConstraints Constraints to apply to the query.
 * @param additionalPackNames Additional pack names to search.
 * @param additionalPackPaths Additional pack paths to search.
 */
async function resolveSuggestionsQuery(
  cliServer: CodeQLCliServer,
  language: string,
  mode: Mode,
  queryConstraints: QueryConstraints,
  additionalPackNames: string[] = [],
  additionalPackPaths: string[] = [],
): Promise<string | undefined> {
  const packsToSearch = [`codeql/${language}-queries`, ...additionalPackNames];

  const queries = await resolveQueriesFromPacks(
    cliServer,
    packsToSearch,
    queryConstraints,
    additionalPackPaths,
  );
  if (queries.length > 1) {
    throw new Error(
      `Found multiple suggestions queries for ${mode}. Can't continue`,
    );
  }

  if (queries.length === 0) {
    return undefined;
  }

  return queries[0];
}
