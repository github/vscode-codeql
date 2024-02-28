import type { BaseLogger } from "../../../common/logging";
import type { DecodedBqrs } from "../../../common/bqrs-cli-types";
import type {
  GenerationContext,
  ModelsAsDataLanguage,
} from "../models-as-data";
import type { ModeledMethod } from "../../modeled-method";
import type { DataTuple } from "../../model-extension-file";

export function parseGenerateModelResults(
  _queryPath: string,
  bqrs: DecodedBqrs,
  modelsAsDataLanguage: ModelsAsDataLanguage,
  logger: BaseLogger,
  { config }: GenerationContext,
): ModeledMethod[] {
  const modeledMethods: ModeledMethod[] = [];

  for (const resultSetName in bqrs) {
    if (
      resultSetName ===
        modelsAsDataLanguage.predicates.type?.extensiblePredicate &&
      !config.showTypeModels
    ) {
      // Don't load generated type results when type models are hidden. These are already
      // automatically generated on start-up.
      continue;
    }

    const definition = Object.values(modelsAsDataLanguage.predicates).find(
      (definition) => definition.extensiblePredicate === resultSetName,
    );
    if (definition === undefined) {
      void logger.log(`No predicate found for ${resultSetName}`);

      continue;
    }

    const resultSet = bqrs[resultSetName];

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
