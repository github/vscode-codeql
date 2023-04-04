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
  readModeledMethod: (row: any[]) => [string, ModeledMethod] | undefined;
};

function readRowToMethod(row: any[]): string {
  return `${row[0]}.${row[1]}#${row[3]}${row[4]}`;
}

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
    readModeledMethod: (row) => [
      readRowToMethod(row),
      {
        type: "source",
        input: "",
        output: row[6],
        kind: row[7],
      },
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
    readModeledMethod: (row) => [
      readRowToMethod(row),
      {
        type: "sink",
        input: row[6],
        output: "",
        kind: row[7],
      },
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
    readModeledMethod: (row) => [
      readRowToMethod(row),
      {
        type: "summary",
        input: row[6],
        output: row[7],
        kind: row[8],
      },
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
    readModeledMethod: (row) => [
      `${row[0]}.${row[1]}#${row[2]}${row[3]}`,
      {
        type: "neutral",
        input: "",
        output: "",
        kind: "",
      },
    ],
  },
};

function createDataProperty(
  methods: ExternalApiUsageByType[],
  definition: DataExtensionDefinition,
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

    const definition = Object.values(definitions).find(
      (definition) => definition.extensible === extensible,
    );
    if (!definition) {
      continue;
    }

    for (const row of data) {
      const result = definition.readModeledMethod(row);
      if (!result) {
        continue;
      }

      const [apiInfo, modeledMethod] = result;

      modeledMethods[apiInfo] = modeledMethod;
    }
  }

  return modeledMethods;
}
