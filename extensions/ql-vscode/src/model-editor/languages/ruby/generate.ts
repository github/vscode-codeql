import type { BaseLogger } from "../../../common/logging";
import type { DecodedBqrs } from "../../../common/bqrs-cli-types";
import type { ModelsAsDataLanguage } from "../models-as-data";
import type { ModeledMethod } from "../../modeled-method";
import type { DataTuple } from "../../model-extension-file";

export function parseGenerateModelResults(
  _queryPath: string,
  bqrs: DecodedBqrs,
  modelsAsDataLanguage: ModelsAsDataLanguage,
  logger: BaseLogger,
): ModeledMethod[] {
  const modeledMethods: ModeledMethod[] = [];

  for (const resultSetName in bqrs) {
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
