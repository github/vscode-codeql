import { CancellationToken } from "vscode";
import { DatabaseItem } from "../databases/local-databases";
import { QueryRunner } from "../query-server";
import { CodeQLCliServer } from "../codeql-cli/cli";
import {
  NotificationLogger,
  showAndLogExceptionWithTelemetry,
} from "../common/logging";
import { getModelsAsDataLanguage } from "./languages";
import { ProgressCallback } from "../common/vscode/progress";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { ModeledMethod } from "./modeled-method";
import { redactableError } from "../common/errors";
import { telemetryListener } from "../common/vscode/telemetry";
import { runQuery } from "../local-queries/run-query";
import { resolveQueries } from "../local-queries";
import { QueryLanguage } from "../common/query-language";
import { DataTuple } from "./model-extension-file";

const GENERATE_MODEL_SUPPORTED_LANGUAGES = [QueryLanguage.Ruby];

export function isGenerateModelSupported(language: QueryLanguage): boolean {
  return GENERATE_MODEL_SUPPORTED_LANGUAGES.includes(language);
}

type GenerateModelOptions = {
  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  logger: NotificationLogger;
  queryStorageDir: string;
  databaseItem: DatabaseItem;
  language: QueryLanguage;
  progress: ProgressCallback;
  token: CancellationToken;
};

// resolve (100) + query (1000) + interpret (100)
const maxStep = 1200;

export async function runGenerateModelQuery({
  cliServer,
  queryRunner,
  logger,
  queryStorageDir,
  databaseItem,
  language,
  progress,
  token,
}: GenerateModelOptions): Promise<ModeledMethod[]> {
  progress({
    message: "Resolving generate model query",
    step: 100,
    maxStep,
  });

  const queryPath = await resolveGenerateModelQuery(
    cliServer,
    logger,
    databaseItem,
  );
  if (queryPath === undefined) {
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
        message: `Generating models: ${message}`,
        step: 100 + step,
        maxStep,
      }),
    token,
  });

  if (!completedQuery) {
    return [];
  }

  progress({
    message: "Decoding results",
    step: 1100,
    maxStep,
  });

  const decodedBqrs = await cliServer.bqrsDecodeAll(
    completedQuery.outputDir.bqrsPath,
  );

  const modelsAsDataLanguage = getModelsAsDataLanguage(language);

  const modeledMethods: ModeledMethod[] = [];

  for (const resultSetName in decodedBqrs) {
    const definition = Object.values(modelsAsDataLanguage.predicates).find(
      (definition) => definition.extensiblePredicate === resultSetName,
    );
    if (definition === undefined) {
      void logger.log(`No predicate found for ${resultSetName}`);

      continue;
    }

    const resultSet = decodedBqrs[resultSetName];

    if (
      resultSet.tuples.some((tuple) =>
        tuple.some((value) => typeof value === "object"),
      )
    ) {
      void logger.log(
        `Skipping ${resultSetName} because it contains undefined values`,
      );
      continue;
    }

    modeledMethods.push(
      ...resultSet.tuples.map((tuple) => {
        const row = tuple.filter(
          (value): value is DataTuple => typeof value !== "object",
        );

        return definition.readModeledMethod(row);
      }),
    );
  }

  return modeledMethods;
}

async function resolveGenerateModelQuery(
  cliServer: CodeQLCliServer,
  logger: NotificationLogger,
  databaseItem: DatabaseItem,
): Promise<string | undefined> {
  const packsToSearch = [`codeql/${databaseItem.language}-queries`];

  const queries = await resolveQueries(
    cliServer,
    packsToSearch,
    "generate model",
    {
      "query path": "queries/modeling/GenerateModel.ql",
    },
  );
  if (queries.length !== 1) {
    void showAndLogExceptionWithTelemetry(
      logger,
      telemetryListener,
      redactableError`Expected exactly one generate model query, got ${queries.length}`,
    );
    return undefined;
  }

  return queries[0];
}
