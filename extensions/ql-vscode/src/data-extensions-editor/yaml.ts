import Ajv from "ajv";

import { ExternalApiUsage } from "./external-api-usage";
import {
  ModeledMethod,
  ModeledMethodType,
  ModeledMethodWithSignature,
} from "./modeled-method";
import { extensiblePredicateDefinitions } from "./predicates";

import * as dataSchemaJson from "./data-schema.json";

const ajv = new Ajv({ allErrors: true });
const dataSchemaValidate = ajv.compile(dataSchemaJson);

type ExternalApiUsageByType = {
  externalApiUsage: ExternalApiUsage;
  modeledMethod: ModeledMethod;
};

type ExtensiblePredicateDefinition = {
  extensiblePredicate: string;
  generateMethodDefinition: (method: ExternalApiUsageByType) => any[];
  readModeledMethod: (row: any[]) => ModeledMethodWithSignature;
};

function createDataProperty(
  methods: ExternalApiUsageByType[],
  definition: ExtensiblePredicateDefinition,
) {
  if (methods.length === 0) {
    return " []";
  }

  return `\n${methods
    .map(
      (method) =>
        `      - ${JSON.stringify(
          definition.generateMethodDefinition(method),
        )}`,
    )
    .join("\n")}`;
}

export function createDataExtensionYaml(
  language: string,
  externalApiUsages: ExternalApiUsage[],
  modeledMethods: Record<string, ModeledMethod>,
) {
  const methodsByType: Record<
    Exclude<ModeledMethodType, "none">,
    ExternalApiUsageByType[]
  > = {
    source: [],
    sink: [],
    summary: [],
    neutral: [],
  };

  for (const externalApiUsage of externalApiUsages) {
    const modeledMethod = modeledMethods[externalApiUsage.signature];

    if (modeledMethod?.type && modeledMethod.type !== "none") {
      methodsByType[modeledMethod.type].push({
        externalApiUsage,
        modeledMethod,
      });
    }
  }

  const extensions = Object.entries(extensiblePredicateDefinitions).map(
    ([type, definition]) => `  - addsTo:
      pack: codeql/${language}-all
      extensible: ${definition.extensiblePredicate}
    data:${createDataProperty(
      methodsByType[type as Exclude<ModeledMethodType, "none">],
      definition,
    )}
`,
  );

  return `extensions:
${extensions.join("\n")}`;
}

export function loadDataExtensionYaml(
  data: any,
): Record<string, ModeledMethod> | undefined {
  dataSchemaValidate(data);

  if (dataSchemaValidate.errors) {
    throw new Error(
      `Invalid data extension YAML: ${dataSchemaValidate.errors
        .map((error) => `${error.instancePath} ${error.message}`)
        .join(", ")}`,
    );
  }

  const extensions = data.extensions;
  if (!Array.isArray(extensions)) {
    return undefined;
  }

  const modeledMethods: Record<string, ModeledMethod> = {};

  for (const extension of extensions) {
    const addsTo = extension.addsTo;
    const extensible = addsTo.extensible;
    const data = extension.data;

    const definition = Object.values(extensiblePredicateDefinitions).find(
      (definition) => definition.extensiblePredicate === extensible,
    );
    if (!definition) {
      continue;
    }

    for (const row of data) {
      const result = definition.readModeledMethod(row);
      if (!result) {
        continue;
      }

      const { signature, modeledMethod } = result;

      modeledMethods[signature] = modeledMethod;
    }
  }

  return modeledMethods;
}
