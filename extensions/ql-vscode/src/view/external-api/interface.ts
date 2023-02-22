export type ExternalApiUsage = {
  externalApiInfo: string;
  packageName: string;
  typeName: string;
  methodName: string;
  methodParameters: string;
  usages: number;
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
