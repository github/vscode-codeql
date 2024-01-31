import type { DecodedBqrsChunk } from "../../../../../src/common/bqrs-cli-types";
import { ruby } from "../../../../../src/model-editor/languages/ruby";
import { createMockLogger } from "../../../../__mocks__/loggerMock";
import { parseAccessPathSuggestionsResults } from "../../../../../src/model-editor/languages/ruby/suggestions";

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
          packageName: "",
          typeName: "Correctness",
          methodName: "assert!",
          methodParameters: "",
          signature: "Correctness#assert!",
        },
        value: "Argument[self]",
        details: "self in assert!",
        definitionType: "parameter",
      },
    ]);
  });
});
