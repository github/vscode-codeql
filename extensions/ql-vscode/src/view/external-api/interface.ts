import { ResolvableLocationValue } from "../../pure/bqrs-cli-types";

export type Call = {
  label: string;
  url: ResolvableLocationValue;
};

export type ExternalApiUsage = {
  externalApiInfo: string;
  packageName: string;
  typeName: string;
  methodName: string;
  methodParameters: string;
  supported: boolean;
  usages: Call[];
};

export type ModeledMethodType =
  | "none"
  | "source"
  | "sink"
  | "summary"
  | "neutral";

export type ModeledMethod = {
  type: ModeledMethodType;
  input: string;
  output: string;
  kind: string;
};
