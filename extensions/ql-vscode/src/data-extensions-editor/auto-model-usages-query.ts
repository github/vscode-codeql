import { CancellationTokenSource } from "vscode";
import { join } from "path";
import { runQuery } from "./external-api-usage-query";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { QueryRunner } from "../query-server";
import { DatabaseItem } from "../databases/local-databases";
import { interpretResultsSarif } from "../query-results";
import { ProgressCallback } from "../common/vscode/progress";

type Options = {
  cliServer: Pick<
    CodeQLCliServer,
    "resolveDatabase" | "resolveQlpacks" | "interpretBqrsSarif"
  >;
  queryRunner: Pick<QueryRunner, "createQueryRun" | "logger">;
  databaseItem: Pick<
    DatabaseItem,
    | "contents"
    | "databaseUri"
    | "language"
    | "sourceArchive"
    | "getSourceLocationPrefix"
  >;
  queryStorageDir: string;

  progress: ProgressCallback;
};

export async function getAutoModelUsages({
  cliServer,
  queryRunner,
  databaseItem,
  queryStorageDir,
  progress,
}: Options): Promise<Record<string, string[]>> {
  const maxStep = 1500;

  const cancellationTokenSource = new CancellationTokenSource();

  const queryResult = await runQuery({
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

  const sarif = await interpretResultsSarif(
    cliServer,
    {
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

  const snippets: Record<string, string[]> = {};

  const results = sarif.runs[0]?.results;
  if (!results) {
    throw new Error("No results");
  }

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
