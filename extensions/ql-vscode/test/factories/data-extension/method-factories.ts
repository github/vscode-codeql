import {
  Usage,
  Method,
  CallClassification,
} from "../../../src/model-editor/method";
import { ResolvableLocationValue } from "../../../src/common/bqrs-cli-types";

export function createMethod(data: Partial<Method> = {}): Method {
  return {
    library: "sql2o",
    libraryVersion: "1.6.0",
    supported: true,
    supportedType: "summary",
    usages: [],
    signature: "org.sql2o.Sql2o#open()",
    packageName: "org.sql2o",
    typeName: "Sql2o",
    methodName: "open",
    methodParameters: "()",
    ...data,
  };
}

export function createUsage({
  classification = CallClassification.Unknown,
  label = "test",
  url = {} as ResolvableLocationValue,
}: {
  classification?: CallClassification;
  label?: string;
  url?: ResolvableLocationValue;
} = {}): Usage {
  return {
    classification,
    label,
    url,
  };
}
