import type {
  NeutralModeledMethod,
  NoneModeledMethod,
  SinkModeledMethod,
  SourceModeledMethod,
  SummaryModeledMethod,
} from "../../../src/model-editor/modeled-method";
import type { MethodSignature } from "../../../src/model-editor/method";
import { EndpointType } from "../../../src/model-editor/method";

export function createMethodSignature(
  data: Partial<MethodSignature> = {},
): MethodSignature {
  return {
    libraryVersion: "1.6.0",
    signature: "org.sql2o.Connection#createQuery(String)",
    endpointType: EndpointType.Method,
    packageName: "org.sql2o",
    typeName: "Connection",
    methodName: "createQuery",
    methodParameters: "(String)",
    ...data,
  };
}

export function createNoneModeledMethod(
  data: Partial<NoneModeledMethod> = {},
): NoneModeledMethod {
  return {
    ...createMethodSignature(),
    type: "none",
    ...data,
  };
}

export function createSinkModeledMethod(
  data: Partial<SinkModeledMethod> = {},
): SinkModeledMethod {
  return {
    ...createMethodSignature(),
    type: "sink",
    input: "Argument[0]",
    kind: "path-injection",
    provenance: "manual",
    ...data,
  };
}

export function createSourceModeledMethod(
  data: Partial<SourceModeledMethod> = {},
): SourceModeledMethod {
  return {
    ...createMethodSignature(),
    type: "source",
    output: "ReturnValue",
    kind: "remote",
    provenance: "manual",
    ...data,
  };
}

export function createSummaryModeledMethod(
  data: Partial<SummaryModeledMethod> = {},
): SummaryModeledMethod {
  return {
    ...createMethodSignature(),
    type: "summary",
    input: "Argument[this]",
    output: "ReturnValue",
    kind: "taint",
    provenance: "manual",
    ...data,
  };
}

export function createNeutralModeledMethod(
  data: Partial<NeutralModeledMethod> = {},
): NeutralModeledMethod {
  return {
    ...createMethodSignature(),
    type: "neutral",
    kind: "summary",
    provenance: "manual",
    ...data,
  };
}
