import type { Method, Usage } from "../../../src/model-editor/method";
import {
  EndpointType,
  CallClassification,
} from "../../../src/model-editor/method";
import type { UrlValueResolvable } from "../../../src/common/raw-result-types";

export function createMethod(data: Partial<Method> = {}): Method {
  return {
    library: "sql2o",
    libraryVersion: "1.6.0",
    supported: true,
    supportedType: "summary",
    usages: [],
    signature: "org.sql2o.Sql2o#open()",
    endpointType: EndpointType.Method,
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
  url = {
    type: "wholeFileLocation",
  } as UrlValueResolvable,
}: {
  classification?: CallClassification;
  label?: string;
  url?: UrlValueResolvable;
} = {}): Usage {
  return {
    classification,
    label,
    url,
  };
}
