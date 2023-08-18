import { CancellationToken } from "vscode";
import { DatabaseItem } from "../databases/local-databases";
import { basename } from "path";
import { QueryRunner } from "../query-server";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { showAndLogExceptionWithTelemetry, TeeLogger } from "../common/logging";
import { extLogger } from "../common/logging/vscode";
import { extensiblePredicateDefinitions } from "./predicates";
import { ProgressCallback } from "../common/vscode/progress";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { ModeledMethod, ModeledMethodType } from "./modeled-method";
import { redactableError } from "../common/errors";
import { QueryResultType } from "../query-server/new-messages";
import { qlpackOfDatabase, resolveQueries } from "../local-queries";
import { telemetryListener } from "../common/vscode/telemetry";

type FlowModelOptions = {
  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  queryStorageDir: string;
  databaseItem: DatabaseItem;
  progress: ProgressCallback;
  token: CancellationToken;
  onResults: (results: ModeledMethod[]) => void | Promise<void>;
};

async function resolveFlowQueries(
  cliServer: CodeQLCliServer,
  databaseItem: DatabaseItem,
): Promise<string[]> {
  const qlpacks = await qlpackOfDatabase(cliServer, databaseItem);

  return await resolveQueries(cliServer, qlpacks, "flow model generator", {
    "tags contain": ["modelgenerator"], // TODO: should this be a single string and not an array?
  });
}

async function getModeledMethodsFromFlow(
  type: Exclude<ModeledMethodType, "none">,
  queryPath: string | undefined,
  queryStep: number,
  {
    cliServer,
    queryRunner,
    queryStorageDir,
    databaseItem,
    progress,
    token,
  }: Omit<FlowModelOptions, "onResults">,
): Promise<ModeledMethod[]> {
  if (queryPath === undefined) {
    void showAndLogExceptionWithTelemetry(
      extLogger,
      telemetryListener,
      redactableError`Failed to find ${type} query`,
    );
    return [];
  }

  const definition = extensiblePredicateDefinitions[type];

  const queryRun = queryRunner.createQueryRun(
    databaseItem.databaseUri.fsPath,
    {
      queryPath,
      quickEvalPosition: undefined,
      quickEvalCountOnly: false,
    },
    false,
    getOnDiskWorkspaceFolders(),
    undefined,
    queryStorageDir,
    undefined,
    undefined,
  );

  const queryResult = await queryRun.evaluate(
    ({ step, message }) =>
      progress({
        message: `Generating ${type} model: ${message}`,
        step: queryStep * 1000 + step,
        maxStep: 4000,
      }),
    token,
    new TeeLogger(queryRunner.logger, queryRun.outputDir.logPath),
  );
  if (queryResult.resultType !== QueryResultType.SUCCESS) {
    void showAndLogExceptionWithTelemetry(
      extLogger,
      telemetryListener,
      redactableError`Failed to run ${basename(queryPath)} query: ${
        queryResult.message ?? "No message"
      }`,
    );
    return [];
  }

  const bqrsPath = queryResult.outputDir.bqrsPath;

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

export async function generateFlowModel({
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

  const summaryResults = await getModeledMethodsFromFlow(
    "summary",
    queriesByBasename["CaptureSummaryModels.ql"],
    0,
    options,
  );
  if (summaryResults) {
    await onResults(summaryResults);
  }

  const sinkResults = await getModeledMethodsFromFlow(
    "sink",
    queriesByBasename["CaptureSinkModels.ql"],
    1,
    options,
  );
  if (sinkResults) {
    await onResults(sinkResults);
  }

  const sourceResults = await getModeledMethodsFromFlow(
    "source",
    queriesByBasename["CaptureSourceModels.ql"],
    2,
    options,
  );
  if (sourceResults) {
    await onResults(sourceResults);
  }

  const neutralResults = await getModeledMethodsFromFlow(
    "neutral",
    queriesByBasename["CaptureNeutralModels.ql"],
    3,
    options,
  );
  if (neutralResults) {
    await onResults(neutralResults);
  }
}
