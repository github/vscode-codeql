import { existsSync } from "fs-extra";
import { join, basename } from "path";
import { dirSync } from "tmp";
import { pathToFileURL } from "url";
import { CancellationTokenSource } from "vscode-jsonrpc";
import * as messages from "../../../src/pure/legacy-messages";
import * as qsClient from "../../../src/query-server/legacy/query-server-client";
import * as cli from "../../../src/codeql-cli/cli";
import { CellValue } from "../../../src/common/bqrs-cli-types";
import { describeWithCodeQL } from "../cli";
import { QueryServerClient } from "../../../src/query-server/legacy/query-server-client";
import { extLogger, ProgressReporter } from "../../../src/common";
import { createMockApp } from "../../__mocks__/appMock";
import { getActivatedExtension } from "../global.helper";

const baseDir = join(__dirname, "../../../test/data");

const tmpDir = dirSync({
  prefix: "query_test_",
  keep: false,
  unsafeCleanup: true,
});

const COMPILED_QUERY_PATH = join(tmpDir.name, "compiled.qlo");
const RESULTS_PATH = join(tmpDir.name, "results.bqrs");

const source = new CancellationTokenSource();
const token = source.token;

class Checkpoint<T> {
  private res: () => void;
  private rej: (e: Error) => void;
  private promise: Promise<T>;

  constructor() {
    this.res = () => {
      /**/
    };
    this.rej = () => {
      /**/
    };
    this.promise = new Promise((res, rej) => {
      this.res = res as () => Record<string, never>;
      this.rej = rej;
    });
  }

  async done(): Promise<T> {
    return this.promise;
  }

  async resolve(): Promise<void> {
    this.res();
  }

  async reject(e: Error): Promise<void> {
    this.rej(e);
  }
}

type ResultSets = {
  [name: string]: CellValue[][];
};

type QueryTestCase = {
  queryPath: string;
  expectedResultSets: ResultSets;
};

// Test cases: queries to run and their expected results.
const queryTestCases: QueryTestCase[] = [
  {
    queryPath: join(baseDir, "query.ql"),
    expectedResultSets: {
      "#select": [[42, 3.14159, "hello world", true]],
    },
  },
  {
    queryPath: join(baseDir, "compute-default-strings.ql"),
    expectedResultSets: {
      "#select": [[{ label: "(no string representation)" }]],
    },
  },
  {
    queryPath: join(baseDir, "multiple-result-sets.ql"),
    expectedResultSets: {
      edges: [
        [1, 2],
        [2, 3],
      ],
      "#select": [["s"]],
    },
  },
];

const db: messages.Dataset = {
  dbDir: join(__dirname, "../../../.vscode-test/test-db"),
  workingSet: "default",
};

describeWithCodeQL()("using the legacy query server", () => {
  const nullProgressReporter: ProgressReporter = {
    report: () => {
      /** ignore */
    },
  };

  let qs: qsClient.QueryServerClient;
  let cliServer: cli.CodeQLCliServer;

  beforeAll(async () => {
    const extension = await getActivatedExtension();
    cliServer = extension.cliServer;
    cliServer.quiet = true;

    qs = new QueryServerClient(
      createMockApp({}),
      {
        codeQlPath:
          (await extension.distributionManager.getCodeQlPathWithoutVersionCheck()) ||
          "",
        debug: false,
        cacheSize: 0,
        numThreads: 1,
        saveCache: false,
        timeoutSecs: 0,
      },
      cliServer,
      {
        contextStoragePath: tmpDir.name,
        logger: extLogger,
      },
      (task) => task(nullProgressReporter, new CancellationTokenSource().token),
    );
    await qs.startQueryServer();
  });

  for (const queryTestCase of queryTestCases) {
    const queryName = basename(queryTestCase.queryPath);
    const compilationSucceeded = new Checkpoint<void>();
    const evaluationSucceeded = new Checkpoint<void>();
    const parsedResults = new Checkpoint<void>();

    it("should register the database if necessary", async () => {
      await qs.sendRequest(messages.registerDatabases, { databases: [db] });
    });

    it(`should be able to compile query ${queryName}`, async () => {
      expect(existsSync(queryTestCase.queryPath)).toBe(true);
      try {
        const qlProgram: messages.QlProgram = {
          libraryPath: [],
          dbschemePath: join(baseDir, "test.dbscheme"),
          queryPath: queryTestCase.queryPath,
        };
        const params: messages.CompileQueryParams = {
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
          queryToCheck: qlProgram,
          resultPath: COMPILED_QUERY_PATH,
          target: { query: {} },
        };
        const result = await qs.sendRequest(
          messages.compileQuery,
          params,
          token,
          () => {
            /**/
          },
        );
        expect(result.messages!.length).toBe(0);
        await compilationSucceeded.resolve();
      } catch (e) {
        await compilationSucceeded.reject(e as Error);
      }
    });

    it(`should be able to run query ${queryName}`, async () => {
      try {
        await compilationSucceeded.done();
        const callbackId = qs.registerCallback((_res) => {
          void evaluationSucceeded.resolve();
        });
        const queryToRun: messages.QueryToRun = {
          resultsPath: RESULTS_PATH,
          qlo: pathToFileURL(COMPILED_QUERY_PATH).toString(),
          allowUnknownTemplates: true,
          id: callbackId,
          timeoutSecs: 1000,
        };
        const params: messages.EvaluateQueriesParams = {
          db,
          evaluateId: callbackId,
          queries: [queryToRun],
          stopOnError: true,
          useSequenceHint: false,
        };
        await qs.sendRequest(messages.runQueries, params, token, () => {
          /**/
        });
      } catch (e) {
        await evaluationSucceeded.reject(e as Error);
      }
    });

    const actualResultSets: ResultSets = {};
    it(`should be able to parse results of query ${queryName}`, async () => {
      await evaluationSucceeded.done();
      const info = await cliServer.bqrsInfo(RESULTS_PATH);

      for (const resultSet of info["result-sets"]) {
        const decoded = await cliServer.bqrsDecode(
          RESULTS_PATH,
          resultSet.name,
        );
        actualResultSets[resultSet.name] = decoded.tuples;
      }
      await parsedResults.resolve();
    });

    it(`should have correct results for query ${queryName}`, async () => {
      await parsedResults.done();
      expect(actualResultSets).not.toEqual({});
      expect(Object.keys(actualResultSets!).sort()).toEqual(
        Object.keys(queryTestCase.expectedResultSets).sort(),
      );
      for (const name in queryTestCase.expectedResultSets) {
        expect(actualResultSets![name]).toEqual(
          queryTestCase.expectedResultSets[name],
        );
      }
    });
  }
});
