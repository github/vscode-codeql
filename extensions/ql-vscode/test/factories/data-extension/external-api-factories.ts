import {
  Usage,
  ExternalApiUsage,
  CallClassification,
} from "../../../src/model-editor/external-api-usage";
import { ModeledMethodType } from "../../../src/model-editor/modeled-method";
import { ResolvableLocationValue } from "../../../src/common/bqrs-cli-types";

export function createExternalApiUsage({
  library = "sql2o-1.6.0.jar",
  supported = true,
  supportedType = "summary" as ModeledMethodType,
  usages = [],
  signature = "org.sql2o.Sql2o#open()",
  packageName = "org.sql2o",
  typeName = "Sql2o",
  methodName = "open",
  methodParameters = "()",
}: {
  library?: string;
  supported?: boolean;
  supportedType?: ModeledMethodType;
  usages?: Usage[];
  signature?: string;
  packageName?: string;
  typeName?: string;
  methodName?: string;
  methodParameters?: string;
} = {}): ExternalApiUsage {
  return {
    library,
    supported,
    supportedType,
    usages,
    signature,
    packageName,
    typeName,
    methodName,
    methodParameters,
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
