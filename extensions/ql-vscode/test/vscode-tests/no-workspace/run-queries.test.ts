import { join } from "path";
import { readFileSync } from "fs-extra";
import { Uri } from "vscode";

import {
  Severity,
  compileQuery,
  registerDatabases,
  deregisterDatabases,
} from "../../../src/pure/legacy-messages";
import * as config from "../../../src/config";
import { tmpDir } from "../../../src/helpers";
import { QueryServerClient } from "../../../src/legacy-query-server/queryserver-client";
import { CodeQLCliServer } from "../../../src/cli";
import { SELECT_QUERY_NAME } from "../../../src/contextual/locationFinder";
import { QueryInProgress } from "../../../src/legacy-query-server/run-queries";
import { LegacyQueryRunner } from "../../../src/legacy-query-server/legacyRunner";
import { DatabaseItem } from "../../../src/local-databases";

describe("run-queries", () => {
  let isCanarySpy: jest.SpiedFunction<typeof config.isCanary>;

  beforeEach(() => {
    isCanarySpy = jest.spyOn(config, "isCanary").mockReturnValue(false);
  });

  it("should create a QueryEvaluationInfo", () => {
    const saveDir = "query-save-dir";
    const info = createMockQueryInfo(true, saveDir);

    expect(info.compiledQueryPath).toBe(join(saveDir, "compiledQuery.qlo"));
    expect(info.queryEvalInfo.dilPath).toBe(join(saveDir, "results.dil"));
    expect(info.queryEvalInfo.resultsPaths.resultsPath).toBe(
      join(saveDir, "results.bqrs"),
    );
    expect(info.queryEvalInfo.resultsPaths.interpretedResultsPath).toBe(
      join(saveDir, "interpretedResults.sarif"),
    );
    expect(info.dbItemPath).toBe(Uri.file("/abc").fsPath);
  });

  it("should check if interpreted results can be created", async () => {
    const info = createMockQueryInfo(true);

    // "1"
    expect(info.queryEvalInfo.canHaveInterpretedResults()).toBe(true);

    (info.queryEvalInfo as any).databaseHasMetadataFile = false;
    // "2"
    expect(info.queryEvalInfo.canHaveInterpretedResults()).toBe(false);

    (info.queryEvalInfo as any).databaseHasMetadataFile = true;
    info.metadata!.kind = undefined;
    // "3"
    expect(info.queryEvalInfo.canHaveInterpretedResults()).toBe(false);

    info.metadata!.kind = "table";
    // "4"
    expect(info.queryEvalInfo.canHaveInterpretedResults()).toBe(false);

    // Graphs are not interpreted unless canary is set
    info.metadata!.kind = "graph";
    // "5"
    expect(info.queryEvalInfo.canHaveInterpretedResults()).toBe(false);

    isCanarySpy.mockReturnValueOnce(true);
    // "6"
    expect(info.queryEvalInfo.canHaveInterpretedResults()).toBe(true);
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
            columns: [{ kind: "NotString" }, { kind: "String" }],
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
              { kind: "NotString" },
              { kind: "StillNotString" },
            ],
            tuples: [["a", "b", "c"]],
          },
        ],
      });
      const info = createMockQueryInfo();
      const promise = info.queryEvalInfo.exportCsvResults(
        cliServer,
        csvLocation,
      );

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
          columns: [{ kind: "NotString" }, { kind: "String" }],
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
    const info = createMockQueryInfo();
    const promise = info.queryEvalInfo.exportCsvResults(cliServer, csvLocation);

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
    const info = createMockQueryInfo();
    const result = await info.queryEvalInfo.exportCsvResults(
      cliServer,
      csvLocation,
    );
    expect(result).toBe(false);
  });

  describe("compile", () => {
    it("should compile", async () => {
      const info = createMockQueryInfo();
      const qs = createMockQueryServerClient();
      const mockProgress = "progress-monitor";
      const mockCancel = "cancel-token";
      const mockQlProgram = {
        dbschemePath: "",
        libraryPath: [],
        queryPath: "",
      };

      const results = await info.compile(
        qs as any,
        mockQlProgram,
        mockProgress as any,
        mockCancel as any,
      );

      expect(results).toEqual([{ message: "err", severity: Severity.ERROR }]);

      expect(qs.sendRequest).toHaveBeenCalledTimes(1);
      expect(qs.sendRequest).toHaveBeenCalledWith(
        compileQuery,
        {
          compilationOptions: {
            computeNoLocationUrls: true,
            failOnWarnings: false,
            fastCompilation: false,
            includeDilInQlo: true,
            localChecking: false,
            noComputeGetUrl: false,
            noComputeToString: false,
            computeDefaultStrings: true,
            emitDebugInfo: true,
          },
          extraOptions: {
            timeoutSecs: 5,
          },
          queryToCheck: mockQlProgram,
          resultPath: info.compiledQueryPath,
          target: { query: {} },
        },
        mockCancel,
        mockProgress,
      );
    });
  });

  describe("register", () => {
    it("should register", async () => {
      const qs = createMockQueryServerClient();
      const runner = new LegacyQueryRunner(qs);
      const mockProgress = "progress-monitor";
      const mockCancel = "cancel-token";
      const datasetUri = Uri.file("dataset-uri");

      const dbItem: DatabaseItem = {
        contents: {
          datasetUri,
        },
      } as any;

      await runner.registerDatabase(
        mockProgress as any,
        mockCancel as any,
        dbItem,
      );

      expect(qs.sendRequest).toHaveBeenCalledTimes(1);
      expect(qs.sendRequest).toHaveBeenCalledWith(
        registerDatabases,
        {
          databases: [
            {
              dbDir: datasetUri.fsPath,
              workingSet: "default",
            },
          ],
        },
        mockCancel,
        mockProgress,
      );
    });

    it("should deregister", async () => {
      const qs = createMockQueryServerClient();
      const runner = new LegacyQueryRunner(qs);
      const mockProgress = "progress-monitor";
      const mockCancel = "cancel-token";
      const datasetUri = Uri.file("dataset-uri");

      const dbItem: DatabaseItem = {
        contents: {
          datasetUri,
        },
      } as any;

      await runner.deregisterDatabase(
        mockProgress as any,
        mockCancel as any,
        dbItem,
      );

      expect(qs.sendRequest).toHaveBeenCalledTimes(1);
      expect(qs.sendRequest).toHaveBeenCalledWith(
        deregisterDatabases,
        {
          databases: [
            {
              dbDir: datasetUri.fsPath,
              workingSet: "default",
            },
          ],
        },
        mockCancel,
        mockProgress,
      );
    });
  });

  let queryNum = 0;
  function createMockQueryInfo(
    databaseHasMetadataFile = true,
    saveDir = `save-dir${queryNum++}`,
  ) {
    return new QueryInProgress(
      saveDir,
      Uri.parse("file:///abc").fsPath,
      databaseHasMetadataFile,
      "my-scheme", // queryDbscheme,
      undefined,
      {
        kind: "problem",
      },
    );
  }

  function createMockQueryServerClient(
    cliServer?: CodeQLCliServer,
  ): QueryServerClient {
    return {
      config: {
        timeoutSecs: 5,
      },
      sendRequest: jest.fn().mockResolvedValue({
        messages: [
          { message: "err", severity: Severity.ERROR },
          { message: "warn", severity: Severity.WARNING },
        ],
      }),
      logger: {
        log: jest.fn(),
      },
      cliServer,
    } as unknown as QueryServerClient;
  }

  function createMockCliServer(
    mockOperations: Record<string, any[]>,
  ): CodeQLCliServer {
    const mockServer: Record<string, any> = {};
    for (const [operation, returns] of Object.entries(mockOperations)) {
      mockServer[operation] = jest.fn();
      returns.forEach((returnValue) => {
        mockServer[operation].mockResolvedValueOnce(returnValue);
      });
    }

    return mockServer as unknown as CodeQLCliServer;
  }
});
