import {
  readQueryResults,
  runQuery,
} from "../../../../src/data-extensions-editor/external-api-usage-query";
import { createMockLogger } from "../../../__mocks__/loggerMock";
import type { Uri } from "vscode";
import { DatabaseKind } from "../../../../src/databases/local-databases";
import { file } from "tmp-promise";
import { QueryResultType } from "../../../../src/query-server/new-messages";
import { readdir, readFile } from "fs-extra";
import { load } from "js-yaml";
import { dirname, join } from "path";
import { fetchExternalApiQueries } from "../../../../src/data-extensions-editor/queries";
import * as log from "../../../../src/common/logging/notifications";
import { RedactableError } from "../../../../src/common/errors";
import { showAndLogExceptionWithTelemetry } from "../../../../src/common/logging";
import { QueryLanguage } from "../../../../src/common/query-language";
import { Query } from "../../../../src/data-extensions-editor/queries/query";

function createMockUri(path = "/a/b/c/foo"): Uri {
  return {
    scheme: "file",
    authority: "",
    path,
    query: "",
    fragment: "",
    fsPath: path,
    with: jest.fn(),
    toJSON: jest.fn(),
  };
}

describe("runQuery", () => {
  const cases = Object.keys(fetchExternalApiQueries).flatMap((lang) => {
    const query = fetchExternalApiQueries[lang as QueryLanguage];
    if (!query) {
      return [];
    }

    const keys = new Set(Object.keys(query));
    keys.delete("dependencies");

    return Array.from(keys).map((name) => ({
      language: lang as QueryLanguage,
      queryName: name as keyof Omit<Query, "dependencies">,
    }));
  });

  test.each(cases)(
    "should run $queryName for $language",
    async ({ language, queryName }) => {
      const logPath = (await file()).path;

      const query = fetchExternalApiQueries[language];
      if (!query) {
        throw new Error(`No query found for language ${language}`);
      }

      const options = {
        cliServer: {
          resolveQlpacks: jest.fn().mockResolvedValue({
            "my/extensions": "/a/b/c/",
          }),
        },
        queryRunner: {
          createQueryRun: jest.fn().mockReturnValue({
            evaluate: jest.fn().mockResolvedValue({
              resultType: QueryResultType.SUCCESS,
            }),
            outputDir: {
              logPath,
            },
          }),
          logger: createMockLogger(),
        },
        databaseItem: {
          databaseUri: createMockUri("/a/b/c/src.zip"),
          contents: {
            kind: DatabaseKind.Database,
            name: "foo",
            datasetUri: createMockUri(),
          },
          language,
        },
        queryStorageDir: "/tmp/queries",
        progress: jest.fn(),
        token: {
          isCancellationRequested: false,
          onCancellationRequested: jest.fn(),
        },
      };

      const result = await runQuery(queryName, options);

      expect(result?.resultType).toEqual(QueryResultType.SUCCESS);

      expect(options.cliServer.resolveQlpacks).toHaveBeenCalledTimes(1);
      expect(options.cliServer.resolveQlpacks).toHaveBeenCalledWith([], true);
      expect(options.queryRunner.createQueryRun).toHaveBeenCalledWith(
        "/a/b/c/src.zip",
        {
          queryPath: expect.stringMatching(/FetchExternalApis\.ql/),
          quickEvalPosition: undefined,
          quickEvalCountOnly: false,
        },
        false,
        [],
        ["my/extensions"],
        "/tmp/queries",
        undefined,
        undefined,
      );

      const queryPath =
        options.queryRunner.createQueryRun.mock.calls[0][1].queryPath;
      const queryDirectory = dirname(queryPath);

      const queryFiles = await readdir(queryDirectory);
      expect(queryFiles.sort()).toEqual(
        ["codeql-pack.yml", "FetchExternalApis.ql", "ExternalApi.qll"].sort(),
      );

      const suiteFileContents = await readFile(
        join(queryDirectory, "codeql-pack.yml"),
        "utf8",
      );
      const suiteYaml = load(suiteFileContents);
      expect(suiteYaml).toEqual({
        name: "codeql/external-api-usage",
        version: "0.0.0",
        dependencies: {
          [`codeql/${language}-all`]: "*",
        },
      });

      expect(
        await readFile(join(queryDirectory, "FetchExternalApis.ql"), "utf8"),
      ).toEqual(query[queryName]);

      for (const [filename, contents] of Object.entries(
        query.dependencies ?? {},
      )) {
        expect(await readFile(join(queryDirectory, filename), "utf8")).toEqual(
          contents,
        );
      }
    },
  );
});

describe("readQueryResults", () => {
  const options = {
    cliServer: {
      bqrsInfo: jest.fn(),
      bqrsDecode: jest.fn(),
    },
    bqrsPath: "/tmp/results.bqrs",
  };

  let showAndLogExceptionWithTelemetrySpy: jest.SpiedFunction<
    typeof showAndLogExceptionWithTelemetry
  >;

  beforeEach(() => {
    showAndLogExceptionWithTelemetrySpy = jest.spyOn(
      log,
      "showAndLogExceptionWithTelemetry",
    );
  });

  it("returns undefined when there are no results", async () => {
    options.cliServer.bqrsInfo.mockResolvedValue({
      "result-sets": [],
    });

    expect(await readQueryResults(options)).toBeUndefined();
    expect(showAndLogExceptionWithTelemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      expect.any(RedactableError),
    );
  });

  it("returns undefined when there are multiple result sets", async () => {
    options.cliServer.bqrsInfo.mockResolvedValue({
      "result-sets": [
        {
          name: "#select",
          rows: 10,
          columns: [
            { name: "usage", kind: "e" },
            { name: "apiName", kind: "s" },
            { kind: "s" },
            { kind: "s" },
          ],
        },
        {
          name: "#select2",
          rows: 10,
          columns: [
            { name: "usage", kind: "e" },
            { name: "apiName", kind: "s" },
            { kind: "s" },
            { kind: "s" },
          ],
        },
      ],
    });

    expect(await readQueryResults(options)).toBeUndefined();
    expect(showAndLogExceptionWithTelemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      expect.any(RedactableError),
    );
  });

  it("gets the result set", async () => {
    options.cliServer.bqrsInfo.mockResolvedValue({
      "result-sets": [
        {
          name: "#select",
          rows: 10,
          columns: [
            { name: "usage", kind: "e" },
            { name: "apiName", kind: "s" },
            { kind: "s" },
            { kind: "s" },
          ],
        },
      ],
      "compatible-query-kinds": ["Table", "Tree", "Graph"],
    });
    const decodedResultSet = {
      columns: [
        { name: "usage", kind: "e" },
        { name: "apiName", kind: "s" },
        { kind: "s" },
        { kind: "s" },
      ],
      tuples: [
        [
          "java.io.PrintStream#println(String)",
          true,
          {
            label: "println(...)",
            url: {
              uri: "file:/home/runner/work/sql2o-example/sql2o-example/src/main/java/org/example/HelloController.java",
              startLine: 29,
              startColumn: 9,
              endLine: 29,
              endColumn: 49,
            },
          },
        ],
      ],
    };
    options.cliServer.bqrsDecode.mockResolvedValue(decodedResultSet);

    const result = await readQueryResults(options);
    expect(result).toEqual(decodedResultSet);
    expect(options.cliServer.bqrsInfo).toHaveBeenCalledWith(options.bqrsPath);
    expect(options.cliServer.bqrsDecode).toHaveBeenCalledWith(
      options.bqrsPath,
      "#select",
    );
  });
});
