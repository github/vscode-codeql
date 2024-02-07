import type { ModeledMethod, SinkModeledMethod } from "./modeled-method";
import type { MethodSignature } from "./method";
import { assertNever } from "../common/helpers-pure";

export function createEmptyModeledMethod(
  type: ModeledMethod["type"],
  methodSignature: MethodSignature,
) {
  const canonicalMethodSignature: MethodSignature = {
    endpointType: methodSignature.endpointType,
    packageName: methodSignature.packageName,
    typeName: methodSignature.typeName,
    methodName: methodSignature.methodName,
    methodParameters: methodSignature.methodParameters,
    signature: methodSignature.signature,
  };

  switch (type) {
    case "none":
      return createEmptyNoneModeledMethod(canonicalMethodSignature);
    case "source":
      return createEmptySourceModeledMethod(canonicalMethodSignature);
    case "sink":
      return createEmptySinkModeledMethod(canonicalMethodSignature);
    case "summary":
      return createEmptySummaryModeledMethod(canonicalMethodSignature);
    case "neutral":
      return createEmptyNeutralModeledMethod(canonicalMethodSignature);
    case "type":
      return createEmptyTypeModeledMethod(canonicalMethodSignature);
    default:
      assertNever(type);
  }
}

function createEmptyNoneModeledMethod(
  methodSignature: MethodSignature,
): ModeledMethod {
  return {
    ...methodSignature,
    type: "none",
  };
}

function createEmptySourceModeledMethod(
  methodSignature: MethodSignature,
): ModeledMethod {
  return {
    ...methodSignature,
    type: "source",
    output: "",
    kind: "",
    provenance: "manual",
  };
}

function createEmptySinkModeledMethod(
  methodSignature: MethodSignature,
): SinkModeledMethod {
  return {
    ...methodSignature,
    type: "sink",
    input: "",
    kind: "",
    provenance: "manual",
  };
}

function createEmptySummaryModeledMethod(
  methodSignature: MethodSignature,
): ModeledMethod {
  return {
    ...methodSignature,
    type: "summary",
    input: "",
    output: "",
    kind: "",
    provenance: "manual",
  };
}

function createEmptyNeutralModeledMethod(
  methodSignature: MethodSignature,
): ModeledMethod {
  return {
    ...methodSignature,
    type: "neutral",
    kind: "",
    provenance: "manual",
  };
}

function createEmptyTypeModeledMethod(
  methodSignature: MethodSignature,
): ModeledMethod {
  return {
    ...methodSignature,
    type: "type",
    relatedTypeName: "",
    path: "",
  };
}
