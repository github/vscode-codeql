import { expect } from 'chai';
import 'mocha';
import * as path from 'path';
import * as bqrs from 'semmle-bqrs';
import { FileReader } from 'semmle-io-node';
import * as tmp from 'tmp';
import * as url from 'url';
import { CancellationTokenSource } from 'vscode-jsonrpc';
import * as messages from '../../src/messages';
import * as qsClient from '../../src/queryserver-client';


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

const compilationSucceeded = new Checkpoint<void>();
const evaluationSucceeded = new Checkpoint<void>();

describe('using the query server', () => {
  const codeQlPath = process.env["CODEQL_DIST"];
  if (codeQlPath == undefined) {
    throw new Error('Need environment variable CODEQL_DIST to find CodeQL CLI.');
  }
  const qs = new qsClient.QueryServerClient(
    {
      codeQlPath,
      numThreads: 1,
      queryMemoryMb: 1024,
      timeoutSecs: 1000
    },
    {
      logger: {
        log: s => console.log('logger says', s)
      }
    }
  );

  it('should be able to compile a query', async function() {
    this.timeout(5000);
    try {
      const qlProgram: messages.QlProgram = {
        libraryPath: [],
        dbschemePath: path.join(__dirname, '../data/test.dbscheme'),
        queryPath: path.join(__dirname, '../data/query.ql')
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

  it('should be able to run a query', async () => {
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
      const db: messages.Database = {
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

  it('should be able to parse results', async () => {
    await evaluationSucceeded.done();
    let fileReader: FileReader | undefined;
    let rows: bqrs.ColumnValue[][] = [];
    try {
      fileReader = await FileReader.open(RESULTS_PATH);
      const resultSets = await bqrs.open(fileReader);
      expect(resultSets.schema.resultSets.length).to.equal(1);
      expect(resultSets.resultSets.length).to.equal(1);
      for await(const row of resultSets.resultSets[0].readTuples()) {
        rows.push(row);
      }
    } finally {
      if(fileReader) {
        fileReader.dispose();
      }
    }
    expect(rows.length).to.equal(1);
    const row = rows[0];
    expect(row.length).to.equal(4);
    expect(row[0]).to.eql(42);
    expect(row[1]).to.eql(3.14159);
    expect(row[2]).to.eql("hello world");
    expect(row[3]).to.eql(true);
  });
});
