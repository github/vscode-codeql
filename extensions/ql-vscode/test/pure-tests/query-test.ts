import { expect } from 'chai';
import * as fs from 'fs-extra';
import 'mocha';
import * as path from 'path';
import * as bqrs from 'semmle-bqrs';
import { FileReader } from 'semmle-io-node';
import * as tmp from 'tmp';
import * as url from 'url';
import { CancellationTokenSource } from 'vscode-jsonrpc';
import * as messages from '../../src/messages';
import * as qsClient from '../../src/queryserver-client';
import * as cli from '../../src/cli';
import { ProgressReporter } from '../../src/logging';


declare module "url" {
  export function pathToFileURL(urlStr: string): Url;
}

const tmpDir = tmp.dirSync({ prefix: 'query_test_', keep: false, unsafeCleanup: true });

const COMPILED_QUERY_PATH = path.join(tmpDir.name, 'compiled.qlo');
const RESULTS_PATH = path.join(tmpDir.name, 'results.bqrs');

const source = new CancellationTokenSource();
const token = source.token;

class Checkpoint<T> {
  private res: () => void;
  private rej: (e: Error) => void;
  private promise: Promise<T>;

  constructor() {
    this.res = () => { };
    this.rej = () => { };
    this.promise = new Promise((res, rej) => { this.res = res; this.rej = rej; })
  }

  async done() {
    return this.promise;
  }

  async resolve() {
    (this.res)();
  }

  async reject(e: Error) {
    (this.rej)(e);
  }
}

type ResultSets = {
  [name: string]: bqrs.ColumnValue[][]
}

type QueryTestCase = {
  queryPath: string,
  expectedResultSets: ResultSets
}

// Test cases: queries to run and their expected results.
const queryTestCases: QueryTestCase[] = [
  {
    queryPath: path.join(__dirname, '../data/query.ql'),
    expectedResultSets: {
      '#select': [[42, 3.14159, "hello world", true]]
    }
  },
  {
    queryPath: path.join(__dirname, '../data/multiple-result-sets.ql'),
    expectedResultSets: {
      'edges': [[1, 2], [2, 3]],
      '#select': [["s"]]
    }
  }
];

describe('using the query server', function () {
  before(function () {
    if (process.env["CODEQL_PATH"] === undefined) {
      console.log('The environment variable CODEQL_PATH is not set. The query server tests, which require the CodeQL CLI, will be skipped.');
      this.skip();
    }
  });

  const codeQlPath = process.env["CODEQL_PATH"]!;
  let qs: qsClient.QueryServerClient;
  let cliServer: cli.CodeQLCliServer;
  after(() => {
    if (qs) {
      qs.dispose();
    }
    if (cliServer) {
      cliServer.dispose();
    }
  });
  it('should be able to start the query server', async function () {
    const consoleProgressReporter: ProgressReporter = {
      report: (v: {message: string}) => console.log(`progress reporter says ${v.message}`)
    };
    const logger = {
      log: (s: string) => console.log('logger says', s),
      logWithoutTrailingNewline: (s: string) => { }
    };
    cliServer = new cli.CodeQLCliServer({
      async getCodeQlPathWithoutVersionCheck(): Promise<string | undefined> {
        return codeQlPath;
      },
    }, logger)
    qs = new qsClient.QueryServerClient(
      {
        codeQlPath,
        numThreads: 1,
        queryMemoryMb: 1024,
        timeoutSecs: 1000,
        debug: false
      },
      cliServer,
      {
        logger
      },
      task => task(consoleProgressReporter, token)
    );
    await qs.startQueryServer();
  });

  // Note this does not work with arrow functions as the test case bodies:
  // ensure they are all written with standard anonymous functions.
  this.timeout(5000);

  for (const queryTestCase of queryTestCases) {
    const queryName = path.basename(queryTestCase.queryPath);
    const compilationSucceeded = new Checkpoint<void>();
    const evaluationSucceeded = new Checkpoint<void>();

    it(`should be able to compile query ${queryName}`, async function () {
      expect(fs.existsSync(queryTestCase.queryPath)).to.be.true;
      try {
        const qlProgram: messages.QlProgram = {
          libraryPath: [],
          dbschemePath: path.join(__dirname, '../data/test.dbscheme'),
          queryPath: queryTestCase.queryPath
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
          },
          queryToCheck: qlProgram,
          resultPath: COMPILED_QUERY_PATH,
          target: { query: {} }
        };
        const result = await qs.sendRequest(messages.compileQuery, params, token, () => { });
        expect(result.messages!.length).to.equal(0);
        compilationSucceeded.resolve();
      }
      catch (e) {
        compilationSucceeded.reject(e);
      }
    });

    it(`should be able to run query ${queryName}`, async function () {
      try {
        await compilationSucceeded.done();
        const callbackId = qs.registerCallback(res => {
          evaluationSucceeded.resolve();
        });
        const queryToRun: messages.QueryToRun = {
          resultsPath: RESULTS_PATH,
          qlo: url.pathToFileURL(COMPILED_QUERY_PATH).toString(),
          allowUnknownTemplates: true,
          id: callbackId,
          timeoutSecs: 1000,
        };
        const db: messages.Dataset = {
          dbDir: path.join(__dirname, '../test-db'),
          workingSet: 'default',
        }
        const params: messages.EvaluateQueriesParams = {
          db,
          evaluateId: callbackId,
          queries: [queryToRun],
          stopOnError: false,
          useSequenceHint: false
        };
        await qs.sendRequest(messages.runQueries, params, token, () => { });
      }
      catch (e) {
        evaluationSucceeded.reject(e);
      }
    });

    const actualResultSets: ResultSets = {};
    it(`should be able to parse results of query ${queryName}`, async function () {
      let fileReader: FileReader | undefined;
      try {
        await evaluationSucceeded.done();
        fileReader = await FileReader.open(RESULTS_PATH);
        const resultSetsReader = await bqrs.open(fileReader);
        for (const reader of resultSetsReader.resultSets) {
          const actualRows: bqrs.ColumnValue[][] = [];
          for await (const row of reader.readTuples()) {
            actualRows.push(row);
          }
          actualResultSets[reader.schema.name] = actualRows;
        }
      } finally {
        if (fileReader) {
          fileReader.dispose();
        }
      }
    });

    it(`should have correct results for query ${queryName}`, async function () {
      expect(actualResultSets!).not.to.be.empty;
      expect(Object.keys(actualResultSets!).sort()).to.eql(Object.keys(queryTestCase.expectedResultSets).sort());
      for (const name in queryTestCase.expectedResultSets) {
        expect(actualResultSets![name]).to.eql(queryTestCase.expectedResultSets[name], `Results for query predicate ${name} do not match`);
      }
    });
  }
});
