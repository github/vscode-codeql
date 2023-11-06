import { ModelsAsDataLanguage } from "../models-as-data";
import { sharedExtensiblePredicates, sharedKinds } from "../shared";
import { Mode } from "../../shared/mode";
import { parseGenerateModelResults } from "./generate";
import { getArgumentsList, MethodArgument } from "../../method";

function parseRubyMethodFromPath(path: string): string {
  const match = path.match(/Method\[([^\]]+)].*/);
  if (match) {
    return match[1];
  } else {
    return "";
  }
}

function parseRubyAccessPath(path: string): {
  methodName: string;
  path: string;
} {
  const match = path.match(/Method\[([^\]]+)]\.(.*)/);
  if (match) {
    return { methodName: match[1], path: match[2] };
  } else {
    return { methodName: "", path: "" };
  }
}

function rubyMethodSignature(typeName: string, methodName: string) {
  return `${typeName}#${methodName}`;
}

export const ruby: ModelsAsDataLanguage = {
  availableModes: [Mode.Framework],
  createMethodSignature: ({ typeName, methodName }) =>
    `${typeName}#${methodName}`,
  predicates: {
    source: {
      extensiblePredicate: sharedExtensiblePredicates.source,
      supportedKinds: sharedKinds.source,
      // extensible predicate sourceModel(
      //   string type, string path, string kind
      // );
      generateMethodDefinition: (method) => [
        method.typeName,
        `Method[${method.methodName}].${method.output}`,
        method.kind,
      ],
      readModeledMethod: (row) => {
        const typeName = row[0] as string;
        const { methodName, path: output } = parseRubyAccessPath(
          row[1] as string,
        );
        return {
          type: "source",
          input: "",
          output,
          kind: row[2] as string,
          provenance: "manual",
          signature: rubyMethodSignature(typeName, methodName),
          packageName: "",
          typeName,
          methodName,
          methodParameters: "",
        };
      },
    },
    sink: {
      extensiblePredicate: sharedExtensiblePredicates.sink,
      supportedKinds: sharedKinds.sink,
      // extensible predicate sinkModel(
      //   string type, string path, string kind
      // );
      generateMethodDefinition: (method) => {
        const path = `Method[${method.methodName}].${method.input}`;
        return [method.typeName, path, method.kind];
      },
      readModeledMethod: (row) => {
        const typeName = row[0] as string;
        const { methodName, path: input } = parseRubyAccessPath(
          row[1] as string,
        );
        return {
          type: "sink",
          input,
          output: "",
          kind: row[2] as string,
          provenance: "manual",
          signature: rubyMethodSignature(typeName, methodName),
          packageName: "",
          typeName,
          methodName,
          methodParameters: "",
        };
      },
    },
    summary: {
      extensiblePredicate: sharedExtensiblePredicates.summary,
      supportedKinds: sharedKinds.summary,
      // extensible predicate summaryModel(
      //   string type, string path, string input, string output, string kind
      // );
      generateMethodDefinition: (method) => [
        method.typeName,
        `Method[${method.methodName}]`,
        method.input,
        method.output,
        method.kind,
      ],
      readModeledMethod: (row) => {
        const typeName = row[0] as string;
        const methodName = parseRubyMethodFromPath(row[1] as string);
        return {
          type: "summary",
          input: row[2] as string,
          output: row[3] as string,
          kind: row[4] as string,
          provenance: "manual",
          signature: rubyMethodSignature(typeName, methodName),
          packageName: "",
          typeName,
          methodName,
          methodParameters: "",
        };
      },
    },
    neutral: {
      extensiblePredicate: sharedExtensiblePredicates.neutral,
      supportedKinds: sharedKinds.neutral,
      // extensible predicate neutralModel(
      //   string type, string path, string kind
      // );
      generateMethodDefinition: (method) => [
        method.typeName,
        `Method[${method.methodName}]`,
        method.kind,
      ],
      readModeledMethod: (row) => {
        const typeName = row[0] as string;
        const methodName = parseRubyMethodFromPath(row[1] as string);
        return {
          type: "neutral",
          input: "",
          output: "",
          kind: row[2] as string,
          provenance: "manual",
          signature: rubyMethodSignature(typeName, methodName),
          packageName: "",
          typeName,
          methodName,
          methodParameters: "",
        };
      },
    },
  },
  modelGeneration: {
    queryConstraints: {
      "query path": "queries/modeling/GenerateModel.ql",
    },
    parseResults: parseGenerateModelResults,
  },
  getArgumentOptions: (method) => {
    const argumentsList = getArgumentsList(method.methodParameters).map(
      (argument, index): MethodArgument => ({
        path: `Argument[${index}]`,
        label: `Argument[${index}]: ${argument}`,
      }),
    );

    return {
      options: [
        {
          path: "Argument[self]",
          label: "Argument[self]",
        },
        ...argumentsList,
      ],
      // If there are no arguments, we will default to "Argument[self]"
      defaultArgumentPath:
        argumentsList.length > 0 ? argumentsList[0].path : "Argument[self]",
    };
  },
};
