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

export function parsePredictedClassifications(
  predicted: Method[],
): Record<string, ModeledMethod> {
  const predictedBySignature: Record<string, Method[]> = {};
  for (const method of predicted) {
    if (!method.classification) {
      continue;
    }

    const signature = toFullMethodSignature(method);

    if (!(signature in predictedBySignature)) {
      predictedBySignature[signature] = [];
    }

    predictedBySignature[signature].push(method);
  }

  const modeledMethods: Record<string, ModeledMethod> = {};

  for (const signature in predictedBySignature) {
    const predictedMethods = predictedBySignature[signature];

    const sinks = predictedMethods.filter(
      (method) => method.classification?.type === ClassificationType.Sink,
    );
    if (sinks.length === 0) {
      // For now, model any method for which none of its arguments are modeled as sinks as neutral
      modeledMethods[signature] = {
        type: "neutral",
        kind: "",
        input: "",
        output: "",
      };
      continue;
    }

    // Order the sinks by the input alphabetically. This will ensure that the first argument is always
    // first in the list of sinks, the second argument is always second, etc.
    // If we get back "Argument[1]" and "Argument[3]", "Argument[1]" should always be first
    sinks.sort((a, b) => (a.input ?? "").localeCompare(b.input ?? ""));

    const sink = sinks[0];

    modeledMethods[signature] = {
      type: "sink",
      kind: sink.classification?.kind ?? "",
      input: sink.input ?? "",
      output: sink.output ?? "",
    };
  }

  return modeledMethods;
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

function toFullMethodSignature(method: Method): string {
  return `${method.package}.${method.type}#${method.name}${method.signature}`;
}
