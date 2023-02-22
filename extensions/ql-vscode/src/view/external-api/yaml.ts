import {
  ExternalApiUsage,
  ModeledMethod,
  ModeledMethodType,
} from "./interface";

type ExternalApiUsageByType = {
  method: ExternalApiUsage;
  modeledMethod: ModeledMethod;
};

type DataExtensionDefinition = {
  extensible: string;
  generateMethodDefinition: (method: ExternalApiUsageByType) => any[];
};

const definitions: Record<
  Exclude<ModeledMethodType, "none">,
  DataExtensionDefinition
> = {
  source: {
    extensible: "sourceModel",
    // extensible predicate sourceModel(
    //   string package, string type, boolean subtypes, string name, string signature, string ext,
    //   string output, string kind, string provenance
    // );
    generateMethodDefinition: (method) => [
      method.method.packageName,
      method.method.typeName,
      true,
      method.method.methodName,
      method.method.methodParameters,
      "",
      method.modeledMethod.output,
      method.modeledMethod.kind,
      "manual",
    ],
  },
  sink: {
    extensible: "sinkModel",
    // extensible predicate sinkModel(
    //   string package, string type, boolean subtypes, string name, string signature, string ext,
    //   string input, string kind, string provenance
    // );
    generateMethodDefinition: (method) => [
      method.method.packageName,
      method.method.typeName,
      true,
      method.method.methodName,
      method.method.methodParameters,
      "",
      method.modeledMethod.input,
      method.modeledMethod.kind,
      "manual",
    ],
  },
  summary: {
    extensible: "summaryModel",
    // extensible predicate summaryModel(
    //   string package, string type, boolean subtypes, string name, string signature, string ext,
    //   string input, string output, string kind, string provenance
    // );
    generateMethodDefinition: (method) => [
      method.method.packageName,
      method.method.typeName,
      true,
      method.method.methodName,
      method.method.methodParameters,
      "",
      method.modeledMethod.input,
      method.modeledMethod.output,
      method.modeledMethod.kind,
      "manual",
    ],
  },
  neutral: {
    extensible: "neutralModel",
    // extensible predicate neutralModel(
    //   string package, string type, string name, string signature, string provenance
    // );
    generateMethodDefinition: (method) => [
      method.method.packageName,
      method.method.typeName,
      method.method.methodName,
      method.method.methodParameters,
      "manual",
    ],
  },
};

export function createDataProperty(
  methods: ExternalApiUsageByType[],
  definition: DataExtensionDefinition,
) {
  if (methods.length === 0) {
    return "[]";
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
  methods: ExternalApiUsage[],
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

  for (const method of methods) {
    const modeledMethod = modeledMethods[method.externalApiInfo];

    if (modeledMethod?.type && modeledMethod.type !== "none") {
      methodsByType[modeledMethod.type].push({
        method,
        modeledMethod,
      });
    }
  }

  const extensions = Object.entries(definitions).map(
    ([type, definition]) => `  - addsTo:
      pack: codeql/java-all
      extensible: ${definition.extensible}
    data: ${createDataProperty(
      methodsByType[type as Exclude<ModeledMethodType, "none">],
      definition,
    )}
`,
  );

  return `extensions:
${extensions.join("\n")}`;
}
