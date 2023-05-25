import { ExternalApiUsage } from "./external-api-usage";
import { ModeledMethod, ModeledMethodType } from "./modeled-method";
import {
  Classification,
  ClassificationType,
  Method,
  ModelRequest,
} from "./auto-model-api";
import { DatabaseItem } from "../databases/local-databases";
import { tryResolveLocation } from "../interface-utils";
import { workspace } from "vscode";
import { TextDecoder } from "util";

export async function createAutoModelRequest(
  databaseItem: DatabaseItem,
  externalApiUsages: ExternalApiUsage[],
  modeledMethods: Record<string, ModeledMethod>,
): Promise<ModelRequest> {
  const request: ModelRequest = {
    language: databaseItem.language,
    samples: [],
    candidates: [],
  };

  // Sort by number of usages so we always send the most used methods first
  externalApiUsages = [...externalApiUsages];
  externalApiUsages.sort((a, b) => b.usages.length - a.usages.length);

  for (const externalApiUsage of externalApiUsages) {
    const modeledMethod: ModeledMethod = modeledMethods[
      externalApiUsage.signature
    ] ?? {
      type: "none",
    };

    const numberOfArguments =
      externalApiUsage.methodParameters === "()"
        ? 0
        : externalApiUsage.methodParameters.split(",").length;

    const usages = await Promise.all(
      externalApiUsage.usages.slice(0, 10).map(async (usage) => {
        const location = tryResolveLocation(usage.url, databaseItem);
        if (!location) {
          return usage.label;
        }
        const file = await workspace.fs.readFile(location.uri);
        // TODO: add support for non-utf8 files
        const decoder = new TextDecoder("utf-8");
        const str = decoder.decode(file);
        const lines = str.split(/\r\n|\r|\n/);

        const startLine = location.range.start.line;
        const startColumn = location.range.start.character;
        const endLine = location.range.end.line;
        const endColumn = location.range.end.character;

        let result = "";
        if (startLine === endLine) {
          result = lines[startLine].substring(startColumn, endColumn);
        } else {
          result = lines[startLine].substring(startColumn);
          for (let i = startLine + 1; i < endLine; i++) {
            result += lines[i];
          }
          result += lines[endLine].substring(0, endColumn);
        }

        return result;
      }),
    );

    for (
      let argumentIndex = 0;
      argumentIndex < numberOfArguments;
      argumentIndex++
    ) {
      const method: Method = {
        package: externalApiUsage.packageName,
        type: externalApiUsage.typeName,
        name: externalApiUsage.methodName,
        signature: externalApiUsage.methodParameters,
        classification:
          modeledMethod.type === "none"
            ? undefined
            : toMethodClassification(modeledMethod),
        usages,
      };

      if (modeledMethod.type === "none") {
        request.candidates.push(method);
      } else {
        request.samples.push(method);
      }
    }
  }

  request.candidates = request.candidates.slice(0, 100);
  request.samples = request.samples.slice(0, 20);

  return request;
}

function toMethodClassificationType(
  type: ModeledMethodType,
): ClassificationType {
  switch (type) {
    case "source":
      return ClassificationType.Source;
    case "sink":
      return ClassificationType.Sink;
    case "summary":
      return ClassificationType.Summary;
    case "neutral":
      return ClassificationType.Neutral;
    default:
      return ClassificationType.Unknown;
  }
}

function toMethodClassification(modeledMethod: ModeledMethod): Classification {
  return {
    type: toMethodClassificationType(modeledMethod.type),
    kind: modeledMethod.kind,
    explanation: "",
  };
}

export function classificationTypeToModeledMethodType(
  type: ClassificationType,
): ModeledMethodType {
  switch (type) {
    case ClassificationType.Source:
      return "source";
    case ClassificationType.Sink:
      return "sink";
    case ClassificationType.Summary:
      return "summary";
    case ClassificationType.Neutral:
      return "neutral";
    default:
      return "none";
  }
}
