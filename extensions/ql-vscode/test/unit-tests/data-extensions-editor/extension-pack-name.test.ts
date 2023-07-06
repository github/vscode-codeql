import {
  autoNameExtensionPack,
  formatPackName,
  parsePackName,
  validatePackName,
} from "../../../src/data-extensions-editor/extension-pack-name";

describe("autoNameExtensionPack", () => {
  const testCases: Array<{
    name: string;
    language: string;
    expected: string;
  }> = [
    {
      name: "github/vscode-codeql",
      language: "javascript",
      expected: "github/vscode-codeql-javascript",
    },
    {
      name: "vscode-codeql",
      language: "a",
      expected: "pack/vscode-codeql-a",
    },
    {
      name: "b",
      language: "java",
      expected: "pack/b-java",
    },
    {
      name: "a/b",
      language: "csharp",
      expected: "a/b-csharp",
    },
    {
      name: "-/b",
      language: "csharp",
      expected: "pack/b-csharp",
    },
    {
      name: "a/b/c/d",
      language: "csharp",
      expected: "a/b-c-d-csharp",
    },
    {
      name: "JAVA/CodeQL",
      language: "csharp",
      expected: "java/codeql-csharp",
    },
    {
      name: "my new pack",
      language: "swift",
      expected: "pack/my-new-pack-swift",
    },
    {
      name: "gïthub/vscode-codeql",
      language: "javascript",
      expected: "gthub/vscode-codeql-javascript",
    },
    {
      name: "a/b-",
      language: "csharp",
      expected: "a/b-csharp",
    },
    {
      name: "-a-/b",
      language: "ruby",
      expected: "a/b-ruby",
    },
    {
      name: "a/b--d--e-d-",
      language: "csharp",
      expected: "a/b-d-e-d-csharp",
    },
  ];

  test.each(testCases)(
    "$name with $language = $expected",
    ({ name, language, expected }) => {
      const result = autoNameExtensionPack(name, language);
      expect(result).not.toBeUndefined();
      if (!result) {
        return;
      }
      expect(validatePackName(formatPackName(result))).toBeUndefined();
      expect(result).toEqual(parsePackName(expected));
    },
  );
});
