import { ExternalApiUsage } from "./external-api-usage";
import { ModeledMethod, ModeledMethodType } from "./modeled-method";
import {
  Classification,
  ClassificationType,
  Method,
  ModelRequest,
} from "./auto-model-api";

export function createAutoModelRequest(
  language: string,
  externalApiUsages: ExternalApiUsage[],
  modeledMethods: Record<string, ModeledMethod>,
): ModelRequest {
  const request: ModelRequest = {
    language,
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
        usages: externalApiUsage.usages
          .slice(0, 10)
          .map((usage) => usage.label),
        input: `Argument[${argumentIndex}]`,
      };

      if (modeledMethod.type === "none") {
        request.candidates.push(method);
      } else {
        request.samples.push(method);
      }
    }
  }

  request.candidates = request.candidates.slice(0, 20);
  request.samples = request.samples.slice(0, 100);

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
