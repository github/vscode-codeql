import { CancellationToken } from "vscode";
import { DatabaseItem } from "../databases/local-databases";
import { basename } from "path";
import { QueryRunner } from "../query-server";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import { extLogger } from "../common/logging/vscode";
import { getModelsAsDataLanguage } from "./languages";
import { ProgressCallback } from "../common/vscode/progress";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { ModeledMethod, ModeledMethodType } from "./modeled-method";
import { redactableError } from "../common/errors";
import { telemetryListener } from "../common/vscode/telemetry";
import { runQuery } from "../local-queries/run-query";
import { resolveQueries } from "../local-queries";
import { QueryLanguage } from "../common/query-language";

const FLOW_MODEL_SUPPORTED_LANGUAGES = [
  QueryLanguage.CSharp,
  QueryLanguage.Java,
];

export function isFlowModelGenerationSupported(
  language: QueryLanguage,
): boolean {
  return FLOW_MODEL_SUPPORTED_LANGUAGES.includes(language);
}

type FlowModelOptions = {
  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  queryStorageDir: string;
  databaseItem: DatabaseItem;
  language: QueryLanguage;
  progress: ProgressCallback;
  token: CancellationToken;
  onResults: (results: ModeledMethod[]) => void | Promise<void>;
};

export async function runFlowModelQueries({
  onResults,
  ...options
}: FlowModelOptions) {
  const queries = await resolveFlowQueries(
    options.cliServer,
    options.databaseItem,
  );

  const queriesByBasename: Record<string, string> = {};
  for (const query of queries) {
    queriesByBasename[basename(query)] = query;
  }

  const summaryResults = await runSingleFlowQuery(
    "summary",
    queriesByBasename["CaptureSummaryModels.ql"],
    0,
    options,
  );
  if (summaryResults) {
    await onResults(summaryResults);
  }

  const sinkResults = await runSingleFlowQuery(
    "sink",
    queriesByBasename["CaptureSinkModels.ql"],
    1,
    options,
  );
  if (sinkResults) {
    await onResults(sinkResults);
  }

  const sourceResults = await runSingleFlowQuery(
    "source",
    queriesByBasename["CaptureSourceModels.ql"],
    2,
    options,
  );
  if (sourceResults) {
    await onResults(sourceResults);
  }

  const neutralResults = await runSingleFlowQuery(
    "neutral",
    queriesByBasename["CaptureNeutralModels.ql"],
    3,
    options,
  );
  if (neutralResults) {
    await onResults(neutralResults);
  }
}

async function resolveFlowQueries(
  cliServer: CodeQLCliServer,
  databaseItem: DatabaseItem,
): Promise<string[]> {
  const packsToSearch = [`codeql/${databaseItem.language}-queries`];

  return await resolveQueries(
    cliServer,
    packsToSearch,
    "flow model generator",
    {
      "tags contain": ["modelgenerator"],
    },
  );
}

async function runSingleFlowQuery(
  type: Exclude<ModeledMethodType, "none">,
  queryPath: string | undefined,
  queryStep: number,
  {
    cliServer,
    queryRunner,
    queryStorageDir,
    databaseItem,
    language,
    progress,
    token,
  }: Omit<FlowModelOptions, "onResults">,
): Promise<ModeledMethod[]> {
  // Check that the right query was found
  if (queryPath === undefined) {
    void showAndLogExceptionWithTelemetry(
      extLogger,
      telemetryListener,
      redactableError`Failed to find ${type} query`,
    );
    return [];
  }

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
        message: `Generating ${type} model: ${message}`,
        step: queryStep * 1000 + step,
        maxStep: 4000,
      }),
    token,
  });

  if (!completedQuery) {
    return [];
  }

  // Interpret the results
  const modelsAsDataLanguage = getModelsAsDataLanguage(language);

  const definition = modelsAsDataLanguage[type];

  const bqrsPath = completedQuery.outputDir.bqrsPath;

  const bqrsInfo = await cliServer.bqrsInfo(bqrsPath);
  if (bqrsInfo["result-sets"].length !== 1) {
    void showAndLogExceptionWithTelemetry(
      extLogger,
      telemetryListener,
      redactableError`Expected exactly one result set, got ${
        bqrsInfo["result-sets"].length
      } for ${basename(queryPath)}`,
    );
  }

  const resultSet = bqrsInfo["result-sets"][0];

  const decodedResults = await cliServer.bqrsDecode(bqrsPath, resultSet.name);

  const results = decodedResults.tuples;

  return (
    results
      // This is just a sanity check. The query should only return strings.
      .filter((result) => typeof result[0] === "string")
      .map((result) => {
        const row = result[0] as string;

        return definition.readModeledMethod(row.split(";"));
      })
  );
}
