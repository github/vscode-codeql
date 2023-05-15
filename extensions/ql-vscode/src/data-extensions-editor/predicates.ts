import { ExternalApiUsage } from "./external-api-usage";
import {
  ModeledMethod,
  ModeledMethodType,
  ModeledMethodWithSignature,
  Provenance,
} from "./modeled-method";

export type ExternalApiUsageByType = {
  externalApiUsage: ExternalApiUsage;
  modeledMethod: ModeledMethod;
};

export type ExtensiblePredicateDefinition = {
  extensiblePredicate: string;
  generateMethodDefinition: (method: ExternalApiUsageByType) => Tuple[];
  readModeledMethod: (row: Tuple[]) => ModeledMethodWithSignature;

  supportedKinds?: string[];
};

type Tuple = boolean | number | string;

function readRowToMethod(row: Tuple[]): string {
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
      method.modeledMethod.provenance,
    ],
    readModeledMethod: (row) => ({
      signature: readRowToMethod(row),
      modeledMethod: {
        type: "source",
        input: "",
        output: row[6] as string,
        kind: row[7] as string,
        provenance: row[8] as Provenance,
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
      method.modeledMethod.provenance,
    ],
    readModeledMethod: (row) => ({
      signature: readRowToMethod(row),
      modeledMethod: {
        type: "sink",
        input: row[6] as string,
        output: "",
        kind: row[7] as string,
        provenance: row[8] as Provenance,
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
      method.modeledMethod.provenance,
    ],
    readModeledMethod: (row) => ({
      signature: readRowToMethod(row),
      modeledMethod: {
        type: "summary",
        input: row[6] as string,
        output: row[7] as string,
        kind: row[8] as string,
        provenance: row[9] as Provenance,
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
      method.modeledMethod.provenance,
    ],
    readModeledMethod: (row) => ({
      signature: `${row[0]}.${row[1]}#${row[2]}${row[3]}`,
      modeledMethod: {
        type: "neutral",
        input: "",
        output: "",
        kind: "",
        provenance: row[4] as Provenance,
      },
    }),
  },
};
