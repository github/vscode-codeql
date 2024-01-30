import type { AccessPathSuggestionRow } from "../../../src/model-editor/suggestions";
import { parseAccessPathSuggestionRowsToOptions } from "../../../src/model-editor/suggestions-bqrs";

describe("parseAccessPathSuggestionRowsToOptions", () => {
  const rows = [
    {
      method: {
        packageName: "",
        typeName: "Jekyll::Utils",
        methodName: "transform_keys",
        methodParameters: "",
        signature: "Jekyll::Utils#transform_keys",
      },
      value: "Argument[0]",
      details: "hash",
      definitionType: "parameter",
    },
    {
      method: {
        packageName: "",
        typeName: "Jekyll::Utils",
        methodName: "transform_keys",
        methodParameters: "",
        signature: "Jekyll::Utils#transform_keys",
      },
      value: "ReturnValue",
      details: "result",
      definitionType: "return",
    },
    {
      method: {
        packageName: "",
        typeName: "Jekyll::Utils",
        methodName: "transform_keys",
        methodParameters: "",
        signature: "Jekyll::Utils#transform_keys",
      },
      value: "Argument[self]",
      details: "self in transform_keys",
      definitionType: "parameter",
    },
    {
      method: {
        packageName: "",
        typeName: "Jekyll::Utils",
        methodName: "transform_keys",
        methodParameters: "",
        signature: "Jekyll::Utils#transform_keys",
      },
      value: "Argument[block].Parameter[0]",
      details: "key",
      definitionType: "parameter",
    },
    {
      method: {
        packageName: "",
        typeName: "Jekyll::Utils",
        methodName: "transform_keys",
        methodParameters: "",
        signature: "Jekyll::Utils#transform_keys",
      },
      value: "Argument[block]",
      details: "yield ...",
      definitionType: "parameter",
    },
  ] as AccessPathSuggestionRow[];

  it("should parse the AccessPathSuggestionRows", async () => {
    // Note that the order of these options matters
    const expectedOptions = {
      "Jekyll::Utils#transform_keys": [
        {
          label: "Argument[self]",
          value: "Argument[self]",
          details: "self in transform_keys",
          icon: "symbol-parameter",
          followup: [],
        },
        {
          label: "Argument[0]",
          value: "Argument[0]",
          details: "hash",
          icon: "symbol-parameter",
          followup: [],
        },
        {
          label: "Argument[block]",
          value: "Argument[block]",
          details: "yield ...",
          icon: "symbol-parameter",
          followup: [
            {
              label: "Parameter[0]",
              value: "Argument[block].Parameter[0]",
              details: "key",
              icon: "symbol-parameter",
              followup: [],
            },
          ],
        },
        {
          label: "ReturnValue",
          value: "ReturnValue",
          details: "result",
          icon: "symbol-method",
          followup: [],
        },
      ],
    };

    const options = parseAccessPathSuggestionRowsToOptions(rows);
    expect(options).toEqual(expectedOptions);
  });
});
