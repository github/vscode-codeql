import { CodeQLCliServer, SourceInfo } from "../codeql-cli/cli";
import { QueryRunner } from "../query-server";
import { DatabaseItem } from "../databases/local-databases";
import { ProgressCallback } from "../common/vscode/progress";
import * as Sarif from "sarif";
import { qlpackOfDatabase, resolveQueries } from "../local-queries";
import { extLogger } from "../common/logging/vscode";
import { Mode } from "./shared/mode";
import { QlPacksForLanguage } from "../databases/qlpack";
import { createLockFileForStandardQuery } from "../local-queries/standard-queries";
import { CancellationToken, CancellationTokenSource } from "vscode";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { showAndLogExceptionWithTelemetry, TeeLogger } from "../common/logging";
import { QueryResultType } from "../query-server/new-messages";
import { telemetryListener } from "../common/vscode/telemetry";
import { redactableError } from "../common/errors";
import { interpretResultsSarif } from "../query-results";
import { join } from "path";
import { assertNever } from "../common/helpers-pure";
import { dir } from "tmp-promise";
import { writeFile, outputFile } from "fs-extra";
import { dump as dumpYaml } from "js-yaml";
import { MethodSignature } from "./external-api-usage";

type AutoModelQueryOptions = {
  queryTag: string;
  mode: Mode;
  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  databaseItem: DatabaseItem;
  qlpack: QlPacksForLanguage;
  sourceInfo: SourceInfo | undefined;
  additionalPacks: string[];
  extensionPacks: string[];
  queryStorageDir: string;

  progress: ProgressCallback;
  token: CancellationToken;
};

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

async function runAutoModelQuery({
  queryTag,
  mode,
  cliServer,
  queryRunner,
  databaseItem,
  qlpack,
  sourceInfo,
  additionalPacks,
  extensionPacks,
  queryStorageDir,
  progress,
  token,
}: AutoModelQueryOptions): Promise<Sarif.Log | undefined> {
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

  const queryPath = queries[0];
  const { cleanup: cleanupLockFile } = await createLockFileForStandardQuery(
    cliServer,
    queryPath,
  );

  // Get metadata for the query. This is required to interpret the results. We already know the kind is problem
  // (because of the constraint in resolveQueries), so we don't need any more checks on the metadata.
  const metadata = await cliServer.resolveMetadata(queryPath);

  const queryRun = queryRunner.createQueryRun(
    databaseItem.databaseUri.fsPath,
    {
      queryPath,
      quickEvalPosition: undefined,
      quickEvalCountOnly: false,
    },
    false,
    additionalPacks,
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

  await cleanupLockFile?.();

  if (completedQuery.resultType !== QueryResultType.SUCCESS) {
    void showAndLogExceptionWithTelemetry(
      extLogger,
      telemetryListener,
      redactableError`Auto-model query ${queryTag} failed: ${
        completedQuery.message ?? "No message"
      }`,
    );
    return;
  }

  const interpretedResultsPath = join(
    queryStorageDir,
    `interpreted-results-${queryTag.replaceAll(" ", "-")}-${queryRun.id}.sarif`,
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

type AutoModelQueriesOptions = {
  mode: Mode;
  candidateMethods: MethodSignature[];
  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  databaseItem: DatabaseItem;
  queryStorageDir: string;

  progress: ProgressCallback;
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
}: AutoModelQueriesOptions): Promise<AutoModelQueriesResult | undefined> {
  // maxStep for this part is 1500
  const maxStep = 1500;

  const cancellationTokenSource = new CancellationTokenSource();

  const qlpack = await qlpackOfDatabase(cliServer, databaseItem);

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

  // Generate a pack containing the candidate filters
  const filterPackDir = await generateCandidateFilterPack(
    databaseItem.language,
    candidateMethods,
  );

  const additionalPacks = [...getOnDiskWorkspaceFolders(), filterPackDir];
  const extensionPacks = Object.keys(
    await cliServer.resolveQlpacks(additionalPacks, true),
  );

  progress({
    step: 0,
    maxStep,
    message: "Finding candidates and examples",
  });

  const candidates = await runAutoModelQuery({
    mode,
    queryTag: "candidates",
    cliServer,
    queryRunner,
    databaseItem,
    qlpack,
    sourceInfo,
    additionalPacks,
    extensionPacks,
    queryStorageDir,
    progress: (update) => {
      progress({
        step: update.step,
        maxStep,
        message: "Finding candidates and examples",
      });
    },
    token: cancellationTokenSource.token,
  });

  if (!candidates) {
    return undefined;
  }

  return {
    candidates,
  };
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
export async function generateCandidateFilterPack(
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
