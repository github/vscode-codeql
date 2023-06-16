import { basename, extname } from "../../../src/common/path";

describe("basename", () => {
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

describe("extname", () => {
  const testCases = [
    { path: "test.ql", expected: ".ql" },
    { path: "PLACEHOLDER/q0.ql", expected: ".ql" },
    {
      path: "/etc/hosts/",
      expected: "",
    },
    {
      path: "/etc/hosts",
      expected: "",
    },
  ];

  test.each(testCases)(
    "extname of $path is $expected",
    ({ path, expected }) => {
      expect(extname(path)).toEqual(expected);
    },
  );
});
