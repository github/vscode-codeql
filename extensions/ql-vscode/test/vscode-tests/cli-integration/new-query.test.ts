import { join, basename } from "path";
import { dirSync } from "tmp";
import { CancellationTokenSource } from "vscode-jsonrpc";
import * as messages from "../../../src/query-server/new-messages";
import * as qsClient from "../../../src/query-server/query-server-client";
import * as cli from "../../../src/codeql-cli/cli";
import { CellValue } from "../../../src/common/bqrs-cli-types";
import { describeWithCodeQL } from "../cli";
import { QueryServerClient } from "../../../src/query-server/query-server-client";
import {
  extLogger,
  ProgressReporter,
} from "../../../src/common/logging/vscode";
import { QueryResultType } from "../../../src/query-server/new-messages";
import { ensureTestDatabase, getActivatedExtension } from "../global.helper";
import { createMockApp } from "../../__mocks__/appMock";

const baseDir = join(__dirname, "../../../test/data");

const tmpDir = dirSync({
  prefix: "query_test_",
  keep: false,
  unsafeCleanup: true,
});

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

const nullProgressReporter: ProgressReporter = {
  report: () => {
    /** ignore */
  },
};

describeWithCodeQL()("using the new query server", () => {
  let qs: qsClient.QueryServerClient;
  let cliServer: cli.CodeQLCliServer;
  let db: string;

  let supportNewQueryServer = true;

  beforeAll(async () => {
    const app = createMockApp({});
    const extension = await getActivatedExtension();
    cliServer = extension.cliServer;

    cliServer.quiet = true;
    if (!(await cliServer.cliConstraints.supportsNewQueryServerForTests())) {
      console.log(
        "Skipping new-query tests: the CLI supports only the legacy query server",
      );
      supportNewQueryServer = false;
    }
    qs = new QueryServerClient(
      app,
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

    // Unlike the old query sevre the new one wants a database and the empty direcrtory is not valid.
    const dbItem = await ensureTestDatabase(
      extension.databaseManager,
      undefined,
    );
    db = dbItem.databaseUri.fsPath;
  });

  for (const queryTestCase of queryTestCases) {
    const queryName = basename(queryTestCase.queryPath);
    const evaluationSucceeded = new Checkpoint<void>();
    const parsedResults = new Checkpoint<void>();

    it("should register the database", async () => {
      if (!supportNewQueryServer) {
        return;
      }

      await qs.sendRequest(messages.registerDatabases, { databases: [db] });
    });

    it(`should be able to run query ${queryName}`, async () => {
      if (!supportNewQueryServer) {
        return;
      }

      try {
        const params: messages.RunQueryParams = {
          db,
          queryPath: queryTestCase.queryPath,
          outputPath: RESULTS_PATH,
          additionalPacks: [],
          externalInputs: {},
          singletonExternalInputs: {},
          target: { query: {} },
        };
        const result = await qs.sendRequest(
          messages.runQuery,
          params,
          token,
          () => {
            /**/
          },
        );
        expect(result.resultType).toBe(QueryResultType.SUCCESS);
        await evaluationSucceeded.resolve();
      } catch (e) {
        await evaluationSucceeded.reject(e as Error);
      }
    });

    const actualResultSets: ResultSets = {};
    it(`should be able to parse results of query ${queryName}`, async () => {
      if (!supportNewQueryServer) {
        return;
      }

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
      if (!supportNewQueryServer) {
        return;
      }

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
