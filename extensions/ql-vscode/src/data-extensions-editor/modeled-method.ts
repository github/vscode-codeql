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

export type ModeledMethodWithSignature = {
  signature: string;
  modeledMethod: ModeledMethod;
};
