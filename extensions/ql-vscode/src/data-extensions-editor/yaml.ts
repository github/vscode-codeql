import { ExternalApiUsage } from "./external-api-usage";
import {
  ModeledMethod,
  ModeledMethodType,
  ModeledMethodWithSignature,
} from "./modeled-method";
import { extensiblePredicateDefinitions } from "./predicates";

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
      pack: codeql/java-all
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
  if (typeof data !== "object") {
    return undefined;
  }

  const extensions = data.extensions;
  if (!Array.isArray(extensions)) {
    return undefined;
  }

  const modeledMethods: Record<string, ModeledMethod> = {};

  for (const extension of extensions) {
    const addsTo = extension.addsTo;
    if (typeof addsTo !== "object") {
      continue;
    }

    const extensible = addsTo.extensible;
    if (typeof extensible !== "string") {
      continue;
    }

    const data = extension.data;
    if (!Array.isArray(data)) {
      continue;
    }

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
