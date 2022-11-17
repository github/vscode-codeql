import { expect } from "chai";
import * as path from "path";
import * as fs from "fs-extra";
import * as os from "os";
import * as sinon from "sinon";
import {
  LocalQueryInfo,
  InitialQueryInfo,
  interpretResultsSarif,
} from "../../query-results";
import { QueryWithResults } from "../../run-queries-shared";
import {
  DatabaseInfo,
  SortDirection,
  SortedResultSetInfo,
} from "../../pure/interface-types";
import { CodeQLCliServer, SourceInfo } from "../../cli";
import { CancellationTokenSource, Uri } from "vscode";
import { tmpDir } from "../../helpers";
import {
  slurpQueryHistory,
  splatQueryHistory,
} from "../../query-serialization";
import {
  formatLegacyMessage,
  QueryInProgress,
} from "../../legacy-query-server/run-queries";
import { EvaluationResult, QueryResultType } from "../../pure/legacy-messages";
import Sinon = require("sinon");
import { sleep } from "../../pure/time";

describe("query-results", () => {
  let disposeSpy: sinon.SinonSpy;
  let sandbox: sinon.SinonSandbox;
  let queryPath: string;
  let cnt = 0;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    disposeSpy = sandbox.spy();
    queryPath = path.join(Uri.file(tmpDir.name).fsPath, `query-${cnt++}`);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("FullQueryInfo", () => {
    it("should get the query name", () => {
      const fqi = createMockFullQueryInfo();

      // from the query path
      expect(fqi.getQueryName()).to.eq("hucairz");

      fqi.completeThisQuery(createMockQueryWithResults(queryPath));

      // from the metadata
      expect(fqi.getQueryName()).to.eq("vwx");

      // from quick eval position
      (fqi.initialInfo as any).quickEvalPosition = {
        line: 1,
        endLine: 2,
        fileName: "/home/users/yz",
      };
      expect(fqi.getQueryName()).to.eq("Quick evaluation of yz:1-2");
      (fqi.initialInfo as any).quickEvalPosition.endLine = 1;
      expect(fqi.getQueryName()).to.eq("Quick evaluation of yz:1");
    });

    it("should get the query file name", () => {
      const fqi = createMockFullQueryInfo();

      // from the query path
      expect(fqi.getQueryFileName()).to.eq("hucairz");

      // from quick eval position
      (fqi.initialInfo as any).quickEvalPosition = {
        line: 1,
        endLine: 2,
        fileName: "/home/users/yz",
      };
      expect(fqi.getQueryFileName()).to.eq("yz:1-2");
      (fqi.initialInfo as any).quickEvalPosition.endLine = 1;
      expect(fqi.getQueryFileName()).to.eq("yz:1");
    });

    it("should get the getResultsPath", () => {
      const query = createMockQueryWithResults(queryPath);
      const fqi = createMockFullQueryInfo("a", query);
      const completedQuery = fqi.completedQuery!;
      const expectedResultsPath = path.join(queryPath, "results.bqrs");

      // from results path
      expect(completedQuery.getResultsPath("zxa", false)).to.eq(
        expectedResultsPath,
      );

      completedQuery.sortedResultsInfo["zxa"] = {
        resultsPath: "bxa",
      } as SortedResultSetInfo;

      // still from results path
      expect(completedQuery.getResultsPath("zxa", false)).to.eq(
        expectedResultsPath,
      );

      // from sortedResultsInfo
      expect(completedQuery.getResultsPath("zxa")).to.eq("bxa");
    });

    it("should format the statusString", () => {
      const evalResult: EvaluationResult = {
        resultType: QueryResultType.OTHER_ERROR,
        evaluationTime: 12340,
        queryId: 3,
        runId: 1,
      };

      evalResult.message = "Tremendously";
      expect(formatLegacyMessage(evalResult)).to.eq("failed: Tremendously");

      evalResult.resultType = QueryResultType.OTHER_ERROR;
      expect(formatLegacyMessage(evalResult)).to.eq("failed: Tremendously");

      evalResult.resultType = QueryResultType.CANCELLATION;
      evalResult.evaluationTime = 2345;
      expect(formatLegacyMessage(evalResult)).to.eq(
        "cancelled after 2 seconds",
      );

      evalResult.resultType = QueryResultType.OOM;
      expect(formatLegacyMessage(evalResult)).to.eq("out of memory");

      evalResult.resultType = QueryResultType.SUCCESS;
      expect(formatLegacyMessage(evalResult)).to.eq("finished in 2 seconds");

      evalResult.resultType = QueryResultType.TIMEOUT;
      expect(formatLegacyMessage(evalResult)).to.eq(
        "timed out after 2 seconds",
      );
    });
    it("should updateSortState", async () => {
      // setup
      const fqi = createMockFullQueryInfo(
        "a",
        createMockQueryWithResults(queryPath),
      );
      const completedQuery = fqi.completedQuery!;

      const spy = sandbox.spy();
      const mockServer = {
        sortBqrs: spy,
      } as unknown as CodeQLCliServer;
      const sortState = {
        columnIndex: 1,
        sortDirection: SortDirection.desc,
      };

      // test
      await completedQuery.updateSortState(
        mockServer,
        "a-result-set-name",
        sortState,
      );

      // verify
      const expectedResultsPath = path.join(queryPath, "results.bqrs");
      const expectedSortedResultsPath = path.join(
        queryPath,
        "sortedResults-a-result-set-name.bqrs",
      );
      expect(spy).to.have.been.calledWith(
        expectedResultsPath,
        expectedSortedResultsPath,
        "a-result-set-name",
        [sortState.columnIndex],
        [sortState.sortDirection],
      );

      expect(
        completedQuery.sortedResultsInfo["a-result-set-name"],
      ).to.deep.equal({
        resultsPath: expectedSortedResultsPath,
        sortState,
      });

      // delete the sort state
      await completedQuery.updateSortState(mockServer, "a-result-set-name");
      expect(Object.values(completedQuery.sortedResultsInfo).length).to.eq(0);
    });
  });

  describe("interpretResultsSarif", () => {
    let mockServer: CodeQLCliServer;
    let spy: Sinon.SinonExpectation;
    const metadata = {
      kind: "my-kind",
      id: "my-id" as string | undefined,
      scored: undefined,
    };
    const resultsPath = "123";
    const interpretedResultsPath = path.join(tmpDir.name, "interpreted.json");
    const sourceInfo = {};

    beforeEach(() => {
      spy = sandbox.mock();
      spy.returns({ a: "1234" });

      mockServer = {
        interpretBqrsSarif: spy,
      } as unknown as CodeQLCliServer;
    });

    afterEach(async () => {
      sandbox.restore();
      safeDel(interpretedResultsPath);
    });

    it("should interpretResultsSarif", async function () {
      // up to 2 minutes per test
      this.timeout(2 * 60 * 1000);

      const results = await interpretResultsSarif(
        mockServer,
        metadata,
        {
          resultsPath,
          interpretedResultsPath,
        },
        sourceInfo as SourceInfo,
      );

      expect(results).to.deep.eq({ a: "1234", t: "SarifInterpretationData" });
      expect(spy).to.have.been.calledWith(
        metadata,
        resultsPath,
        interpretedResultsPath,
        sourceInfo,
      );
    });

    it("should interpretBqrsSarif without ID", async function () {
      // up to 2 minutes per test
      this.timeout(2 * 60 * 1000);

      delete metadata.id;
      const results = await interpretResultsSarif(
        mockServer,
        metadata,
        {
          resultsPath,
          interpretedResultsPath,
        },
        sourceInfo as SourceInfo,
      );
      expect(results).to.deep.eq({ a: "1234", t: "SarifInterpretationData" });
      expect(spy).to.have.been.calledWith(
        { kind: "my-kind", id: "dummy-id", scored: undefined },
        resultsPath,
        interpretedResultsPath,
        sourceInfo,
      );
    });

    it("should use sarifParser on a valid small SARIF file", async function () {
      // up to 2 minutes per test
      this.timeout(2 * 60 * 1000);

      fs.writeFileSync(
        interpretedResultsPath,
        JSON.stringify({
          runs: [{ results: [] }], // A run needs results to succeed.
        }),
        "utf8",
      );
      const results = await interpretResultsSarif(
        mockServer,
        metadata,
        {
          resultsPath,
          interpretedResultsPath,
        },
        sourceInfo as SourceInfo,
      );
      // We do not re-interpret if we are reading from a SARIF file.
      expect(spy).to.not.have.been.called;

      expect(results).to.have.property("t", "SarifInterpretationData");
      expect(results).to.have.nested.property("runs[0].results");
    });

    it("should throw an error on an invalid small SARIF file", async function () {
      // up to 2 minutes per test
      this.timeout(2 * 60 * 1000);

      fs.writeFileSync(
        interpretedResultsPath,
        JSON.stringify({
          a: "6", // Invalid: no runs or results
        }),
        "utf8",
      );

      await expect(
        interpretResultsSarif(
          mockServer,
          metadata,
          {
            resultsPath,
            interpretedResultsPath,
          },
          sourceInfo as SourceInfo,
        ),
      ).to.be.rejectedWith(
        "Parsing output of interpretation failed: Invalid SARIF file: expecting at least one run with result.",
      );

      // We do not attempt to re-interpret if we are reading from a SARIF file.
      expect(spy).to.not.have.been.called;
    });

    it("should use sarifParser on a valid large SARIF file", async function () {
      // up to 2 minutes per test
      this.timeout(2 * 60 * 1000);

      const validSarifStream = fs.createWriteStream(interpretedResultsPath, {
        flags: "w",
      });

      const finished = new Promise((res, rej) => {
        validSarifStream.addListener("close", res);
        validSarifStream.addListener("error", rej);
      });

      validSarifStream.write(
        JSON.stringify({
          runs: [{ results: [] }], // A run needs results to succeed.
        }),
        "utf8",
      );

      validSarifStream.write("[", "utf8");
      const iterations = 1_000_000;
      for (let i = 0; i < iterations; i++) {
        validSarifStream.write(
          JSON.stringify({
            a: "6",
          }),
          "utf8",
        );
        if (i < iterations - 1) {
          validSarifStream.write(",");
        }
      }
      validSarifStream.write("]", "utf8");
      validSarifStream.end();
      await finished;

      // We need to sleep to wait for MSFT Defender to scan the file
      // so that it can be read by our test.
      if (os.platform() === "win32") {
        await sleep(10_000);
      }

      const results = await interpretResultsSarif(
        mockServer,
        metadata,
        {
          resultsPath,
          interpretedResultsPath,
        },
        sourceInfo as SourceInfo,
      );
      // We do not re-interpret if we are reading from a SARIF file.
      expect(spy).to.not.have.been.called;

      expect(results).to.have.property("t", "SarifInterpretationData");
      expect(results).to.have.nested.property("runs[0].results");
    });

    it("should throw an error on an invalid large SARIF file", async function () {
      // up to 2 minutes per test
      this.timeout(2 * 60 * 1000);

      // There is a problem on Windows where the file at the prior path isn't able
      // to be deleted or written to, so we rename the path for this last test.
      const interpretedResultsPath = path.join(
        tmpDir.name,
        "interpreted-invalid.json",
      );
      const invalidSarifStream = fs.createWriteStream(interpretedResultsPath, {
        flags: "w",
      });

      const finished = new Promise((res, rej) => {
        invalidSarifStream.addListener("close", res);
        invalidSarifStream.addListener("error", rej);
      });

      invalidSarifStream.write("[", "utf8");
      const iterations = 1_000_000;
      for (let i = 0; i < iterations; i++) {
        invalidSarifStream.write(
          JSON.stringify({
            a: "6",
          }),
          "utf8",
        );
        if (i < iterations - 1) {
          invalidSarifStream.write(",");
        }
      }
      invalidSarifStream.write("]", "utf8");
      invalidSarifStream.end();
      await finished;

      // We need to sleep to wait for MSFT Defender to scan the file
      // so that it can be read by our test.
      if (os.platform() === "win32") {
        await sleep(10_000);
      }

      await expect(
        interpretResultsSarif(
          mockServer,
          metadata,
          {
            resultsPath,
            interpretedResultsPath,
          },
          sourceInfo as SourceInfo,
        ),
      ).to.be.rejectedWith(
        "Parsing output of interpretation failed: Invalid SARIF file: expecting at least one run with result.",
      );

      // We do not attempt to re-interpret if we are reading from a SARIF file.
      expect(spy).to.not.have.been.called;
    });
  });

  describe("splat and slurp", () => {
    let infoSuccessRaw: LocalQueryInfo;
    let infoSuccessInterpreted: LocalQueryInfo;
    let infoEarlyFailure: LocalQueryInfo;
    let infoLateFailure: LocalQueryInfo;
    let infoInprogress: LocalQueryInfo;
    let allHistory: LocalQueryInfo[];

    beforeEach(() => {
      infoSuccessRaw = createMockFullQueryInfo(
        "a",
        createMockQueryWithResults(
          `${queryPath}-a`,
          false,
          false,
          "/a/b/c/a",
          false,
        ),
      );
      infoSuccessInterpreted = createMockFullQueryInfo(
        "b",
        createMockQueryWithResults(
          `${queryPath}-b`,
          true,
          true,
          "/a/b/c/b",
          false,
        ),
      );
      infoEarlyFailure = createMockFullQueryInfo("c", undefined, true);
      infoLateFailure = createMockFullQueryInfo(
        "d",
        createMockQueryWithResults(
          `${queryPath}-c`,
          false,
          false,
          "/a/b/c/d",
          false,
        ),
      );
      infoInprogress = createMockFullQueryInfo("e");
      allHistory = [
        infoSuccessRaw,
        infoSuccessInterpreted,
        infoEarlyFailure,
        infoLateFailure,
        infoInprogress,
      ];
    });

    it("should splat and slurp query history", async () => {
      // the expected results only contains the history with completed queries
      const expectedHistory = [
        infoSuccessRaw,
        infoSuccessInterpreted,
        infoLateFailure,
      ];

      const allHistoryPath = path.join(
        tmpDir.name,
        "workspace-query-history.json",
      );

      // splat and slurp
      await splatQueryHistory(allHistory, allHistoryPath);
      const allHistoryActual = await slurpQueryHistory(allHistoryPath);

      // the dispose methods will be different. Ignore them.
      allHistoryActual.forEach((info) => {
        if (info.t === "local" && info.completedQuery) {
          const completedQuery = info.completedQuery;
          (completedQuery as any).dispose = undefined;

          // these fields should be missing on the slurped value
          // but they are undefined on the original value
          if (!("logFileLocation" in completedQuery)) {
            (completedQuery as any).logFileLocation = undefined;
          }
          const query = completedQuery.query;
          if (!("quickEvalPosition" in query)) {
            (query as any).quickEvalPosition = undefined;
          }
        }
      });
      expectedHistory.forEach((info) => {
        if (info.completedQuery) {
          (info.completedQuery as any).dispose = undefined;
        }
      });

      // make the diffs somewhat sane by comparing each element directly
      for (let i = 0; i < allHistoryActual.length; i++) {
        expect(allHistoryActual[i]).to.deep.eq(expectedHistory[i]);
      }
      expect(allHistoryActual.length).to.deep.eq(expectedHistory.length);
    });

    it("should handle an invalid query history version", async () => {
      const badPath = path.join(tmpDir.name, "bad-query-history.json");
      fs.writeFileSync(
        badPath,
        JSON.stringify({
          version: 3,
          queries: allHistory,
        }),
        "utf8",
      );

      const allHistoryActual = await slurpQueryHistory(badPath);
      // version number is invalid. Should return an empty array.
      expect(allHistoryActual).to.deep.eq([]);
    });
  });

  function safeDel(file: string) {
    try {
      fs.unlinkSync(file);
    } catch (e) {
      // ignore
    }
  }

  function createMockQueryWithResults(
    queryPath: string,
    didRunSuccessfully = true,
    hasInterpretedResults = true,
    dbPath = "/a/b/c",
    includeSpies = true,
  ): QueryWithResults {
    // pretend that the results path exists
    const resultsPath = path.join(queryPath, "results.bqrs");
    fs.mkdirpSync(queryPath);
    fs.writeFileSync(resultsPath, "", "utf8");

    const query = new QueryInProgress(
      queryPath,
      Uri.file(dbPath).fsPath,
      true,
      "queryDbscheme",
      undefined,
      {
        name: "vwx",
      },
    );

    const result: QueryWithResults = {
      query: query.queryEvalInfo,
      successful: didRunSuccessfully,
      message: "foo",
      dispose: disposeSpy,
      result: {
        evaluationTime: 1,
        queryId: 0,
        runId: 0,
        resultType: QueryResultType.SUCCESS,
      },
    };

    if (includeSpies) {
      (query as any).hasInterpretedResults = () =>
        Promise.resolve(hasInterpretedResults);
    }

    return result;
  }

  function createMockFullQueryInfo(
    dbName = "a",
    queryWithResults?: QueryWithResults,
    isFail = false,
  ): LocalQueryInfo {
    const fqi = new LocalQueryInfo(
      {
        databaseInfo: {
          name: dbName,
          databaseUri: Uri.parse(`/a/b/c/${dbName}`).fsPath,
        } as unknown as DatabaseInfo,
        start: new Date(),
        queryPath: "path/to/hucairz",
        queryText: "some query",
        isQuickQuery: false,
        isQuickEval: false,
        id: `some-id-${dbName}`,
      } as InitialQueryInfo,
      {
        dispose: () => {
          /**/
        },
      } as CancellationTokenSource,
    );

    if (queryWithResults) {
      fqi.completeThisQuery(queryWithResults);
    }
    if (isFail) {
      fqi.failureReason = "failure reason";
    }
    return fqi;
  }
});
