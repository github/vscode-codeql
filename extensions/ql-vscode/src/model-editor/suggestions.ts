import type { MethodSignature } from "./method";

export enum AccessPathSuggestionDefinitionType {
  Array = "array",
  Class = "class",
  Enum = "enum",
  EnumMember = "enum-member",
  Field = "field",
  Interface = "interface",
  Key = "key",
  Method = "method",
  Misc = "misc",
  Namespace = "namespace",
  Parameter = "parameter",
  Property = "property",
  Structure = "structure",
  Return = "return",
  Variable = "variable",
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

export function isDefinitionType(
  value: string,
): value is AccessPathSuggestionDefinitionType {
  return Object.values(AccessPathSuggestionDefinitionType).includes(
    value as AccessPathSuggestionDefinitionType,
  );
}
