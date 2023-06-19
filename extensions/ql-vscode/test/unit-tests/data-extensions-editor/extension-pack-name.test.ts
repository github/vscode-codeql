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
