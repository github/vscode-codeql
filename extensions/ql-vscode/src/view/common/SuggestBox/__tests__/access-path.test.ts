import { hasAccessPathSyntaxError, parseAccessPathParts } from "../access-path";

describe("parseAccessPathParts", () => {
  it.each([
    {
      path: "Argument[foo].Element.Field[@test]",
      parts: ["Argument[foo]", "Element", "Field[@test]"],
    },
    {
      path: "Argument[foo].Element.Field[foo.Bar.x]",
      parts: ["Argument[foo]", "Element", "Field[foo.Bar.x]"],
    },
    {
      path: "Argument[",
      parts: ["Argument["],
    },
    {
      path: "Argument[se",
      parts: ["Argument[se"],
    },
    {
      path: "Argument[foo].Field[",
      parts: ["Argument[foo]", "Field["],
    },
    {
      path: "Argument[foo].",
      parts: ["Argument[foo]", ""],
    },
    {
      path: "Argument[foo]..",
      parts: ["Argument[foo]", "", ""],
    },
    {
      path: "Argument[foo[bar].test].Element.",
      parts: ["Argument[foo[bar].test]", "Element", ""],
    },
  ])(`parses correctly for $path`, ({ path, parts }) => {
    expect(parseAccessPathParts(path)).toEqual(parts);
  });
});

describe("hasAccessPathSyntaxError", () => {
  it.each([
    {
      path: "Argument[foo].Element.Field[@test]",
      valid: true,
    },
    {
      path: "Argument[foo].Element.Field[foo.Bar.x]",
      valid: true,
    },
    {
      path: "Argument[",
      valid: false,
    },
    {
      path: "Argument[se",
      valid: false,
    },
    {
      path: "Argument[foo].Field[",
      valid: false,
    },
    {
      path: "Argument[foo].",
      valid: false,
    },
    {
      path: "Argument[foo]..",
      valid: false,
    },
    {
      path: "Argument[foo[bar].test].Element.",
      valid: false,
    },
  ])(`validates $path correctly`, ({ path, valid }) => {
    expect(hasAccessPathSyntaxError(path)).toEqual(!valid);
  });
});
