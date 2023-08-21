import { createMockLogger } from "../../../__mocks__/loggerMock";
import {
  DatabaseItem,
  DatabaseKind,
} from "../../../../src/databases/local-databases";
import { dirSync, file } from "tmp-promise";
import { QueryResultType } from "../../../../src/query-server/new-messages";
import { fetchExternalApiQueries } from "../../../../src/data-extensions-editor/queries";
import * as log from "../../../../src/common/logging/notifications";
import { RedactableError } from "../../../../src/common/errors";
import { showAndLogExceptionWithTelemetry } from "../../../../src/common/logging";
import { QueryLanguage } from "../../../../src/common/query-language";
import { mockedObject, mockedUri } from "../../utils/mocking.helpers";
import { Mode } from "../../../../src/data-extensions-editor/shared/mode";
import { readFile, readFileSync, readdir } from "fs-extra";
import { join } from "path";
import { load } from "js-yaml";
import { setUpPack } from "../../../../src/data-extensions-editor/data-extensions-editor-queries";
import {
  readQueryResults,
  runExternalApiQueries,
} from "../../../../src/data-extensions-editor/external-api-usage-query";
import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { QueryRunner } from "../../../../src/query-server";
import { QueryOutputDir } from "../../../../src/run-queries-shared";

describe("external api usage query", () => {
  describe("setUpPack", () => {
    const languages = Object.keys(fetchExternalApiQueries).flatMap((lang) => {
      const queryDir = dirSync({ unsafeCleanup: true }).name;
      const query = fetchExternalApiQueries[lang as QueryLanguage];
      if (!query) {
        return [];
      }

      return { language: lang as QueryLanguage, queryDir, query };
    });

    test.each(languages)(
      "should create files for $language",
      async ({ language, queryDir, query }) => {
        await setUpPack(queryDir, language);

        const queryFiles = await readdir(queryDir);
        expect(queryFiles.sort()).toEqual(
          [
            "codeql-pack.yml",
            "FetchExternalApisApplicationMode.ql",
            "FetchExternalApisFrameworkMode.ql",
            "AutomodelVsCode.qll",
          ].sort(),
        );

        const suiteFileContents = await readFile(
          join(queryDir, "codeql-pack.yml"),
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

        Object.values(Mode).forEach((mode) => {
          expect(
            readFileSync(
              join(
                queryDir,
                `FetchExternalApis${
                  mode.charAt(0).toUpperCase() + mode.slice(1)
                }Mode.ql`,
              ),
              "utf8",
            ),
          ).toEqual(query[`${mode}ModeQuery`]);
        });

        for (const [filename, contents] of Object.entries(
          query.dependencies ?? {},
        )) {
          expect(await readFile(join(queryDir, filename), "utf8")).toEqual(
            contents,
          );
        }
      },
    );
  });

  describe("runQuery", () => {
    const language = Object.keys(fetchExternalApiQueries)[
      Math.floor(Math.random() * Object.keys(fetchExternalApiQueries).length)
    ] as QueryLanguage;

    const queryDir = dirSync({ unsafeCleanup: true }).name;

    it("should log an error", async () => {
      const showAndLogExceptionWithTelemetrySpy: jest.SpiedFunction<
        typeof showAndLogExceptionWithTelemetry
      > = jest.spyOn(log, "showAndLogExceptionWithTelemetry");

      const outputDir = new QueryOutputDir(join((await file()).path, "1"));

      const query = fetchExternalApiQueries[language];
      if (!query) {
        throw new Error(`No query found for language ${language}`);
      }

      const options = {
        cliServer: mockedObject<CodeQLCliServer>({
          resolveQlpacks: jest.fn().mockResolvedValue({
            "my/extensions": "/a/b/c/",
          }),
          packPacklist: jest
            .fn()
            .mockResolvedValue([
              "/a/b/c/qlpack.yml",
              "/a/b/c/qlpack.lock.yml",
              "/a/b/c/qlpack2.yml",
            ]),
        }),
        queryRunner: mockedObject<QueryRunner>({
          createQueryRun: jest.fn().mockReturnValue({
            evaluate: jest.fn().mockResolvedValue({
              resultType: QueryResultType.CANCELLATION,
            }),
            outputDir,
          }),
          logger: createMockLogger(),
        }),
        databaseItem: mockedObject<DatabaseItem>({
          databaseUri: mockedUri("/a/b/c/src.zip"),
          contents: {
            kind: DatabaseKind.Database,
            name: "foo",
            datasetUri: mockedUri(),
          },
          language,
        }),
        queryStorageDir: "/tmp/queries",
        queryDir,
        progress: jest.fn(),
        token: {
          isCancellationRequested: false,
          onCancellationRequested: jest.fn(),
        },
      };

      expect(
        await runExternalApiQueries(Mode.Application, options),
      ).toBeUndefined();
      expect(showAndLogExceptionWithTelemetrySpy).toHaveBeenCalledWith(
        expect.anything(),
        undefined,
        expect.any(RedactableError),
      );
    });

    it("should run query for random language", async () => {
      const outputDir = new QueryOutputDir(join((await file()).path, "1"));

      const query = fetchExternalApiQueries[language];
      if (!query) {
        throw new Error(`No query found for language ${language}`);
      }

      const options = {
        cliServer: mockedObject<CodeQLCliServer>({
          resolveQlpacks: jest.fn().mockResolvedValue({
            "my/extensions": "/a/b/c/",
          }),
          packPacklist: jest
            .fn()
            .mockResolvedValue([
              "/a/b/c/qlpack.yml",
              "/a/b/c/qlpack.lock.yml",
              "/a/b/c/qlpack2.yml",
            ]),
          bqrsInfo: jest.fn().mockResolvedValue({
            "result-sets": [],
          }),
        }),
        queryRunner: mockedObject<QueryRunner>({
          createQueryRun: jest.fn().mockReturnValue({
            evaluate: jest.fn().mockResolvedValue({
              resultType: QueryResultType.SUCCESS,
              outputDir,
            }),
            outputDir,
          }),
          logger: createMockLogger(),
        }),
        databaseItem: mockedObject<DatabaseItem>({
          databaseUri: mockedUri("/a/b/c/src.zip"),
          contents: {
            kind: DatabaseKind.Database,
            name: "foo",
            datasetUri: mockedUri(),
          },
          language,
        }),
        queryStorageDir: "/tmp/queries",
        queryDir,
        progress: jest.fn(),
        token: {
          isCancellationRequested: false,
          onCancellationRequested: jest.fn(),
        },
      };

      const result = await runExternalApiQueries(Mode.Framework, options);

      expect(result).not.toBeUndefined;

      expect(options.cliServer.resolveQlpacks).toHaveBeenCalledTimes(1);
      expect(options.cliServer.resolveQlpacks).toHaveBeenCalledWith([], true);
      expect(options.queryRunner.createQueryRun).toHaveBeenCalledWith(
        "/a/b/c/src.zip",
        {
          queryPath: expect.stringMatching(/FetchExternalApis\S*\.ql/),
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
    });
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
});
