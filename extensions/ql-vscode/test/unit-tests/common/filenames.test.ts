import { createFilenameFromString } from "../../../src/common/filenames";

describe("createFilenameFromString", () => {
  const testCases: Array<{
    input: string;
    filename: string;
    filenameWithoutDots?: string;
  }> = [
    {
      input: "sql2o",
      filename: "sql2o",
    },
    {
      input: "spring-boot",
      filename: "spring-boot",
    },
    {
      input: "spring--boot",
      filename: "spring-boot",
    },
    {
      input: "rt",
      filename: "rt",
    },
    {
      input: "System.Runtime",
      filename: "system.runtime",
      filenameWithoutDots: "system-runtime",
    },
    {
      input: "System..Runtime",
      filename: "system.runtime",
      filenameWithoutDots: "system-runtime",
    },
    {
      input: "google/brotli",
      filename: "google-brotli",
    },
    {
      input: "github/vscode-codeql",
      filename: "github-vscode-codeql",
    },
    {
      input: "github/vscode---codeql--",
      filename: "github-vscode-codeql",
    },
    {
      input: "github...vscode--c..odeql",
      filename: "github.vscode-c.odeql",
      filenameWithoutDots: "github-vscode-c-odeql",
    },
    {
      input: "github\\vscode-codeql",
      filename: "github-vscode-codeql",
    },
    {
      input: "uNetworking/uWebSockets.js",
      filename: "unetworking-uwebsockets.js",
      filenameWithoutDots: "unetworking-uwebsockets-js",
    },
    {
      input: "github/.vscode-codeql",
      filename: "github-.vscode-codeql",
      filenameWithoutDots: "github-vscode-codeql",
    },
  ];

  test.each(testCases)(
    "returns $filename if string is $input",
    ({ input, filename }) => {
      expect(createFilenameFromString(input)).toEqual(filename);
    },
  );

  test.each(testCases)(
    "returns $filename if string is $input and dots are not allowed",
    ({ input, filename, filenameWithoutDots }) => {
      expect(
        createFilenameFromString(input, {
          removeDots: true,
        }),
      ).toEqual(filenameWithoutDots ?? filename);
    },
  );
});
