import { CancellationTokenSource } from "vscode";
import { join } from "path";
import { runQuery } from "./external-api-usage-query";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { QueryRunner } from "../query-server";
import { DatabaseItem } from "../databases/local-databases";
import { interpretResultsSarif } from "../query-results";
import { ProgressCallback } from "../common/vscode/progress";

type Options = {
  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  databaseItem: DatabaseItem;
  queryStorageDir: string;

  progress: ProgressCallback;
};

export type UsageSnippetsBySignature = Record<string, string[]>;

export async function getAutoModelUsages({
  cliServer,
  queryRunner,
  databaseItem,
  queryStorageDir,
  progress,
}: Options): Promise<UsageSnippetsBySignature> {
  const maxStep = 1500;

  const cancellationTokenSource = new CancellationTokenSource();

  // This will re-run the query that was already run when opening the data extensions editor. This
  // might be unnecessary, but this makes it really easy to get the path to the BQRS file which we
  // need to interpret the results.
  const queryResult = await runQuery("applicationModeQuery", {
    cliServer,
    queryRunner,
    queryStorageDir,
    databaseItem,
    progress: (update) =>
      progress({
        maxStep,
        step: update.step,
        message: update.message,
      }),
    token: cancellationTokenSource.token,
  });
  if (!queryResult) {
    throw new Error("Query failed");
  }

  progress({
    maxStep,
    step: 1100,
    message: "Retrieving source location prefix",
  });

  // CodeQL needs to have access to the database to be able to retrieve the
  // snippets from it. The source location prefix is used to determine the
  // base path of the database.
  const sourceLocationPrefix = await databaseItem.getSourceLocationPrefix(
    cliServer,
  );
  const sourceArchiveUri = databaseItem.sourceArchive;
  const sourceInfo =
    sourceArchiveUri === undefined
      ? undefined
      : {
          sourceArchive: sourceArchiveUri.fsPath,
          sourceLocationPrefix,
        };

  progress({
    maxStep,
    step: 1200,
    message: "Interpreting results",
  });

  // Convert the results to SARIF so that Codeql will retrieve the snippets
  // from the datababe. This means we don't need to do that in the extension
  // and everything is handled by the CodeQL CLI.
  const sarif = await interpretResultsSarif(
    cliServer,
    {
      // To interpret the results we need to provide metadata about the query. We could do this using
      // `resolveMetadata` but that would be an extra call to the CodeQL CLI server and would require
      // us to know the path to the query on the filesystem. Since we know what the metadata should
      // look like and the only metadata that the CodeQL CLI requires is an ID and the kind, we can
      // simply use constants here.
      kind: "problem",
      id: "usage",
    },
    {
      resultsPath: queryResult.outputDir.bqrsPath,
      interpretedResultsPath: join(
        queryStorageDir,
        "interpreted-results.sarif",
      ),
    },
    sourceInfo,
    ["--sarif-add-snippets"],
  );

  progress({
    maxStep,
    step: 1400,
    message: "Parsing results",
  });

  const snippets: UsageSnippetsBySignature = {};

  const results = sarif.runs[0]?.results;
  if (!results) {
    throw new Error("No results");
  }

  // This will group the snippets by the method signature.
  for (const result of results) {
    const signature = result.message.text;

    const snippet =
      result.locations?.[0]?.physicalLocation?.contextRegion?.snippet?.text;

    if (!signature || !snippet) {
      continue;
    }

    if (!(signature in snippets)) {
      snippets[signature] = [];
    }

    snippets[signature].push(snippet);
  }

  return snippets;
}
