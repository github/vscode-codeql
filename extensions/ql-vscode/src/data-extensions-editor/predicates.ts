import { ModeledMethod, ModeledMethodType, Provenance } from "./modeled-method";

export type ExtensiblePredicateDefinition = {
  extensiblePredicate: string;
  generateMethodDefinition: (method: ModeledMethod) => Tuple[];
  readModeledMethod: (row: Tuple[]) => ModeledMethod;

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
      method.packageName,
      method.typeName,
      true,
      method.methodName,
      method.methodParameters,
      "",
      method.output,
      method.kind,
      method.provenance,
    ],
    readModeledMethod: (row) => ({
      type: "source",
      input: "",
      output: row[6] as string,
      kind: row[7] as string,
      provenance: row[8] as Provenance,
      signature: readRowToMethod(row),
      packageName: row[0] as string,
      typeName: row[1] as string,
      methodName: row[3] as string,
      methodParameters: row[4] as string,
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
      method.packageName,
      method.typeName,
      true,
      method.methodName,
      method.methodParameters,
      "",
      method.input,
      method.kind,
      method.provenance,
    ],
    readModeledMethod: (row) => ({
      type: "sink",
      input: row[6] as string,
      output: "",
      kind: row[7] as string,
      provenance: row[8] as Provenance,
      signature: readRowToMethod(row),
      packageName: row[0] as string,
      typeName: row[1] as string,
      methodName: row[3] as string,
      methodParameters: row[4] as string,
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
      method.packageName,
      method.typeName,
      true,
      method.methodName,
      method.methodParameters,
      "",
      method.input,
      method.output,
      method.kind,
      method.provenance,
    ],
    readModeledMethod: (row) => ({
      type: "summary",
      input: row[6] as string,
      output: row[7] as string,
      kind: row[8] as string,
      provenance: row[9] as Provenance,
      signature: readRowToMethod(row),
      packageName: row[0] as string,
      typeName: row[1] as string,
      methodName: row[3] as string,
      methodParameters: row[4] as string,
    }),
    supportedKinds: ["taint", "value"],
  },
  neutral: {
    extensiblePredicate: "neutralModel",
    // extensible predicate neutralModel(
    //   string package, string type, string name, string signature, string kind, string provenance
    // );
    generateMethodDefinition: (method) => [
      method.packageName,
      method.typeName,
      method.methodName,
      method.methodParameters,
      method.kind,
      method.provenance,
    ],
    readModeledMethod: (row) => ({
      type: "neutral",
      input: "",
      output: "",
      kind: row[4] as string,
      provenance: row[5] as Provenance,
      signature: `${row[0]}.${row[1]}#${row[2]}${row[3]}`,
      packageName: row[0] as string,
      typeName: row[1] as string,
      methodName: row[2] as string,
      methodParameters: row[3] as string,
    }),
    supportedKinds: ["summary", "source", "sink"],
  },
};
