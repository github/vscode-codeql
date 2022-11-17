import { expect } from "chai";
import * as path from "path";
import * as fs from "fs-extra";
import * as sinon from "sinon";
import { Uri } from "vscode";

import {
  Severity,
  compileQuery,
  registerDatabases,
  deregisterDatabases,
} from "../../pure/legacy-messages";
import * as config from "../../config";
import { tmpDir } from "../../helpers";
import { QueryServerClient } from "../../legacy-query-server/queryserver-client";
import { CodeQLCliServer } from "../../cli";
import { SELECT_QUERY_NAME } from "../../contextual/locationFinder";
import { QueryInProgress } from "../../legacy-query-server/run-queries";
import { LegacyQueryRunner } from "../../legacy-query-server/legacyRunner";
import { DatabaseItem } from "../../databases";

describe("run-queries", () => {
  let sandbox: sinon.SinonSandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();

    sandbox.stub(config, "isCanary").returns(false);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("should create a QueryEvaluationInfo", () => {
    const saveDir = "query-save-dir";
    const info = createMockQueryInfo(true, saveDir);

    expect(info.compiledQueryPath).to.eq(
      path.join(saveDir, "compiledQuery.qlo"),
    );
    expect(info.queryEvalInfo.dilPath).to.eq(path.join(saveDir, "results.dil"));
    expect(info.queryEvalInfo.resultsPaths.resultsPath).to.eq(
      path.join(saveDir, "results.bqrs"),
    );
    expect(info.queryEvalInfo.resultsPaths.interpretedResultsPath).to.eq(
      path.join(saveDir, "interpretedResults.sarif"),
    );
    expect(info.dbItemPath).to.eq(Uri.file("/abc").fsPath);
  });

  it("should check if interpreted results can be created", async () => {
    const info = createMockQueryInfo(true);

    expect(info.queryEvalInfo.canHaveInterpretedResults(), "1").to.eq(true);

    (info.queryEvalInfo as any).databaseHasMetadataFile = false;
    expect(info.queryEvalInfo.canHaveInterpretedResults(), "2").to.eq(false);

    (info.queryEvalInfo as any).databaseHasMetadataFile = true;
    info.metadata!.kind = undefined;
    expect(info.queryEvalInfo.canHaveInterpretedResults(), "3").to.eq(false);

    info.metadata!.kind = "table";
    expect(info.queryEvalInfo.canHaveInterpretedResults(), "4").to.eq(false);

    // Graphs are not interpreted unless canary is set
    info.metadata!.kind = "graph";
    expect(info.queryEvalInfo.canHaveInterpretedResults(), "5").to.eq(false);

    (config.isCanary as sinon.SinonStub).returns(true);
    expect(info.queryEvalInfo.canHaveInterpretedResults(), "6").to.eq(true);
  });

  [SELECT_QUERY_NAME, "other"].forEach((resultSetName) => {
    it(`should export csv results for result set ${resultSetName}`, async () => {
      const csvLocation = path.join(tmpDir.name, "test.csv");
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
      expect(result).to.eq(true);

      const csv = fs.readFileSync(csvLocation, "utf8");
      expect(csv).to.eq('a,"b"\nc,"d"\n"a",b,c\n');

      // now verify that we are using the expected result set
      expect((cliServer.bqrsDecode as sinon.SinonStub).callCount).to.eq(2);
      expect(
        (cliServer.bqrsDecode as sinon.SinonStub).getCall(0).args[1],
      ).to.eq(resultSetName);
    });
  });

  it("should export csv results with characters that need to be escaped", async () => {
    const csvLocation = path.join(tmpDir.name, "test.csv");
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
    expect(result).to.eq(true);

    const csv = fs.readFileSync(csvLocation, "utf8");
    expect(csv).to.eq(
      '"a","""b"""\nc,xxx,"d,yyy"\naaa " bbb,"ccc "" ddd"\ntrue,"false"\n123,"456"\n123.98,"456.99"\n',
    );

    // now verify that we are using the expected result set
    expect((cliServer.bqrsDecode as sinon.SinonStub).callCount).to.eq(1);
    expect((cliServer.bqrsDecode as sinon.SinonStub).getCall(0).args[1]).to.eq(
      SELECT_QUERY_NAME,
    );
  });

  it("should handle csv exports for a query with no result sets", async () => {
    const csvLocation = path.join(tmpDir.name, "test.csv");
    const cliServer = createMockCliServer({
      bqrsInfo: [{ "result-sets": [] }],
    });
    const info = createMockQueryInfo();
    const result = await info.queryEvalInfo.exportCsvResults(
      cliServer,
      csvLocation,
    );
    expect(result).to.eq(false);
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

      expect(results).to.deep.eq([
        { message: "err", severity: Severity.ERROR },
      ]);

      expect(qs.sendRequest).to.have.been.calledOnceWith(
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
      const qs = createMockQueryServerClient({
        cliConstraints: {
          supportsDatabaseRegistration: () => true,
        },
      } as any);
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

      expect(qs.sendRequest).to.have.been.calledOnceWith(
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
      const qs = createMockQueryServerClient({
        cliConstraints: {
          supportsDatabaseRegistration: () => true,
        },
      } as any);
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

      expect(qs.sendRequest).to.have.been.calledOnceWith(
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

    it("should not register if unsupported", async () => {
      const qs = createMockQueryServerClient({
        cliConstraints: {
          supportsDatabaseRegistration: () => false,
        },
      } as any);
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
      expect(qs.sendRequest).not.to.have.been.called;
    });

    it("should not deregister if unsupported", async () => {
      const qs = createMockQueryServerClient({
        cliConstraints: {
          supportsDatabaseRegistration: () => false,
        },
      } as any);
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
      expect(qs.sendRequest).not.to.have.been.called;
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
      sendRequest: sandbox.stub().returns(
        new Promise((resolve) => {
          resolve({
            messages: [
              { message: "err", severity: Severity.ERROR },
              { message: "warn", severity: Severity.WARNING },
            ],
          });
        }),
      ),
      logger: {
        log: sandbox.spy(),
      },
      cliServer,
    } as unknown as QueryServerClient;
  }

  function createMockCliServer(
    mockOperations: Record<string, any[]>,
  ): CodeQLCliServer {
    const mockServer: Record<string, any> = {};
    for (const [operation, returns] of Object.entries(mockOperations)) {
      mockServer[operation] = sandbox.stub();
      returns.forEach((returnValue, i) => {
        mockServer[operation].onCall(i).resolves(returnValue);
      });
    }

    return mockServer as unknown as CodeQLCliServer;
  }
});
