import type { DecodedBqrsChunk } from "../../../../../src/common/bqrs-cli-types";
import { ruby } from "../../../../../src/model-editor/languages/ruby";
import { createMockLogger } from "../../../../__mocks__/loggerMock";
import { parseAccessPathSuggestionsResults } from "../../../../../src/model-editor/languages/ruby/suggestions";
import type { AccessPathSuggestionRow } from "../../../../../src/model-editor/suggestions";
import { AccessPathSuggestionDefinitionType } from "../../../../../src/model-editor/suggestions";
import { EndpointType } from "../../../../../src/model-editor/method";

describe("parseAccessPathSuggestionsResults", () => {
  it("should parse the results", async () => {
    const bqrsChunk: DecodedBqrsChunk = {
      columns: [
        {
          name: "type",
          kind: "String",
        },
        {
          name: "path",
          kind: "String",
        },
        {
          name: "value",
          kind: "String",
        },
        {
          name: "node",
          kind: "Entity",
        },
        {
          name: "defType",
          kind: "String",
        },
      ],
      tuples: [
        [
          "Correctness",
          "Method[assert!]",
          "Argument[self]",
          {
            label: "self in assert!",
          },
          "parameter",
        ],
      ],
    };

    const result = parseAccessPathSuggestionsResults(
      bqrsChunk,
      ruby,
      createMockLogger(),
    );

    expect(result).toEqual([
      {
        method: {
          endpointType: EndpointType.Method,
          packageName: "",
          typeName: "Correctness",
          methodName: "assert!",
          methodParameters: "",
          signature: "Correctness#assert!",
        },
        value: "Argument[self]",
        details: "self in assert!",
        definitionType: AccessPathSuggestionDefinitionType.Parameter,
      },
    ] satisfies AccessPathSuggestionRow[]);
  });

  it("should not parse an incorrect result format", async () => {
    const bqrsChunk: DecodedBqrsChunk = {
      columns: [
        {
          name: "type",
          kind: "String",
        },
        {
          name: "path",
          kind: "String",
        },
        {
          name: "value",
          kind: "String",
        },
        {
          name: "details",
          kind: "String",
        },
        {
          name: "defType",
          kind: "String",
        },
      ],
      tuples: [
        [
          "Correctness",
          "Method[assert!]",
          "Argument[self]",
          "self in assert!",
          "parameter",
        ],
        ["Correctness", "Method[assert!]", "Argument[self]", "parameter"],
      ],
    };

    const logger = createMockLogger();
    expect(parseAccessPathSuggestionsResults(bqrsChunk, ruby, logger)).toEqual(
      [],
    );
    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenCalledWith(
      "Skipping result 0 because it has the wrong format",
    );
    expect(logger.log).toHaveBeenCalledWith(
      "Skipping result 1 because it has the wrong format",
    );
  });
});
