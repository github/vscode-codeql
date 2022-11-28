import { basename } from "../path";

describe(basename.name, () => {
  const testCases = [
    { path: "test.ql", expected: "test.ql" },
    { path: "PLACEHOLDER/q0.ql", expected: "q0.ql" },
    {
      path: "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript/example.ql",
      expected: "example.ql",
    },
    {
      path: "C:\\Users\\github\\projects\\vscode-codeql-starter\\codeql-custom-queries-javascript\\example.ql",
      expected: "example.ql",
    },
    {
      path: "/home/github/projects/vscode-codeql-starter/codeql-custom-queries-javascript//",
      expected: "codeql-custom-queries-javascript",
    },
    {
      path: "C:\\Users\\github\\projects\\vscode-codeql-starter\\codeql-custom-queries-javascript\\",
      expected: "codeql-custom-queries-javascript",
    },
    {
      path: "/etc/hosts",
      expected: "hosts",
    },
    {
      path: "/etc/hosts/",
      expected: "hosts",
    },
    {
      path: "/etc/hosts\\test",
      expected: "hosts\\test",
    },
  ];

  test.each(testCases)(
    "basename of $path is $expected",
    ({ path, expected }) => {
      expect(basename(path)).toEqual(expected);
    },
  );
});
