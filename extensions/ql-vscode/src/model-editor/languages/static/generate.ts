import type { BaseLogger } from "../../../common/logging";
import type {
  ModelsAsDataLanguage,
  ModelsAsDataLanguagePredicates,
} from "../models-as-data";
import type { DecodedBqrs } from "../../../common/bqrs-cli-types";
import type { ModeledMethod } from "../../modeled-method";
import { basename } from "../../../common/path";

const queriesToModel: Record<string, keyof ModelsAsDataLanguagePredicates> = {
  "CaptureSummaryModels.ql": "summary",
  "CaptureSinkModels.ql": "sink",
  "CaptureSourceModels.ql": "source",
  "CaptureNeutralModels.ql": "neutral",
};

export function filterFlowModelQueries(queryPath: string): boolean {
  return Object.keys(queriesToModel).includes(basename(queryPath));
}

export function parseFlowModelResults(
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
