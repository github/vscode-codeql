import { substituteConfigVariables } from "../../../src/common/config-template";

describe("substituteConfigVariables", () => {
  const values = {
    userHome: "/home/your-username",
    workspaceFolder: "/home/your-username/your-project",
    workspaceFolderBasename: "your-project",
    pathSeparator: "/",
    owner: "github",
    name: "vscode-codeql",
    language: "java",
  };

  const testCases = [
    {
      template: ".github/codeql/extensions/${name}-${language}",
      expected: ".github/codeql/extensions/vscode-codeql-java",
    },
    {
      template: "${owner}/${name}-${language}",
      expected: "github/vscode-codeql-java",
    },
    {
      template: "models/${group}.model.yml",
      expected: "models/.model.yml",
    },
    {
      template:
        "${workspaceFolder}${pathSeparator}.github/workflows/codeql-analysis.yml",
      expected:
        "/home/your-username/your-project/.github/workflows/codeql-analysis.yml",
    },
    {
      template:
        "${workspaceFolder/.github/codeql/extensions/${name}-${language}",
      expected: "workspaceFolder/.github/codeql/extensions/vscode-codeql-java",
    },
    {
      template: "}${workspaceFolder}/.github/workflows/codeql-analysis.yml",
      expected:
        "}/home/your-username/your-project/.github/workflows/codeql-analysis.yml",
    },
    {
      template: "Foo Bar",
      expected: "Foo Bar",
    },
    {
      template: "Foo${}Bar",
      expected: "FooBar",
    },
    {
      template: "$FooBar",
      expected: "",
    },
    {
      template: "}FooBar",
      expected: "}FooBar",
    },
    {
      template: "Foo ${name} Bar",
      expected: "Foo vscode-codeql Bar",
    },
    {
      template: "Foo ${name} Bar ${owner}",
      expected: "Foo vscode-codeql Bar github",
    },
    {
      template: "Foo ${nmae} Bar ${owner}",
      expected: "Foo  Bar github",
    },
  ];

  test.each(testCases)(
    "result of $template is $expected",
    ({ template, expected }) => {
      expect(substituteConfigVariables(template, values)).toEqual(expected);
    },
  );
});
