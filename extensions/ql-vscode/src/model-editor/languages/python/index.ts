import type { ModelsAsDataLanguage } from "../models-as-data";
import { sharedExtensiblePredicates, sharedKinds } from "../shared";
import { Mode } from "../../shared/mode";
import type { MethodArgument } from "../../method";
import { EndpointType, getArgumentsList } from "../../method";
import {
  hasPythonSelfArgument,
  parsePythonTypeAndPath,
  pythonEndpointType,
  pythonMethodPath,
  pythonMethodSignature,
  pythonPath,
  pythonType,
} from "./access-paths";

export const python: ModelsAsDataLanguage = {
  availableModes: [Mode.Framework],
  createMethodSignature: ({ typeName, methodName }) =>
    `${typeName}#${methodName}`,
  endpointTypeForEndpoint: (method, endpointKind) =>
    pythonEndpointType(method, endpointKind),
  predicates: {
    source: {
      extensiblePredicate: sharedExtensiblePredicates.source,
      supportedKinds: sharedKinds.source,
      supportedEndpointTypes: [
        EndpointType.Method,
        EndpointType.Function,
        EndpointType.Constructor,
        EndpointType.ClassMethod,
        EndpointType.StaticMethod,
      ],
      // extensible predicate sourceModel(
      //   string type, string path, string kind
      // );
      generateMethodDefinition: (method) => [
        pythonType(method.packageName, method.typeName, method.endpointType),
        pythonPath(method.methodName, method.output),
        method.kind,
      ],
      readModeledMethod: (row) => {
        const {
          packageName,
          typeName,
          methodName,
          endpointType,
          path: output,
        } = parsePythonTypeAndPath(row[0] as string, row[1] as string);
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
      supportedEndpointTypes: [
        EndpointType.Method,
        EndpointType.Function,
        EndpointType.Constructor,
        EndpointType.ClassMethod,
        EndpointType.StaticMethod,
      ],
      // extensible predicate sinkModel(
      //   string type, string path, string kind
      // );
      generateMethodDefinition: (method) => {
        return [
          pythonType(method.packageName, method.typeName, method.endpointType),
          pythonPath(method.methodName, method.input),
          method.kind,
        ];
      },
      readModeledMethod: (row) => {
        const {
          packageName,
          typeName,
          methodName,
          endpointType,
          path: input,
        } = parsePythonTypeAndPath(row[0] as string, row[1] as string);
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
      supportedEndpointTypes: [
        EndpointType.Method,
        EndpointType.Function,
        EndpointType.Constructor,
        EndpointType.ClassMethod,
        EndpointType.StaticMethod,
      ],
      // extensible predicate summaryModel(
      //   string type, string path, string input, string output, string kind
      // );
      generateMethodDefinition: (method) => [
        pythonType(method.packageName, method.typeName, method.endpointType),
        pythonMethodPath(method.methodName),
        method.input,
        method.output,
        method.kind,
      ],
      readModeledMethod: (row) => {
        const { packageName, typeName, methodName, endpointType, path } =
          parsePythonTypeAndPath(row[0] as string, row[1] as string);
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
        pythonType(method.packageName, method.typeName, method.endpointType),
        pythonMethodPath(method.methodName),
        method.kind,
      ],
      readModeledMethod: (row) => {
        const { packageName, typeName, methodName, endpointType, path } =
          parsePythonTypeAndPath(row[0] as string, row[1] as string);
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
    type: {
      extensiblePredicate: "typeModel",
      // extensible predicate typeModel(string type1, string type2, string path);
      generateMethodDefinition: (method) => [
        method.relatedTypeName,
        pythonType(method.packageName, method.typeName, method.endpointType),
        pythonPath(method.methodName, method.path),
      ],
      readModeledMethod: (row) => {
        const { packageName, typeName, methodName, endpointType, path } =
          parsePythonTypeAndPath(row[1] as string, row[2] as string);

        return {
          type: "type",
          relatedTypeName: row[0] as string,
          path,
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
        if (hasPythonSelfArgument(method.endpointType) && index === 0) {
          return {
            path: "Argument[self]",
            label: `Argument[self]: ${argument}`,
          };
        }

        // If this endpoint has a self argument, self does not count as an argument index so we
        // should start at 0 for the second argument
        if (hasPythonSelfArgument(method.endpointType)) {
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
