import { CancellationToken } from "vscode";
import { DatabaseItem } from "../databases/local-databases";
import { join } from "path";
import { QueryRunner } from "../query-server";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { TeeLogger } from "../common";
import { extensiblePredicateDefinitions } from "./predicates";
import { ProgressCallback } from "../progress";
import {
  getOnDiskWorkspaceFolders,
  showAndLogExceptionWithTelemetry,
} from "../helpers";
import {
  ModeledMethodType,
  ModeledMethodWithSignature,
} from "./modeled-method";
import { redactableError } from "../pure/errors";
import { QueryResultType } from "../pure/new-messages";

type FlowModelOptions = {
  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  queryStorageDir: string;
  qlDir: string;
  databaseItem: DatabaseItem;
  progress: ProgressCallback;
  token: CancellationToken;
  onResults: (results: ModeledMethodWithSignature[]) => void | Promise<void>;
};

async function getModeledMethodsFromFlow(
  type: Exclude<ModeledMethodType, "none">,
  queryName: string,
  queryStep: number,
  {
    cliServer,
    queryRunner,
    queryStorageDir,
    qlDir,
    databaseItem,
    progress,
    token,
  }: Omit<FlowModelOptions, "onResults">,
): Promise<ModeledMethodWithSignature[]> {
  const definition = extensiblePredicateDefinitions[type];

  const query = join(
    qlDir,
    databaseItem.language,
    "ql/src/utils/modelgenerator",
    queryName,
  );

  const queryRun = queryRunner.createQueryRun(
    databaseItem.databaseUri.fsPath,
    { queryPath: query, quickEvalPosition: undefined },
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
      redactableError`Failed to run ${queryName} query: ${
        queryResult.message ?? "No message"
      }`,
    );
    return [];
  }

  const bqrsPath = queryResult.outputDir.bqrsPath;

  const bqrsInfo = await cliServer.bqrsInfo(bqrsPath);
  if (bqrsInfo["result-sets"].length !== 1) {
    void showAndLogExceptionWithTelemetry(
      redactableError`Expected exactly one result set, got ${bqrsInfo["result-sets"].length} for ${queryName}`,
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
  const summaryResults = await getModeledMethodsFromFlow(
    "summary",
    "CaptureSummaryModels.ql",
    0,
    options,
  );
  if (summaryResults) {
    await onResults(summaryResults);
  }

  const sinkResults = await getModeledMethodsFromFlow(
    "sink",
    "CaptureSinkModels.ql",
    1,
    options,
  );
  if (sinkResults) {
    await onResults(sinkResults);
  }

  const sourceResults = await getModeledMethodsFromFlow(
    "source",
    "CaptureSourceModels.ql",
    2,
    options,
  );
  if (sourceResults) {
    await onResults(sourceResults);
  }

  const neutralResults = await getModeledMethodsFromFlow(
    "neutral",
    "CaptureNeutralModels.ql",
    3,
    options,
  );
  if (neutralResults) {
    await onResults(neutralResults);
  }
}
