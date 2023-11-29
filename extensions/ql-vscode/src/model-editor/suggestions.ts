import type { MethodSignature } from "./method";

export enum AccessPathSuggestionDefinitionType {
  Class = "class",
  Parameter = "parameter",
  Return = "return",
}

export type AccessPathSuggestionRow = {
  method: MethodSignature;
  definitionType: AccessPathSuggestionDefinitionType;
  value: string;
  details: string;
};

export type AccessPathSuggestionRows = {
  input: AccessPathSuggestionRow[];
  output: AccessPathSuggestionRow[];
};

export type AccessPathOption = {
  label: string;
  value: string;
  icon: string;
  details?: string;
  followup?: AccessPathOption[];
};

export type AccessPathSuggestionOptions = {
  input: Record<string, AccessPathOption[]>;
  output: Record<string, AccessPathOption[]>;
};
