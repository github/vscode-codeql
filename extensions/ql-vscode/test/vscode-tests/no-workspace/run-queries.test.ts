import { join } from "path";
import { readFileSync } from "fs-extra";
import { Uri } from "vscode";

import * as config from "../../../src/config";
import { tmpDir } from "../../../src/tmp-dir";
import type { CodeQLCliServer } from "../../../src/codeql-cli/cli";
import { SELECT_QUERY_NAME } from "../../../src/language-support";
import type { DeepPartial } from "../utils/mocking.helpers";
import { mockDatabaseItem, mockedObject } from "../utils/mocking.helpers";
import type { BqrsKind } from "../../../src/common/bqrs-cli-types";
import type { QueryServerClient } from "../../../src/query-server";
import { QueryRunner } from "../../../src/query-server";
import { QueryEvaluationInfo } from "../../../src/run-queries-shared";
import {
  deregisterDatabases,
  registerDatabases,
} from "../../../src/query-server/messages";

describe("run-queries", () => {
  let isCanarySpy: jest.SpiedFunction<typeof config.isCanary>;

  beforeEach(() => {
    isCanarySpy = jest.spyOn(config, "isCanary").mockReturnValue(false);
  });

  it("should create a QueryEvaluationInfo", () => {
    const saveDir = "query-save-dir";
    const queryEvalInfo = createMockQueryEvaluationInfo(true, saveDir);

    expect(queryEvalInfo.dilPath).toBe(join(saveDir, "results.dil"));
    expect(queryEvalInfo.resultsPaths.resultsPath).toBe(
      join(saveDir, "results.bqrs"),
    );
    expect(queryEvalInfo.resultsPaths.interpretedResultsPath).toBe(
      join(saveDir, "interpretedResults.sarif"),
    );
    expect(queryEvalInfo.dbItemPath).toBe(Uri.file("/abc").fsPath);
  });

  it("should check if interpreted results can be created", async () => {
    const queryEvalInfo = createMockQueryEvaluationInfo(true);

    // "1"
    expect(queryEvalInfo.canHaveInterpretedResults()).toBe(true);

    (queryEvalInfo as any).databaseHasMetadataFile = false;
    // "2"
    expect(queryEvalInfo.canHaveInterpretedResults()).toBe(false);

    (queryEvalInfo as any).databaseHasMetadataFile = true;
    queryEvalInfo.metadata!.kind = undefined;
    // "3"
    expect(queryEvalInfo.canHaveInterpretedResults()).toBe(false);

    queryEvalInfo.metadata!.kind = "table";
    // "4"
    expect(queryEvalInfo.canHaveInterpretedResults()).toBe(false);

    // Graphs are not interpreted unless canary is set
    queryEvalInfo.metadata!.kind = "graph";
    // "5"
    expect(queryEvalInfo.canHaveInterpretedResults()).toBe(false);

    isCanarySpy.mockReturnValueOnce(true);
    // "6"
    expect(queryEvalInfo.canHaveInterpretedResults()).toBe(true);
  });

  [SELECT_QUERY_NAME, "other"].forEach((resultSetName) => {
    it(`should export csv results for result set ${resultSetName}`, async () => {
      const csvLocation = join(tmpDir.name, "test.csv");
      const cliServer = createMockCliServer({
        bqrsInfo: [
          { "result-sets": [{ name: resultSetName }, { name: "hucairz" }] },
        ],
        bqrsDecode: [
          {
            columns: [{ kind: "NotString" as BqrsKind }, { kind: "String" }],
            tuples: [
              ["a", "b"],
              ["c", "d"],
            ],
            next: 1,
          },
          {
            // just for fun, give a different set of columns here
            // this won't happen with the real CLI, but it's a good test
            columns: [
              { kind: "String" },
              { kind: "NotString" as BqrsKind },
              { kind: "StillNotString" as BqrsKind },
            ],
            tuples: [["a", "b", "c"]],
          },
        ],
      });
      const queryEvalInfo = createMockQueryEvaluationInfo();
      const promise = queryEvalInfo.exportCsvResults(cliServer, csvLocation);

      const result = await promise;
      expect(result).toBe(true);

      const csv = readFileSync(csvLocation, "utf8");
      expect(csv).toBe('a,"b"\nc,"d"\n"a",b,c\n');

      // now verify that we are using the expected result set
      expect(cliServer.bqrsDecode).toHaveBeenCalledWith(
        expect.anything(),
        resultSetName,
        expect.anything(),
      );
    });
  });

  it("should export csv results with characters that need to be escaped", async () => {
    const csvLocation = join(tmpDir.name, "test.csv");
    const cliServer = createMockCliServer({
      bqrsInfo: [
        { "result-sets": [{ name: SELECT_QUERY_NAME }, { name: "hucairz" }] },
      ],
      bqrsDecode: [
        {
          columns: [{ kind: "NotString" as BqrsKind }, { kind: "String" }],
          // We only escape string columns. In practice, we will only see quotes in strings, but
          // it is a good test anyway.
          tuples: [
            ['"a"', '"b"'],
            ["c,xxx", "d,yyy"],
            ['aaa " bbb', 'ccc " ddd'],
            [true, false],
            [123, 456],
            [123.98, 456.99],
          ],
        },
      ],
    });
    const queryEvalInfo = createMockQueryEvaluationInfo();
    const promise = queryEvalInfo.exportCsvResults(cliServer, csvLocation);

    const result = await promise;
    expect(result).toBe(true);

    const csv = readFileSync(csvLocation, "utf8");
    expect(csv).toBe(
      '"a","""b"""\nc,xxx,"d,yyy"\naaa " bbb,"ccc "" ddd"\ntrue,"false"\n123,"456"\n123.98,"456.99"\n',
    );

    // now verify that we are using the expected result set
    expect(cliServer.bqrsDecode).toHaveBeenCalledWith(
      expect.anything(),
      SELECT_QUERY_NAME,
      expect.anything(),
    );
  });

  it("should handle csv exports for a query with no result sets", async () => {
    const csvLocation = join(tmpDir.name, "test.csv");
    const cliServer = createMockCliServer({
      bqrsInfo: [{ "result-sets": [] }],
    });
    const queryEvalInfo = createMockQueryEvaluationInfo();
    const result = await queryEvalInfo.exportCsvResults(cliServer, csvLocation);
    expect(result).toBe(false);
  });

  describe("register", () => {
    it("should register", async () => {
      const qs = createMockQueryServerClient();
      const runner = new QueryRunner(qs);
      const databaseUri = Uri.file("database-uri");
      const datasetUri = Uri.file("dataset-uri");

      const dbItem = mockDatabaseItem({
        databaseUri,
        contents: {
          datasetUri,
        },
      });

      await runner.registerDatabase(dbItem);

      expect(qs.sendRequest).toHaveBeenCalledTimes(1);
      expect(qs.sendRequest).toHaveBeenCalledWith(registerDatabases, {
        databases: [databaseUri.fsPath],
      });
    });

    it("should deregister", async () => {
      const qs = createMockQueryServerClient();
      const runner = new QueryRunner(qs);
      const databaseUri = Uri.file("database-uri");
      const datasetUri = Uri.file("dataset-uri");

      const dbItem = mockDatabaseItem({
        databaseUri,
        contents: {
          datasetUri,
        },
      });

      await runner.deregisterDatabase(dbItem);

      expect(qs.sendRequest).toHaveBeenCalledTimes(1);
      expect(qs.sendRequest).toHaveBeenCalledWith(deregisterDatabases, {
        databases: [databaseUri.fsPath],
      });
    });
  });

  let queryNum = 0;
  function createMockQueryEvaluationInfo(
    databaseHasMetadataFile = true,
    saveDir = `save-dir${queryNum++}`,
  ) {
    return new QueryEvaluationInfo(
      saveDir,
      Uri.parse("file:///abc").fsPath,
      databaseHasMetadataFile,
      undefined,
      {
        kind: "problem",
      },
    );
  }

  function createMockQueryServerClient(
    cliServer?: CodeQLCliServer,
  ): QueryServerClient {
    return mockedObject<QueryServerClient>({
      config: {
        timeoutSecs: 5,
      },
      sendRequest: jest.fn().mockResolvedValue({}),
      logger: {
        log: jest.fn(),
      },
      cliServer,
    });
  }

  // A type that represents the mocked methods of a CodeQLCliServer. Exclude any non-methods.
  // This allows passing in an array of return values for a single method.
  type MockedCLIMethods = {
    [K in keyof CodeQLCliServer]: CodeQLCliServer[K] extends (
      ...args: any
    ) => any
      ? Array<DeepPartial<Awaited<ReturnType<CodeQLCliServer[K]>>>>
      : never;
  };

  function createMockCliServer(
    mockOperations: Partial<MockedCLIMethods>,
  ): CodeQLCliServer {
    const mockedMethods: Record<string, jest.Mock> = {};

    for (const [operation, returns] of Object.entries(mockOperations)) {
      const fn = jest.fn();
      returns.forEach((returnValue: any) => {
        fn.mockResolvedValueOnce(returnValue);
      });
      mockedMethods[operation] = fn;
    }

    return mockedObject<CodeQLCliServer>(mockedMethods);
  }
});
