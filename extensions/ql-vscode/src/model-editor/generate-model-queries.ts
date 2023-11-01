import { BaseLogger, NotificationLogger } from "../common/logging";
import { getModelsAsDataLanguage, ModelsAsDataLanguage } from "./languages";
import { ModeledMethod } from "./modeled-method";
import { QueryLanguage } from "../common/query-language";
import { DataTuple } from "./model-extension-file";
import { GenerateQueriesOptions, runGenerateQueries } from "./generate";
import { DecodedBqrs } from "../common/bqrs-cli-types";

const GENERATE_MODEL_SUPPORTED_LANGUAGES = [QueryLanguage.Ruby];

export function isGenerateModelSupported(language: QueryLanguage): boolean {
  return GENERATE_MODEL_SUPPORTED_LANGUAGES.includes(language);
}

type GenerateModelOptions = GenerateQueriesOptions & {
  logger: NotificationLogger;
  language: QueryLanguage;
};

function parseGenerateModelResults(
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

export async function runGenerateModelQuery({
  logger,
  language,
  ...options
}: GenerateModelOptions) {
  const modelsAsDataLanguage = getModelsAsDataLanguage(language);

  return runGenerateQueries(
    {
      queryConstraints: {
        "query path": "queries/modeling/GenerateModel.ql",
      },
      parseResults: (_queryPath, results) =>
        parseGenerateModelResults(results, modelsAsDataLanguage, logger),
    },
    options,
  );
}
