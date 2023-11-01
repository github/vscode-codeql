import { basename } from "path";
import { BaseLogger } from "../common/logging";
import {
  getModelsAsDataLanguage,
  ModelsAsDataLanguage,
  ModelsAsDataLanguageModelType,
} from "./languages";
import { ModeledMethod } from "./modeled-method";
import { QueryLanguage } from "../common/query-language";
import { GenerateQueriesOptions, runGenerateQueries } from "./generate";
import { DecodedBqrs } from "../common/bqrs-cli-types";

const FLOW_MODEL_SUPPORTED_LANGUAGES = [
  QueryLanguage.CSharp,
  QueryLanguage.Java,
];

export function isFlowModelGenerationSupported(
  language: QueryLanguage,
): boolean {
  return FLOW_MODEL_SUPPORTED_LANGUAGES.includes(language);
}

type FlowModelOptions = GenerateQueriesOptions & {
  logger: BaseLogger;
  language: QueryLanguage;
};

const queriesToModel: Record<string, ModelsAsDataLanguageModelType> = {
  "CaptureSummaryModels.ql": "summary",
  "CaptureSinkModels.ql": "sink",
  "CaptureSourceModels.ql": "source",
  "CaptureNeutralModels.ql": "neutral",
};

function parseFlowModelResults(
  queryPath: string,
  bqrs: DecodedBqrs,
  modelsAsDataLanguage: ModelsAsDataLanguage,
  logger: BaseLogger,
): ModeledMethod[] {
  if (Object.keys(bqrs).length !== 1) {
    throw new Error(
      `Expected exactly one result set from ${queryPath}, but got ${
        Object.keys(bqrs).length
      }`,
    );
  }

  const modelType = queriesToModel[basename(queryPath)];
  if (!modelType) {
    void logger.log(`Unknown model type for ${queryPath}`);
    return [];
  }

  const resultSet = bqrs[Object.keys(bqrs)[0]];

  const results = resultSet.tuples;

  const definition = modelsAsDataLanguage.predicates[modelType];
  if (!definition) {
    throw new Error(`No definition for ${modelType}`);
  }

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

export async function runFlowModelQueries({
  cliServer,
  queryRunner,
  logger,
  queryStorageDir,
  databaseItem,
  language,
  progress,
  token,
  onResults,
}: FlowModelOptions) {
  const modelsAsDataLanguage = getModelsAsDataLanguage(language);

  return runGenerateQueries(
    {
      queryConstraints: {
        "tags contain": ["modelgenerator"],
      },
      filterQueries: (queryPath) => basename(queryPath) in queriesToModel,
      parseResults: (queryPath, results) =>
        parseFlowModelResults(queryPath, results, modelsAsDataLanguage, logger),
    },
    {
      cliServer,
      queryRunner,
      queryStorageDir,
      databaseItem,
      progress,
      token,
      onResults,
    },
  );
}
