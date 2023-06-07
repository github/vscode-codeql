import { ExternalApiUsage } from "./external-api-usage";
import { ModeledMethod, ModeledMethodType } from "./modeled-method";
import {
  Classification,
  ClassificationType,
  Method,
  ModelRequest,
} from "./auto-model-api";
import type { UsageSnippetsBySignature } from "./auto-model-usages-query";

// Soft limit on the number of candidates to send to the model.
// Note that the model may return fewer than this number of candidates.
const candidateLimit = 20;
// Soft limit on the number of samples to send to the model.
const sampleLimit = 100;

export function createAutoModelRequest(
  language: string,
  externalApiUsages: ExternalApiUsage[],
  modeledMethods: Record<string, ModeledMethod>,
  usages: UsageSnippetsBySignature,
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

    const usagesForMethod =
      usages[externalApiUsage.signature] ??
      externalApiUsage.usages.map((usage) => usage.label);

    const numberOfArguments =
      externalApiUsage.methodParameters === "()"
        ? 0
        : externalApiUsage.methodParameters.split(",").length;

    const candidates: Method[] = [];
    const samples: Method[] = [];
    for (
      let argumentIndex = -1; // Start at -1 which means `this` as in `this.method()`
      argumentIndex < numberOfArguments;
      argumentIndex++
    ) {
      const argumentInput: string =
        argumentIndex === -1 ? "Argument[this]" : `Argument[${argumentIndex}]`;
      const method: Method = {
        package: externalApiUsage.packageName,
        type: externalApiUsage.typeName,
        name: externalApiUsage.methodName,
        signature: externalApiUsage.methodParameters,
        classification:
          modeledMethod.type === "none"
            ? undefined
            : toMethodClassification(modeledMethod),
        usages: usagesForMethod.slice(0, 6), // At most 6 usages per argument
        input: argumentInput,
      };

      // A method that is supported is modeled outside of the model file, so it is not a candidate.
      // We also do not want it as a sample because we do not know the classification.
      if (modeledMethod.type === "none" && externalApiUsage.supported) {
        continue;
      }

      // Candidates are methods that are not currently modeled
      if (modeledMethod.type === "none") {
        candidates.push(method);
      } else {
        samples.push(method);
      }
    }
    // If there is room for at least one candidate, add all candidates.
    // This ensures that we send all arguments for a method together.
    // NOTE: this might go above the candidate limit, but that's okay.
    if (request.candidates.length < candidateLimit) {
      request.candidates.push(...candidates);
    }
    // Same for samples
    if (request.samples.length < sampleLimit) {
      request.samples.push(...samples);
    }
  }

  return request;
}

/**
 * For now, we have a simplified model that only models methods as sinks. It does not model methods as neutral,
 * so we aren't actually able to correctly determine that a method is neutral; it could still be a source or summary.
 * However, to keep this method simple and give output to the user, we will model any method for which none of its
 * arguments are modeled as sinks as neutral.
 *
 * If there are multiple arguments which are modeled as sinks, we will only model the first one.
 */
export function parsePredictedClassifications(
  predicted: Method[],
): Record<string, ModeledMethod> {
  const predictedBySignature: Record<string, Method[]> = {};
  for (const method of predicted) {
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
        kind: "summary",
        input: "",
        output: "",
        provenance: "ai-generated",
      };
      continue;
    }

    // Order the sinks by the input alphabetically. This will ensure that the first argument is always
    // first in the list of sinks, the second argument is always second, etc.
    // If we get back "Argument[1]" and "Argument[3]", "Argument[1]" should always be first
    sinks.sort((a, b) => compareInputOutput(a.input ?? "", b.input ?? ""));

    const sink = sinks[0];

    modeledMethods[signature] = {
      type: "sink",
      kind: sink.classification?.kind ?? "",
      input: sink.input ?? "",
      output: sink.output ?? "",
      provenance: "ai-generated",
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

const argumentRegex = /^Argument\[(\d+)]$/;

// Argument[this] is before ReturnValue
const nonNumericArgumentOrder = ["Argument[this]", "ReturnValue"];

/**
 * Compare two inputs or outputs matching `Argument[<number>]`, `Argument[this]`, or `ReturnValue`.
 * If they are the same, return 0. If a is less than b, returns a negative number.
 * If a is greater than b, returns a positive number.
 */
export function compareInputOutput(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  const aMatch = a.match(argumentRegex);
  const bMatch = b.match(argumentRegex);

  // Numeric arguments are always first
  if (aMatch && !bMatch) {
    return -1;
  }
  if (!aMatch && bMatch) {
    return 1;
  }

  // Neither is an argument
  if (!aMatch && !bMatch) {
    const aIndex = nonNumericArgumentOrder.indexOf(a);
    const bIndex = nonNumericArgumentOrder.indexOf(b);

    // If either one is unknown, it is sorted last
    if (aIndex === -1 && bIndex === -1) {
      // Use en-US because these are well-known strings that are not localized
      return a.localeCompare(b, "en-US");
    }
    if (aIndex === -1) {
      return 1;
    }
    if (bIndex === -1) {
      return -1;
    }

    return aIndex - bIndex;
  }

  // This case shouldn't happen, but makes TypeScript happy
  if (!aMatch || !bMatch) {
    return 0;
  }

  // Both are arguments
  const aIndex = parseInt(aMatch[1]);
  const bIndex = parseInt(bMatch[1]);

  return aIndex - bIndex;
}
