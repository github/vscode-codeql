import type { ModelsAsDataLanguage } from "../models-as-data";
import { sharedExtensiblePredicates, sharedKinds } from "../shared";
import { Mode } from "../../shared/mode";
import type { MethodArgument } from "../../method";
import { EndpointType, getArgumentsList } from "../../method";
import {
  parsePythonAccessPath,
  pythonEndpointType,
  pythonMethodPath,
  pythonMethodSignature,
  pythonPath,
} from "./access-paths";

export const python: ModelsAsDataLanguage = {
  availableModes: [Mode.Framework],
  createMethodSignature: ({ typeName, methodName }) =>
    `${typeName}#${methodName}`,
  endpointTypeForEndpoint: (method) => pythonEndpointType(method),
  predicates: {
    source: {
      extensiblePredicate: sharedExtensiblePredicates.source,
      supportedKinds: sharedKinds.source,
      supportedEndpointTypes: [EndpointType.Method, EndpointType.Function],
      // extensible predicate sourceModel(
      //   string type, string path, string kind
      // );
      generateMethodDefinition: (method) => [
        method.packageName,
        pythonPath(
          method.typeName,
          method.methodName,
          method.endpointType,
          method.output,
        ),
        method.kind,
      ],
      readModeledMethod: (row) => {
        const packageName = row[0] as string;
        const {
          typeName,
          methodName,
          endpointType,
          path: output,
        } = parsePythonAccessPath(row[1] as string);
        return {
          type: "source",
          output,
          kind: row[2] as string,
          provenance: "manual",
          signature: pythonMethodSignature(typeName, methodName),
          endpointType,
          packageName,
          typeName,
          methodName,
          methodParameters: "",
        };
      },
    },
    sink: {
      extensiblePredicate: sharedExtensiblePredicates.sink,
      supportedKinds: sharedKinds.sink,
      supportedEndpointTypes: [EndpointType.Method, EndpointType.Function],
      // extensible predicate sinkModel(
      //   string type, string path, string kind
      // );
      generateMethodDefinition: (method) => {
        return [
          method.packageName,
          pythonPath(
            method.typeName,
            method.methodName,
            method.endpointType,
            method.input,
          ),
          method.kind,
        ];
      },
      readModeledMethod: (row) => {
        const packageName = row[0] as string;
        const {
          typeName,
          methodName,
          endpointType,
          path: input,
        } = parsePythonAccessPath(row[1] as string);
        return {
          type: "sink",
          input,
          kind: row[2] as string,
          provenance: "manual",
          signature: pythonMethodSignature(typeName, methodName),
          endpointType,
          packageName,
          typeName,
          methodName,
          methodParameters: "",
        };
      },
    },
    summary: {
      extensiblePredicate: sharedExtensiblePredicates.summary,
      supportedKinds: sharedKinds.summary,
      supportedEndpointTypes: [EndpointType.Method, EndpointType.Function],
      // extensible predicate summaryModel(
      //   string type, string path, string input, string output, string kind
      // );
      generateMethodDefinition: (method) => [
        method.packageName,
        pythonMethodPath(
          method.typeName,
          method.methodName,
          method.endpointType,
        ),
        method.input,
        method.output,
        method.kind,
      ],
      readModeledMethod: (row) => {
        const packageName = row[0] as string;
        const { typeName, methodName, endpointType, path } =
          parsePythonAccessPath(row[1] as string);
        if (path !== "") {
          throw new Error("Summary path must be a method");
        }
        return {
          type: "summary",
          input: row[2] as string,
          output: row[3] as string,
          kind: row[4] as string,
          provenance: "manual",
          signature: pythonMethodSignature(typeName, methodName),
          endpointType,
          packageName,
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
        method.packageName,
        pythonMethodPath(
          method.typeName,
          method.methodName,
          method.endpointType,
        ),
        method.kind,
      ],
      readModeledMethod: (row) => {
        const packageName = row[0] as string;
        const { typeName, methodName, endpointType, path } =
          parsePythonAccessPath(row[1] as string);
        if (path !== "") {
          throw new Error("Neutral path must be a method");
        }
        return {
          type: "neutral",
          kind: row[2] as string,
          provenance: "manual",
          signature: pythonMethodSignature(typeName, methodName),
          endpointType,
          packageName,
          typeName,
          methodName,
          methodParameters: "",
        };
      },
    },
  },
  getArgumentOptions: (method) => {
    // Argument and Parameter are equivalent in Python, but we'll use Argument in the model editor
    const argumentsList = getArgumentsList(method.methodParameters).map(
      (argument, index): MethodArgument => {
        if (
          method.endpointType === EndpointType.Method &&
          argument === "self" &&
          index === 0
        ) {
          return {
            path: "Argument[self]",
            label: "Argument[self]: self",
          };
        }

        // If this is a method, self does not count as an argument index, so we
        // should start at 0 for the second argument
        if (method.endpointType === EndpointType.Method) {
          index -= 1;
        }

        // Keyword-only arguments end with `:` in the query
        if (argument.endsWith(":")) {
          return {
            path: `Argument[${argument}]`,
            label: `Argument[${argument}]: ${argument.substring(0, argument.length - 1)}`,
          };
        }

        // Positional-only arguments end with `/` in the query
        if (argument.endsWith("/")) {
          return {
            path: `Argument[${index}]`,
            label: `Argument[${index}]: ${argument.substring(0, argument.length - 1)}`,
          };
        }

        // All other arguments are both keyword and positional
        return {
          path: `Argument[${index},${argument}:]`,
          label: `Argument[${index},${argument}:]: ${argument}`,
        };
      },
    );

    return {
      options: argumentsList,
      // If there are no arguments, we will default to "Argument[self]"
      defaultArgumentPath:
        argumentsList.length > 0 ? argumentsList[0].path : "Argument[self]",
    };
  },
};
