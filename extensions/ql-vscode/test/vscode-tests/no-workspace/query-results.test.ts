import { join, basename } from "path";
import {
  ensureDir,
  writeFileSync,
  createWriteStream,
  unlinkSync,
  mkdirpSync,
} from "fs-extra";
import { platform } from "os";
import {
  LocalQueryInfo,
  InitialQueryInfo,
  interpretResultsSarif,
} from "../../../src/query-results";
import { QueryWithResults } from "../../../src/run-queries-shared";
import {
  DatabaseInfo,
  SortDirection,
  SortedResultSetInfo,
} from "../../../src/pure/interface-types";
import { CodeQLCliServer, SourceInfo } from "../../../src/cli";
import { CancellationTokenSource, Uri } from "vscode";
import { tmpDir } from "../../../src/helpers";
import {
  slurpQueryHistory,
  splatQueryHistory,
} from "../../../src/query-serialization";
import {
  formatLegacyMessage,
  QueryInProgress,
} from "../../../src/legacy-query-server/run-queries";
import {
  EvaluationResult,
  QueryResultType,
} from "../../../src/pure/legacy-messages";
import { sleep } from "../../../src/pure/time";

describe("query-results", () => {
  let queryPath: string;
  let cnt = 0;

  beforeEach(() => {
    queryPath = join(Uri.file(tmpDir.name).fsPath, `query-${cnt++}`);
  });

  describe("FullQueryInfo", () => {
    it("should get the query name", () => {
      const fqi = createMockFullQueryInfo();

      // from the query path
      expect(fqi.getQueryName()).toBe("hucairz");

      fqi.completeThisQuery(createMockQueryWithResults(queryPath));

      // from the metadata
      expect(fqi.getQueryName()).toBe("vwx");

      // from quick eval position
      (fqi.initialInfo as any).quickEvalPosition = {
        line: 1,
        endLine: 2,
        fileName: "/home/users/yz",
      };
      expect(fqi.getQueryName()).toBe("Quick evaluation of yz:1-2");
      (fqi.initialInfo as any).quickEvalPosition.endLine = 1;
      expect(fqi.getQueryName()).toBe("Quick evaluation of yz:1");
    });

    it("should get the query file name", () => {
      const fqi = createMockFullQueryInfo();

      // from the query path
      expect(fqi.getQueryFileName()).toBe("hucairz");

      // from quick eval position
      (fqi.initialInfo as any).quickEvalPosition = {
        line: 1,
        endLine: 2,
        fileName: "/home/users/yz",
      };
      expect(fqi.getQueryFileName()).toBe("yz:1-2");
      (fqi.initialInfo as any).quickEvalPosition.endLine = 1;
      expect(fqi.getQueryFileName()).toBe("yz:1");
    });

    it("should get the getResultsPath", () => {
      const query = createMockQueryWithResults(queryPath);
      const fqi = createMockFullQueryInfo("a", query);
      const completedQuery = fqi.completedQuery!;
      const expectedResultsPath = join(queryPath, "results.bqrs");

      // from results path
      expect(completedQuery.getResultsPath("zxa", false)).toBe(
        expectedResultsPath,
      );

      completedQuery.sortedResultsInfo["zxa"] = {
        resultsPath: "bxa",
      } as SortedResultSetInfo;

      // still from results path
      expect(completedQuery.getResultsPath("zxa", false)).toBe(
        expectedResultsPath,
      );

      // from sortedResultsInfo
      expect(completedQuery.getResultsPath("zxa")).toBe("bxa");
    });

    it("should format the statusString", () => {
      const evalResult: EvaluationResult = {
        resultType: QueryResultType.OTHER_ERROR,
        evaluationTime: 12340,
        queryId: 3,
        runId: 1,
      };

      evalResult.message = "Tremendously";
      expect(formatLegacyMessage(evalResult)).toBe("failed: Tremendously");

      evalResult.resultType = QueryResultType.OTHER_ERROR;
      expect(formatLegacyMessage(evalResult)).toBe("failed: Tremendously");

      evalResult.resultType = QueryResultType.CANCELLATION;
      evalResult.evaluationTime = 2345;
      expect(formatLegacyMessage(evalResult)).toBe("cancelled after 2 seconds");

      evalResult.resultType = QueryResultType.OOM;
      expect(formatLegacyMessage(evalResult)).toBe("out of memory");

      evalResult.resultType = QueryResultType.SUCCESS;
      expect(formatLegacyMessage(evalResult)).toBe("finished in 2 seconds");

      evalResult.resultType = QueryResultType.TIMEOUT;
      expect(formatLegacyMessage(evalResult)).toBe("timed out after 2 seconds");
    });
    it("should updateSortState", async () => {
      // setup
      const fqi = createMockFullQueryInfo(
        "a",
        createMockQueryWithResults(queryPath),
      );
      const completedQuery = fqi.completedQuery!;

      const spy = jest.fn();
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
      const expectedResultsPath = join(queryPath, "results.bqrs");
      const expectedSortedResultsPath = join(
        queryPath,
        "sortedResults-a-result-set-name.bqrs",
      );
      expect(spy).toBeCalledWith(
        expectedResultsPath,
        expectedSortedResultsPath,
        "a-result-set-name",
        [sortState.columnIndex],
        [sortState.sortDirection],
      );

      expect(completedQuery.sortedResultsInfo["a-result-set-name"]).toEqual({
        resultsPath: expectedSortedResultsPath,
        sortState,
      });

      // delete the sort state
      await completedQuery.updateSortState(mockServer, "a-result-set-name");
      expect(Object.values(completedQuery.sortedResultsInfo).length).toBe(0);
    });
  });

  describe("interpretResultsSarif", () => {
    let mockServer: CodeQLCliServer;
    const spy = jest.fn();
    const metadata = {
      kind: "my-kind",
      id: "my-id" as string | undefined,
      scored: undefined,
    };
    const resultsPath = "123";
    const interpretedResultsPath = join(tmpDir.name, "interpreted.json");
    const sourceInfo = {};

    beforeEach(async () => {
      spy.mockReturnValue({ a: "1234" });

      await ensureDir(basename(interpretedResultsPath));

      mockServer = {
        interpretBqrsSarif: spy,
      } as unknown as CodeQLCliServer;
    });

    afterEach(async () => {
      safeDel(interpretedResultsPath);
    });

    it(
      "should interpretResultsSarif",
      async () => {
        const results = await interpretResultsSarif(
          mockServer,
          metadata,
          {
            resultsPath,
            interpretedResultsPath,
          },
          sourceInfo as SourceInfo,
        );

        expect(results).toEqual({ a: "1234", t: "SarifInterpretationData" });
        expect(spy).toBeCalledWith(
          metadata,
          resultsPath,
          interpretedResultsPath,
          sourceInfo,
        );
      },
      2 * 60 * 1000, // up to 2 minutes per test
    );

    it(
      "should interpretBqrsSarif without ID",
      async () => {
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
        expect(results).toEqual({ a: "1234", t: "SarifInterpretationData" });
        expect(spy).toBeCalledWith(
          { kind: "my-kind", id: "dummy-id", scored: undefined },
          resultsPath,
          interpretedResultsPath,
          sourceInfo,
        );
      },
      2 * 60 * 1000, // up to 2 minutes per test
    );

    it(
      "should use sarifParser on a valid small SARIF file",
      async () => {
        writeFileSync(
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
        expect(spy).not.toBeCalled();

        expect(results).toHaveProperty("t", "SarifInterpretationData");
        expect(results).toHaveProperty("runs[0].results");
      },
      2 * 60 * 1000, // up to 2 minutes per test
    );

    it(
      "should throw an error on an invalid small SARIF file",
      async () => {
        writeFileSync(
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
        ).rejects.toThrow(
          "Parsing output of interpretation failed: Invalid SARIF file: expecting at least one run with result.",
        );

        // We do not attempt to re-interpret if we are reading from a SARIF file.
        expect(spy).not.toBeCalled();
      },
      2 * 60 * 1000, // up to 2 minutes per test
    );

    it(
      "should use sarifParser on a valid large SARIF file",
      async () => {
        const validSarifStream = createWriteStream(interpretedResultsPath, {
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
        if (platform() === "win32") {
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
        expect(spy).not.toBeCalled();

        expect(results).toHaveProperty("t", "SarifInterpretationData");
        expect(results).toHaveProperty("runs[0].results");
      },
      2 * 60 * 1000, // up to 2 minutes per test
    );

    it(
      "should throw an error on an invalid large SARIF file",
      async () => {
        // There is a problem on Windows where the file at the prior path isn't able
        // to be deleted or written to, so we rename the path for this last test.
        const interpretedResultsPath = join(
          tmpDir.name,
          "interpreted-invalid.json",
        );
        const invalidSarifStream = createWriteStream(interpretedResultsPath, {
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
        if (platform() === "win32") {
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
        ).rejects.toThrow(
          "Parsing output of interpretation failed: Invalid SARIF file: expecting at least one run with result.",
        );

        // We do not attempt to re-interpret if we are reading from a SARIF file.
        expect(spy).not.toBeCalled();
      },
      2 * 60 * 1000, // up to 2 minutes per test
    );
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

      const allHistoryPath = join(tmpDir.name, "workspace-query-history.json");

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
        expect(allHistoryActual[i]).toEqual(expectedHistory[i]);
      }
      expect(allHistoryActual.length).toEqual(expectedHistory.length);
    });

    it("should handle an invalid query history version", async () => {
      const badPath = join(tmpDir.name, "bad-query-history.json");
      writeFileSync(
        badPath,
        JSON.stringify({
          version: 3,
          queries: allHistory,
        }),
        "utf8",
      );

      const allHistoryActual = await slurpQueryHistory(badPath);
      // version number is invalid. Should return an empty array.
      expect(allHistoryActual).toEqual([]);
    });
  });

  function safeDel(file: string) {
    try {
      unlinkSync(file);
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
    const resultsPath = join(queryPath, "results.bqrs");
    mkdirpSync(queryPath);
    writeFileSync(resultsPath, "", "utf8");

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
      dispose: jest.fn(),
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
