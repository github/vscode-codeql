import {
  parseAccessPathTokens,
  validateAccessPath,
} from "../../../../src/model-editor/shared/access-paths";

describe("parseAccessPathTokens", () => {
  it.each([
    {
      path: "Argument[foo].Element.Field[@test]",
      parts: [
        {
          range: {
            start: 0,
            end: 13,
          },
          text: "Argument[foo]",
        },
        {
          range: {
            start: 14,
            end: 21,
          },
          text: "Element",
        },
        {
          range: {
            start: 22,
            end: 34,
          },
          text: "Field[@test]",
        },
      ],
    },
    {
      path: "Argument[foo].Element.Field[foo.Bar.x]",
      parts: [
        {
          range: {
            start: 0,
            end: 13,
          },
          text: "Argument[foo]",
        },
        {
          range: {
            start: 14,
            end: 21,
          },
          text: "Element",
        },
        {
          range: {
            start: 22,
            end: 38,
          },
          text: "Field[foo.Bar.x]",
        },
      ],
    },
    {
      path: "Argument[",
      parts: [
        {
          range: {
            start: 0,
            end: 9,
          },
          text: "Argument[",
        },
      ],
    },
    {
      path: "Argument[se",
      parts: [
        {
          range: {
            start: 0,
            end: 11,
          },
          text: "Argument[se",
        },
      ],
    },
    {
      path: "Argument[foo].Field[",
      parts: [
        {
          range: {
            start: 0,
            end: 13,
          },
          text: "Argument[foo]",
        },
        {
          range: {
            start: 14,
            end: 20,
          },
          text: "Field[",
        },
      ],
    },
    {
      path: "Argument[foo].",
      parts: [
        {
          text: "Argument[foo]",
          range: {
            end: 13,
            start: 0,
          },
        },
        {
          text: "",
          range: {
            end: 14,
            start: 14,
          },
        },
      ],
    },
    {
      path: "Argument[foo]..",
      parts: [
        {
          text: "Argument[foo]",
          range: {
            end: 13,
            start: 0,
          },
        },
        {
          text: "",
          range: {
            end: 14,
            start: 14,
          },
        },
        {
          text: "",
          range: {
            end: 15,
            start: 15,
          },
        },
      ],
    },
    {
      path: "Argument[foo[bar].test].Element.",
      parts: [
        {
          range: {
            start: 0,
            end: 23,
          },
          text: "Argument[foo[bar].test]",
        },
        {
          range: {
            start: 24,
            end: 31,
          },
          text: "Element",
        },
        {
          range: {
            start: 32,
            end: 32,
          },
          text: "",
        },
      ],
    },
  ])(`parses correctly for $path`, ({ path, parts }) => {
    expect(parseAccessPathTokens(path)).toEqual(parts);
  });
});

describe("validateAccessPath", () => {
  it.each([
    {
      path: "Argument[foo].Element.Field[@test]",
      diagnostics: [],
    },
    {
      path: "Argument[foo].Element.Field[foo.Bar.x]",
      diagnostics: [],
    },
    {
      path: "Argument[",
      diagnostics: [
        {
          message: "Invalid access path",
          range: {
            start: 0,
            end: 9,
          },
        },
      ],
    },
    {
      path: "Argument[se",
      diagnostics: [
        {
          message: "Invalid access path",
          range: {
            start: 0,
            end: 11,
          },
        },
      ],
    },
    {
      path: "Argument[foo].Field[",
      diagnostics: [
        {
          message: "Invalid access path",
          range: {
            start: 14,
            end: 20,
          },
        },
      ],
    },
    {
      path: "Argument[foo].",
      diagnostics: [
        { message: "Unexpected empty token", range: { start: 14, end: 14 } },
      ],
    },
    {
      path: "Argument[foo]..",
      diagnostics: [
        { message: "Unexpected empty token", range: { start: 14, end: 14 } },
        { message: "Unexpected empty token", range: { start: 15, end: 15 } },
      ],
    },
    {
      path: "Argument[foo[bar].test].Element.",
      diagnostics: [
        { message: "Invalid access path", range: { start: 0, end: 23 } },
        { message: "Unexpected empty token", range: { start: 32, end: 32 } },
      ],
    },
  ])(
    `validates $path correctly with $diagnostics.length errors`,
    ({ path, diagnostics }) => {
      expect(validateAccessPath(path)).toEqual(diagnostics);
    },
  );
});
