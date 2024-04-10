import {
  sanitizePackName,
  formatPackName,
  parsePackName,
  validatePackName,
} from "../../../src/model-editor/extension-pack-name";

describe("sanitizePackName", () => {
  const testCases: Array<{
    name: string;
    expected: string;
  }> = [
    {
      name: "github/vscode-codeql-javascript",
      expected: "github/vscode-codeql-javascript",
    },
    {
      name: "vscode-codeql-a",
      expected: "pack/vscode-codeql-a",
    },
    {
      name: "b-java",
      expected: "pack/b-java",
    },
    {
      name: "a/b-csharp",
      expected: "a/b-csharp",
    },
    {
      name: "-/b-csharp",
      expected: "pack/b-csharp",
    },
    {
      name: "a/b/c/d-csharp",
      expected: "a/b-c-d-csharp",
    },
    {
      name: "JAVA/CodeQL-csharp",
      expected: "java/codeql-csharp",
    },
    {
      name: "my new pack-swift",
      expected: "pack/my-new-pack-swift",
    },
    {
      name: "gïthub/vscode-codeql-javascript",
      expected: "gthub/vscode-codeql-javascript",
    },
    {
      name: "a/b-csharp",
      expected: "a/b-csharp",
    },
    {
      name: "-a-/b-ruby",
      expected: "a/b-ruby",
    },
    {
      name: "a/b--d--e-d-csharp",
      expected: "a/b-d-e-d-csharp",
    },
    {
      name: "/github/vscode-codeql",
      expected: "github/vscode-codeql",
    },
    {
      name: "github/vscode-codeql/",
      expected: "github/vscode-codeql",
    },
    {
      name: "///github/vscode-codeql///",
      expected: "github/vscode-codeql",
    },
  ];

  test.each(testCases)(
    "$name with $language = $expected",
    ({ name, expected }) => {
      const result = sanitizePackName(name);
      expect(result).not.toBeUndefined();
      if (!result) {
        return;
      }
      expect(validatePackName(formatPackName(result))).toBeUndefined();
      expect(result).toEqual(parsePackName(expected));
    },
  );
});
