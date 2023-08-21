import { CodeQLCliServer, SourceInfo } from "../codeql-cli/cli";
import { CoreCompletedQuery, QueryRunner } from "../query-server";
import { DatabaseItem } from "../databases/local-databases";
import { ProgressCallback } from "../common/vscode/progress";
import * as Sarif from "sarif";
import { qlpackOfDatabase, resolveQueries } from "../local-queries";
import { Mode } from "./shared/mode";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { interpretResultsSarif } from "../query-results";
import { join } from "path";
import { assertNever } from "../common/helpers-pure";
import { dir } from "tmp-promise";
import { writeFile, outputFile } from "fs-extra";
import { dump as dumpYaml } from "js-yaml";
import { MethodSignature } from "./external-api-usage";
import { runQuery } from "../local-queries/run-query";
import { QueryMetadata } from "../common/interface-types";
import { CancellationTokenSource } from "vscode";

function modeTag(mode: Mode): string {
  switch (mode) {
    case Mode.Application:
      return "application-mode";
    case Mode.Framework:
      return "framework-mode";
    default:
      assertNever(mode);
  }
}

type AutoModelQueriesOptions = {
  mode: Mode;
  candidateMethods: MethodSignature[];
  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  databaseItem: DatabaseItem;
  queryStorageDir: string;

  progress: ProgressCallback;
  cancellationTokenSource: CancellationTokenSource;
};

export type AutoModelQueriesResult = {
  candidates: Sarif.Log;
};

export async function runAutoModelQueries({
  mode,
  candidateMethods,
  cliServer,
  queryRunner,
  databaseItem,
  queryStorageDir,
  progress,
  cancellationTokenSource,
}: AutoModelQueriesOptions): Promise<AutoModelQueriesResult | undefined> {
  // First, resolve the query that we want to run.
  const queryPath = await resolveAutomodelQueries(
    cliServer,
    databaseItem,
    "candidates",
    mode,
  );

  // Generate a pack containing the candidate filters
  const filterPackDir = await generateCandidateFilterPack(
    databaseItem.language,
    candidateMethods,
  );

  const additionalPacks = [...getOnDiskWorkspaceFolders(), filterPackDir];
  // TODO: can we remove extensionPacks from the runQuery method?
  const extensionPacks = Object.keys(
    await cliServer.resolveQlpacks(additionalPacks, true),
  );

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
    token: cancellationTokenSource.token,
  });

  if (!completedQuery) {
    return undefined;
  }

  // Get metadata for the query. This is required to interpret the results. We already know the kind is problem
  // (because of the constraint in resolveQueries), so we don't need any more checks on the metadata.
  const metadata = await cliServer.resolveMetadata(queryPath);

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

  const candidates = await interpretAutomodelResults(
    cliServer,
    completedQuery,
    metadata,
    sourceInfo,
  );

  return {
    candidates,
  };
}

async function resolveAutomodelQueries(
  cliServer: CodeQLCliServer,
  databaseItem: DatabaseItem,
  queryTag: string,
  mode: Mode,
): Promise<string> {
  const qlpack = await qlpackOfDatabase(cliServer, databaseItem);

  // First, resolve the query that we want to run.
  // All queries are tagged like this:
  // internal extract automodel <mode> <queryTag>
  // Example: internal extract automodel framework-mode candidates
  const queries = await resolveQueries(
    cliServer,
    qlpack,
    `Extract automodel ${queryTag}`,
    {
      kind: "problem",
      "tags contain all": ["automodel", modeTag(mode), ...queryTag.split(" ")],
    },
  );
  if (queries.length > 1) {
    throw new Error(
      `Found multiple auto model queries for ${mode} ${queryTag}. Can't continue`,
    );
  }
  if (queries.length === 0) {
    throw new Error(
      `Did not found any auto model queries for ${mode} ${queryTag}. Can't continue`,
    );
  }

  return queries[0];
}

/**
 * generateCandidateFilterPack will create a temporary extension pack.
 * This pack will contain a filter that will restrict the automodel queries
 * to the specified candidate methods only.
 * This is done using the `extensible` predicate "automodelCandidateFilter".
 * @param language
 * @param candidateMethods
 * @returns
 */
async function generateCandidateFilterPack(
  language: string,
  candidateMethods: MethodSignature[],
): Promise<string> {
  // Pack resides in a temporary directory, to not pollute the workspace.
  const packDir = (await dir({ unsafeCleanup: true })).path;

  const syntheticConfigPack = {
    name: "codeql/automodel-filter",
    version: "0.0.0",
    library: true,
    extensionTargets: {
      [`codeql/${language}-queries`]: "*",
    },
    dataExtensions: ["filter.yml"],
  };

  const qlpackFile = join(packDir, "codeql-pack.yml");
  await outputFile(qlpackFile, dumpYaml(syntheticConfigPack), "utf8");

  // The predicate has the following defintion:
  // extensible predicate automodelCandidateFilter(string package, string type, string name, string signature)
  const dataRows = candidateMethods.map((method) => [
    method.packageName,
    method.typeName,
    method.methodName,
    method.methodParameters,
  ]);

  const filter = {
    extensions: [
      {
        addsTo: {
          pack: `codeql/${language}-queries`,
          extensible: "automodelCandidateFilter",
        },
        data: dataRows,
      },
    ],
  };

  const filterFile = join(packDir, "filter.yml");
  await writeFile(filterFile, dumpYaml(filter), "utf8");

  return packDir;
}

async function interpretAutomodelResults(
  cliServer: CodeQLCliServer,
  completedQuery: CoreCompletedQuery,
  metadata: QueryMetadata,
  sourceInfo: SourceInfo | undefined,
): Promise<Sarif.Log> {
  const interpretedResultsPath = join(
    completedQuery.outputDir.querySaveDir,
    "results.sarif",
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- We only need the actual SARIF data, not the extra fields added by SarifInterpretationData
  const { t, sortState, ...sarif } = await interpretResultsSarif(
    cliServer,
    metadata,
    {
      resultsPath: completedQuery.outputDir.bqrsPath,
      interpretedResultsPath,
    },
    sourceInfo,
    ["--sarif-add-snippets"],
  );

  return sarif;
}
