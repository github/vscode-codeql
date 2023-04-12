import { ExternalApiUsage } from "./external-api-usage";
import {
  ModeledMethod,
  ModeledMethodType,
  ModeledMethodWithSignature,
} from "./modeled-method";

export type ExternalApiUsageByType = {
  externalApiUsage: ExternalApiUsage;
  modeledMethod: ModeledMethod;
};

export type ExtensiblePredicateDefinition = {
  extensiblePredicate: string;
  generateMethodDefinition: (method: ExternalApiUsageByType) => any[];
  readModeledMethod: (row: any[]) => ModeledMethodWithSignature;

  supportedKinds?: string[];
};

function readRowToMethod(row: any[]): string {
  return `${row[0]}.${row[1]}#${row[3]}${row[4]}`;
}

export const extensiblePredicateDefinitions: Record<
  Exclude<ModeledMethodType, "none">,
  ExtensiblePredicateDefinition
> = {
  source: {
    extensiblePredicate: "sourceModel",
    // extensible predicate sourceModel(
    //   string package, string type, boolean subtypes, string name, string signature, string ext,
    //   string output, string kind, string provenance
    // );
    generateMethodDefinition: (method) => [
      method.externalApiUsage.packageName,
      method.externalApiUsage.typeName,
      true,
      method.externalApiUsage.methodName,
      method.externalApiUsage.methodParameters,
      "",
      method.modeledMethod.output,
      method.modeledMethod.kind,
      "manual",
    ],
    readModeledMethod: (row) => ({
      signature: readRowToMethod(row),
      modeledMethod: {
        type: "source",
        input: "",
        output: row[6],
        kind: row[7],
      },
    }),
    supportedKinds: ["remote"],
  },
  sink: {
    extensiblePredicate: "sinkModel",
    // extensible predicate sinkModel(
    //   string package, string type, boolean subtypes, string name, string signature, string ext,
    //   string input, string kind, string provenance
    // );
    generateMethodDefinition: (method) => [
      method.externalApiUsage.packageName,
      method.externalApiUsage.typeName,
      true,
      method.externalApiUsage.methodName,
      method.externalApiUsage.methodParameters,
      "",
      method.modeledMethod.input,
      method.modeledMethod.kind,
      "manual",
    ],
    readModeledMethod: (row) => ({
      signature: readRowToMethod(row),
      modeledMethod: {
        type: "sink",
        input: row[6],
        output: "",
        kind: row[7],
      },
    }),
    supportedKinds: ["sql", "xss", "logging"],
  },
  summary: {
    extensiblePredicate: "summaryModel",
    // extensible predicate summaryModel(
    //   string package, string type, boolean subtypes, string name, string signature, string ext,
    //   string input, string output, string kind, string provenance
    // );
    generateMethodDefinition: (method) => [
      method.externalApiUsage.packageName,
      method.externalApiUsage.typeName,
      true,
      method.externalApiUsage.methodName,
      method.externalApiUsage.methodParameters,
      "",
      method.modeledMethod.input,
      method.modeledMethod.output,
      method.modeledMethod.kind,
      "manual",
    ],
    readModeledMethod: (row) => ({
      signature: readRowToMethod(row),
      modeledMethod: {
        type: "summary",
        input: row[6],
        output: row[7],
        kind: row[8],
      },
    }),
    supportedKinds: ["taint", "value"],
  },
  neutral: {
    extensiblePredicate: "neutralModel",
    // extensible predicate neutralModel(
    //   string package, string type, string name, string signature, string provenance
    // );
    generateMethodDefinition: (method) => [
      method.externalApiUsage.packageName,
      method.externalApiUsage.typeName,
      method.externalApiUsage.methodName,
      method.externalApiUsage.methodParameters,
      "manual",
    ],
    readModeledMethod: (row) => ({
      signature: `${row[0]}.${row[1]}#${row[2]}${row[3]}`,
      modeledMethod: {
        type: "neutral",
        input: "",
        output: "",
        kind: "",
      },
    }),
  },
};
