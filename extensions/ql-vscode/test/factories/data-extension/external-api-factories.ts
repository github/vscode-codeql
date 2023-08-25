import {
  Usage,
  ExternalApiUsage,
  CallClassification,
} from "../../../src/model-editor/external-api-usage";
import { ModeledMethodType } from "../../../src/model-editor/modeled-method";
import { ResolvableLocationValue } from "../../../src/common/bqrs-cli-types";

export function createExternalApiUsage({
  library = "test",
  supported = true,
  supportedType = "none" as ModeledMethodType,
  usages = [],
  signature = "test",
  packageName = "test",
  typeName = "test",
  methodName = "test",
  methodParameters = "test",
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
