import { parseAccessPathSuggestionRowsToOptions } from "../../../src/model-editor/suggestions-bqrs";
import type { AccessPathSuggestionRow } from "../../../src/model-editor/suggestions";
import { AccessPathSuggestionDefinitionType } from "../../../src/model-editor/suggestions";

const rows: AccessPathSuggestionRow[] = [
  {
    definitionType: AccessPathSuggestionDefinitionType.Parameter,
    details: "name",
    method: {
      methodName: "create_function",
      methodParameters: "",
      packageName: "",
      signature: "SQLite3::Database#create_function",
      typeName: "SQLite3::Database",
    },
    value: "Argument[0]",
  },
  {
    definitionType: AccessPathSuggestionDefinitionType.Parameter,
    details: "self in create_function",
    method: {
      methodName: "create_function",
      methodParameters: "",
      packageName: "",
      signature: "SQLite3::Database#create_function",
      typeName: "SQLite3::Database",
    },
    value: "Argument[self]",
  },
  {
    definitionType: AccessPathSuggestionDefinitionType.Parameter,
    details: "fp",
    method: {
      methodName: "create_function",
      methodParameters: "",
      packageName: "",
      signature: "SQLite3::Database#create_function",
      typeName: "SQLite3::Database",
    },
    value: "Argument[block].Parameter[0]",
  },
  {
    definitionType: AccessPathSuggestionDefinitionType.Parameter,
    details: "call to call",
    method: {
      methodName: "create_function",
      methodParameters: "",
      packageName: "",
      signature: "SQLite3::Database#create_function",
      typeName: "SQLite3::Database",
    },
    value: "Argument[block]",
  },
  {
    definitionType: AccessPathSuggestionDefinitionType.Parameter,
    details: "arity",
    method: {
      methodName: "create_function",
      methodParameters: "",
      packageName: "",
      signature: "SQLite3::Database#create_function",
      typeName: "SQLite3::Database",
    },
    value: "Argument[1]",
  },
  {
    definitionType: AccessPathSuggestionDefinitionType.Parameter,
    details: "* ...",
    method: {
      methodName: "create_function",
      methodParameters: "",
      packageName: "",
      signature: "SQLite3::Database#create_function",
      typeName: "SQLite3::Database",
    },
    value: "Argument[block].Parameter[1]",
  },
  {
    definitionType: AccessPathSuggestionDefinitionType.Parameter,
    details: "text_rep",
    method: {
      methodName: "create_function",
      methodParameters: "",
      packageName: "",
      signature: "SQLite3::Database#create_function",
      typeName: "SQLite3::Database",
    },
    value: "Argument[2]",
  },
  {
    definitionType: AccessPathSuggestionDefinitionType.Parameter,
    details: "handler",
    method: {
      methodName: "create_aggregate_handler",
      methodParameters: "",
      packageName: "",
      signature: "SQLite3::Database#create_aggregate_handler",
      typeName: "SQLite3::Database",
    },
    value: "Argument[0]",
  },
  {
    definitionType: AccessPathSuggestionDefinitionType.Parameter,
    details: "self in create_aggregate_handler",
    method: {
      methodName: "create_aggregate_handler",
      methodParameters: "",
      packageName: "",
      signature: "SQLite3::Database#create_aggregate_handler",
      typeName: "SQLite3::Database",
    },
    value: "Argument[self]",
  },
  {
    definitionType: AccessPathSuggestionDefinitionType.Parameter,
    details: "self in initialize",
    method: {
      methodName: "new",
      methodParameters: "",
      packageName: "",
      signature: "SQLite3::Database::FunctionProxy!#new",
      typeName: "SQLite3::Database::FunctionProxy!",
    },
    value: "Argument[self]",
  },
];

describe("parseAccessPathSuggestionRowsToOptions", () => {
  it("returns the correct options", () => {
    expect(parseAccessPathSuggestionRowsToOptions(rows)).toEqual({
      "SQLite3::Database#create_function": [
        {
          label: "Argument[self]",
          value: "Argument[self]",
          details: "self in create_function",
          icon: "symbol-parameter",
          followup: [],
        },
        {
          label: "Argument[0]",
          value: "Argument[0]",
          details: "name",
          icon: "symbol-parameter",
          followup: [],
        },
        {
          label: "Argument[1]",
          value: "Argument[1]",
          details: "arity",
          icon: "symbol-parameter",
          followup: [],
        },
        {
          label: "Argument[2]",
          value: "Argument[2]",
          details: "text_rep",
          icon: "symbol-parameter",
          followup: [],
        },
        {
          label: "Argument[block]",
          value: "Argument[block]",
          details: "call to call",
          icon: "symbol-parameter",
          followup: [
            {
              label: "Parameter[0]",
              value: "Argument[block].Parameter[0]",
              details: "fp",
              icon: "symbol-parameter",
              followup: [],
            },
            {
              label: "Parameter[1]",
              value: "Argument[block].Parameter[1]",
              details: "* ...",
              icon: "symbol-parameter",
              followup: [],
            },
          ],
        },
      ],
      "SQLite3::Database#create_aggregate_handler": [
        {
          label: "Argument[self]",
          value: "Argument[self]",
          details: "self in create_aggregate_handler",
          icon: "symbol-parameter",
          followup: [],
        },
        {
          label: "Argument[0]",
          value: "Argument[0]",
          details: "handler",
          icon: "symbol-parameter",
          followup: [],
        },
      ],
      "SQLite3::Database::FunctionProxy!#new": [
        {
          label: "Argument[self]",
          value: "Argument[self]",
          details: "self in initialize",
          icon: "symbol-parameter",
          followup: [],
        },
      ],
    });
  });
});
