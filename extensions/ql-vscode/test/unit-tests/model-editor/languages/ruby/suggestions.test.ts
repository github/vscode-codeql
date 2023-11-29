import type { DecodedBqrsChunk } from "../../../../../src/common/bqrs-cli-types";
import { createMockLogger } from "../../../../__mocks__/loggerMock";
import { parseAccessPathSuggestionsResults } from "../../../../../src/model-editor/languages/ruby/suggestions";
import { ruby } from "../../../../../src/model-editor/languages/ruby";
import { AccessPathSuggestionDefinitionType } from "../../../../../src/model-editor/suggestions";

const queryResult: DecodedBqrsChunk = {
  columns: [
    { name: "type", kind: "String" },
    { name: "path", kind: "String" },
    { name: "value", kind: "String" },
    { name: "details", kind: "String" },
    { name: "defType", kind: "String" },
  ],
  tuples: [
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[0]",
      "name",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[self]",
      "self in create_function",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[block].Parameter[0]",
      "fp",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[block]",
      "call to call",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[1]",
      "arity",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[block].Parameter[1]",
      "* ...",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_function]",
      "Argument[2]",
      "text_rep",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_aggregate_handler]",
      "Argument[0]",
      "handler",
      "parameter",
    ],
    [
      "SQLite3::Database",
      "Method[create_aggregate_handler]",
      "Argument[self]",
      "self in create_aggregate_handler",
      "parameter",
    ],
    [
      "SQLite3::Database::FunctionProxy!",
      "Method[new]",
      "Argument[self]",
      "self in initialize",
      "parameter",
    ],
  ],
};

describe("parseAccessPathSuggestionsResults", () => {
  it("returns the correct rows", () => {
    expect(
      parseAccessPathSuggestionsResults(queryResult, ruby, createMockLogger()),
    ).toEqual([
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
    ]);
  });
});
