import {
  readQueryResults,
  runModelEditorQueries,
} from "../../../../src/model-editor/model-editor-queries";
import { createMockLogger } from "../../../__mocks__/loggerMock";
import type { DatabaseItem } from "../../../../src/databases/local-databases";
import { DatabaseKind } from "../../../../src/databases/local-databases";
import { dirSync, file } from "tmp-promise";
import { QueryResultType } from "../../../../src/query-server/messages";
import * as log from "../../../../src/common/logging/notifications";
import { RedactableError } from "../../../../src/common/errors";
import type { showAndLogExceptionWithTelemetry } from "../../../../src/common/logging";
import { mockedObject, mockedUri } from "../../utils/mocking.helpers";
import { Mode } from "../../../../src/model-editor/shared/mode";
import { join } from "path";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import type { QueryRunner } from "../../../../src/query-server";
import { QueryOutputDir } from "../../../../src/local-queries/query-output-dir";
import { SUPPORTED_LANGUAGES } from "../../../../src/model-editor/supported-languages";

describe("runModelEditorQueries", () => {
  const language =
    SUPPORTED_LANGUAGES[Math.floor(Math.random() * SUPPORTED_LANGUAGES.length)];

  const queryDir = dirSync({ unsafeCleanup: true }).name;

  it("should log an error", async () => {
    const showAndLogExceptionWithTelemetrySpy: jest.SpiedFunction<
      typeof showAndLogExceptionWithTelemetry
    > = jest.spyOn(log, "showAndLogExceptionWithTelemetry");

    const outputDir = new QueryOutputDir(join((await file()).path, "1"));

    const options = {
      cliServer: mockedObject<CodeQLCliServer>({
        resolveQlpacks: jest.fn().mockResolvedValue({
          "my/extensions": "/a/b/c/",
        }),
        resolveQueriesInSuite: jest
          .fn()
          .mockResolvedValue(["/a/b/c/ApplicationModeEndpoints.ql"]),
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
      logger: createMockLogger(),
      databaseItem: mockedObject<DatabaseItem>({
        databaseUri: mockedUri("/a/b/c/src.zip"),
        contents: {
          kind: DatabaseKind.Database,
          name: "foo",
          datasetUri: mockedUri(),
        },
        language,
      }),
      language,
      queryStorageDir: "/tmp/queries",
      queryDir,
      progress: jest.fn(),
      token: {
        isCancellationRequested: false,
        onCancellationRequested: jest.fn(),
      },
    };

    expect(
      await runModelEditorQueries(Mode.Application, options),
    ).toBeUndefined();
    expect(showAndLogExceptionWithTelemetrySpy).toHaveBeenCalledWith(
      expect.anything(),
      undefined,
      expect.any(RedactableError),
    );
  });

  it("should run query for random language", async () => {
    const outputDir = new QueryOutputDir(join((await file()).path, "1"));

    const options = {
      cliServer: mockedObject<CodeQLCliServer>({
        resolveQlpacks: jest.fn().mockResolvedValue({
          "my/extensions": "/a/b/c/",
        }),
        resolveQueriesInSuite: jest
          .fn()
          .mockResolvedValue(["/a/b/c/ApplicationModeEndpoints.ql"]),
        packPacklist: jest
          .fn()
          .mockResolvedValue([
            "/a/b/c/qlpack.yml",
            "/a/b/c/qlpack.lock.yml",
            "/a/b/c/qlpack2.yml",
          ]),
        bqrsInfo: jest.fn().mockResolvedValue({
          "result-sets": [
            {
              name: "results",
              rows: 45,
              columns: [],
            },
          ],
        }),
        bqrsDecode: jest.fn().mockResolvedValue({
          tuples: [],
          columns: [],
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
      logger: createMockLogger(),
      databaseItem: mockedObject<DatabaseItem>({
        databaseUri: mockedUri("/a/b/c/src.zip"),
        contents: {
          kind: DatabaseKind.Database,
          name: "foo",
          datasetUri: mockedUri(),
        },
        language,
      }),
      language,
      queryStorageDir: "/tmp/queries",
      queryDir,
      progress: jest.fn(),
      token: {
        isCancellationRequested: false,
        onCancellationRequested: jest.fn(),
      },
    };

    const result = await runModelEditorQueries(Mode.Framework, options);

    expect(result).not.toBeUndefined();

    expect(options.cliServer.resolveQlpacks).toHaveBeenCalledTimes(1);
    expect(options.cliServer.resolveQlpacks).toHaveBeenCalledWith([], true);
    expect(options.queryRunner.createQueryRun).toHaveBeenCalledWith(
      "/a/b/c/src.zip",
      {
        queryPath: expect.stringMatching(/\S*ModeEndpoints\.ql/),
        quickEvalPosition: undefined,
        quickEvalCountOnly: false,
      },
      false,
      [],
      ["my/extensions"],
      {},
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
    logger: createMockLogger(),
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
