import { expect } from "chai";
import * as fs from "fs-extra";
import * as path from "path";
import * as tmp from "tmp";
import * as url from "url";
import { CancellationTokenSource } from "vscode-jsonrpc";
import * as messages from "../../pure/legacy-messages";
import * as qsClient from "../../legacy-query-server/queryserver-client";
import * as cli from "../../cli";
import { CellValue } from "../../pure/bqrs-cli-types";
import { extensions } from "vscode";
import { CodeQLExtensionInterface } from "../../extension";
import { fail } from "assert";
import { skipIfNoCodeQL } from "../ensureCli";
import { QueryServerClient } from "../../legacy-query-server/queryserver-client";
import { logger, ProgressReporter } from "../../logging";

const baseDir = path.join(__dirname, "../../../test/data");

const tmpDir = tmp.dirSync({
  prefix: "query_test_",
  keep: false,
  unsafeCleanup: true,
});

const COMPILED_QUERY_PATH = path.join(tmpDir.name, "compiled.qlo");
const RESULTS_PATH = path.join(tmpDir.name, "results.bqrs");

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
    await this.res();
  }

  async reject(e: Error): Promise<void> {
    await this.rej(e);
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
    queryPath: path.join(baseDir, "query.ql"),
    expectedResultSets: {
      "#select": [[42, 3.14159, "hello world", true]],
    },
  },
  {
    queryPath: path.join(baseDir, "compute-default-strings.ql"),
    expectedResultSets: {
      "#select": [[{ label: "(no string representation)" }]],
    },
  },
  {
    queryPath: path.join(baseDir, "multiple-result-sets.ql"),
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
  dbDir: path.join(__dirname, "../test-db"),
  workingSet: "default",
};

describe("using the legacy query server", function () {
  before(function () {
    skipIfNoCodeQL(this);
  });

  // Note this does not work with arrow functions as the test case bodies:
  // ensure they are all written with standard anonymous functions.
  this.timeout(20000);

  const nullProgressReporter: ProgressReporter = {
    report: () => {
      /** ignore */
    },
  };

  let qs: qsClient.QueryServerClient;
  let cliServer: cli.CodeQLCliServer;

  before(async () => {
    try {
      const extension = await extensions
        .getExtension<CodeQLExtensionInterface | Record<string, never>>(
          "GitHub.vscode-codeql",
        )!
        .activate();
      if ("cliServer" in extension) {
        cliServer = extension.cliServer;
        cliServer.quiet = true;

        qs = new QueryServerClient(
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
            logger,
          },
          (task) =>
            task(nullProgressReporter, new CancellationTokenSource().token),
        );
        await qs.startQueryServer();
      } else {
        throw new Error(
          "Extension not initialized. Make sure cli is downloaded and installed properly.",
        );
      }
    } catch (e) {
      fail(e as Error);
    }
  });

  for (const queryTestCase of queryTestCases) {
    const queryName = path.basename(queryTestCase.queryPath);
    const compilationSucceeded = new Checkpoint<void>();
    const evaluationSucceeded = new Checkpoint<void>();
    const parsedResults = new Checkpoint<void>();

    it("should register the database if necessary", async () => {
      if (await cliServer.cliConstraints.supportsDatabaseRegistration()) {
        await qs.sendRequest(
          messages.registerDatabases,
          { databases: [db] },
          token,
          (() => {
            /**/
          }) as any,
        );
      }
    });

    it(`should be able to compile query ${queryName}`, async function () {
      expect(fs.existsSync(queryTestCase.queryPath)).to.be.true;
      try {
        const qlProgram: messages.QlProgram = {
          libraryPath: [],
          dbschemePath: path.join(baseDir, "test.dbscheme"),
          queryPath: queryTestCase.queryPath,
        };
        const params: messages.CompileQueryParams = {
          compilationOptions: {
            computeNoLocationUrls: true,
            failOnWarnings: false,
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
        expect(result.messages!.length).to.equal(0);
        await compilationSucceeded.resolve();
      } catch (e) {
        await compilationSucceeded.reject(e as Error);
      }
    });

    it(`should be able to run query ${queryName}`, async function () {
      try {
        await compilationSucceeded.done();
        const callbackId = qs.registerCallback((_res) => {
          void evaluationSucceeded.resolve();
        });
        const queryToRun: messages.QueryToRun = {
          resultsPath: RESULTS_PATH,
          qlo: url.pathToFileURL(COMPILED_QUERY_PATH).toString(),
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
    it(`should be able to parse results of query ${queryName}`, async function () {
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

    it(`should have correct results for query ${queryName}`, async function () {
      await parsedResults.done();
      expect(actualResultSets!).not.to.be.empty;
      expect(Object.keys(actualResultSets!).sort()).to.eql(
        Object.keys(queryTestCase.expectedResultSets).sort(),
      );
      for (const name in queryTestCase.expectedResultSets) {
        expect(actualResultSets![name]).to.eql(
          queryTestCase.expectedResultSets[name],
          `Results for query predicate ${name} do not match`,
        );
      }
    });
  }
});
