import { ModeledMethod } from "../../../src/model-editor/modeled-method";

export function createModeledMethod(
  data: Partial<ModeledMethod> = {},
): ModeledMethod {
  return {
    libraryVersion: "1.6.0",
    signature: "org.sql2o.Connection#createQuery(String)",
    packageName: "org.sql2o",
    typeName: "Connection",
    methodName: "createQuery",
    methodParameters: "(String)",
    type: "sink",
    input: "Argument[0]",
    output: "",
    kind: "path-injection",
    provenance: "manual",
    ...data,
  };
}
