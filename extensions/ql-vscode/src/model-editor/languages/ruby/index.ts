import type { ModelsAsDataLanguage } from "../models-as-data";
import { AutoModelGenerationType } from "../models-as-data";
import { sharedExtensiblePredicates, sharedKinds } from "../shared";
import { Mode } from "../../shared/mode";
import { parseGenerateModelResults } from "./generate";
import type { MethodArgument } from "../../method";
import { EndpointType, getArgumentsList } from "../../method";
import {
  parseRubyAccessPath,
  parseRubyMethodFromPath,
  rubyEndpointType,
  rubyMethodPath,
  rubyMethodSignature,
  rubyPath,
} from "./access-paths";
import { parseAccessPathSuggestionsResults } from "./suggestions";
import { modeTag } from "../../mode-tag";

export const ruby: ModelsAsDataLanguage = {
  availableModes: [Mode.Framework],
  createMethodSignature: ({ typeName, methodName }) =>
    `${typeName}#${methodName}`,
  endpointTypeForEndpoint: ({ typeName, methodName }) =>
    rubyEndpointType(typeName, methodName),
  predicates: {
    source: {
      extensiblePredicate: sharedExtensiblePredicates.source,
      supportedKinds: sharedKinds.source,
      supportedEndpointTypes: [EndpointType.Method, EndpointType.Class],
      // extensible predicate sourceModel(
      //   string type, string path, string kind
      // );
      generateMethodDefinition: (method) => [
        method.typeName,
        rubyPath(method.methodName, method.output),
        method.kind,
      ],
      readModeledMethod: (row) => {
        const typeName = row[0] as string;
        const { methodName, path: output } = parseRubyAccessPath(
          row[1] as string,
        );
        return {
          type: "source",
          output,
          kind: row[2] as string,
          provenance: "manual",
          signature: rubyMethodSignature(typeName, methodName),
          endpointType: rubyEndpointType(typeName, methodName),
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
      supportedEndpointTypes: [EndpointType.Method, EndpointType.Constructor],
      // extensible predicate sinkModel(
      //   string type, string path, string kind
      // );
      generateMethodDefinition: (method) => {
        return [
          method.typeName,
          rubyPath(method.methodName, method.input),
          method.kind,
        ];
      },
      readModeledMethod: (row) => {
        const typeName = row[0] as string;
        const { methodName, path: input } = parseRubyAccessPath(
          row[1] as string,
        );
        return {
          type: "sink",
          input,
          kind: row[2] as string,
          provenance: "manual",
          signature: rubyMethodSignature(typeName, methodName),
          endpointType: rubyEndpointType(typeName, methodName),
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
      supportedEndpointTypes: [EndpointType.Method, EndpointType.Constructor],
      // extensible predicate summaryModel(
      //   string type, string path, string input, string output, string kind
      // );
      generateMethodDefinition: (method) => [
        method.typeName,
        rubyMethodPath(method.methodName),
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
          endpointType: rubyEndpointType(typeName, methodName),
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
        rubyMethodPath(method.methodName),
        method.kind,
      ],
      readModeledMethod: (row) => {
        const typeName = row[0] as string;
        const methodName = parseRubyMethodFromPath(row[1] as string);
        return {
          type: "neutral",
          kind: row[2] as string,
          provenance: "manual",
          signature: rubyMethodSignature(typeName, methodName),
          endpointType: rubyEndpointType(typeName, methodName),
          packageName: "",
          typeName,
          methodName,
          methodParameters: "",
        };
      },
    },
    type: {
      extensiblePredicate: "typeModel",
      // extensible predicate typeModel(string type1, string type2, string path);
      generateMethodDefinition: (method) => [
        method.relatedTypeName,
        method.typeName,
        rubyPath(method.methodName, method.path),
      ],
      readModeledMethod: (row) => {
        const typeName = row[1] as string;
        const { methodName, path } = parseRubyAccessPath(row[2] as string);

        return {
          type: "type",
          relatedTypeName: row[0] as string,
          path,
          signature: rubyMethodSignature(typeName, methodName),
          endpointType: rubyEndpointType(typeName, methodName),
          packageName: "",
          typeName,
          methodName,
          methodParameters: "",
        };
      },
    },
  },
  modelGeneration: {
    queryConstraints: (mode) => ({
      kind: "table",
      "tags contain all": ["modeleditor", "generate-model", modeTag(mode)],
    }),
    parseResults: parseGenerateModelResults,
  },
  autoModelGeneration: {
    queryConstraints: (mode) => ({
      kind: "table",
      "tags contain all": ["modeleditor", "generate-model", modeTag(mode)],
    }),
    parseResultsToYaml: (_queryPath, bqrs, modelsAsDataLanguage) => {
      const typePredicate = modelsAsDataLanguage.predicates.type;
      if (!typePredicate) {
        throw new Error("Type predicate not found");
      }

      const typeTuples = bqrs[typePredicate.extensiblePredicate];
      if (!typeTuples) {
        return [];
      }

      return [
        {
          addsTo: {
            pack: "codeql/ruby-all",
            extensible: typePredicate.extensiblePredicate,
          },
          data: typeTuples.tuples.filter((tuple): tuple is string[] => {
            return (
              tuple.filter((x) => typeof x === "string").length === tuple.length
            );
          }),
        },
      ];
    },
    parseResults: (queryPath, bqrs, modelsAsDataLanguage, logger) => {
      // Only parse type models when automatically generating models
      const typePredicate = modelsAsDataLanguage.predicates.type;
      if (!typePredicate) {
        throw new Error("Type predicate not found");
      }

      const typeTuples = bqrs[typePredicate.extensiblePredicate];
      if (!typeTuples) {
        return [];
      }

      return parseGenerateModelResults(
        queryPath,
        {
          [typePredicate.extensiblePredicate]: typeTuples,
        },
        modelsAsDataLanguage,
        logger,
      );
    },
    // Only enabled for framework mode when type models are hidden
    type: ({ mode }) =>
      mode === Mode.Framework
        ? AutoModelGenerationType.Models
        : AutoModelGenerationType.Disabled,
  },
  accessPathSuggestions: {
    queryConstraints: (mode) => ({
      kind: "table",
      "tags contain all": ["modeleditor", "access-paths", modeTag(mode)],
    }),
    parseResults: parseAccessPathSuggestionsResults,
  },
  getArgumentOptions: (method) => {
    const argumentsList = getArgumentsList(method.methodParameters).map(
      (argument, index): MethodArgument => {
        if (argument.endsWith(":")) {
          return {
            path: `Argument[${argument}]`,
            label: `Argument[${argument}]`,
          };
        }

        return {
          path: `Argument[${index}]`,
          label: `Argument[${index}]: ${argument}`,
        };
      },
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
