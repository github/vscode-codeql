import { expect } from 'chai';
import * as fs from 'fs';
import 'mocha';
import * as path from 'path';
import * as tmp from 'tmp';
import * as url from 'url';
import { parse } from '../src/bqrs';
import * as qsClient from '../src/queryserver-client';
import { QLConfiguration } from '../src/config';
import * as messages from '../src/messages';
import { MessageConnection, RequestType, CancellationToken, CancellationTokenSource, createMessageConnection } from 'vscode-jsonrpc';

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
  const qlDistributionPath = process.env["SEMMLE_DIST"];
  if (qlDistributionPath == undefined) {
    throw new Error('Need environment variable SEMMLE_DIST to find query server');
  }
  const qs = new qsClient.Server(
    {
      qlDistributionPath,
      javaCommand: path.join(qlDistributionPath, 'tools/java/bin/java')
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
        dbschemePath: path.join(__dirname, 'data/test.dbscheme'),
        queryPath: path.join(__dirname, 'data/query.ql')
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
        dbDir: path.join(__dirname, 'test-db'),
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
    const result = await parse(fs.createReadStream(RESULTS_PATH));
    expect(result.header.numberOfResultSets).to.equal(1);
    const row = result.results[0].results[0];
    expect(row.length).to.equal(4);
    expect(row[0]).to.eql({ t: 'i', v: 42 });
    expect(row[1]).to.eql({ t: 'f', v: 3.14159 });
    expect(row[2]).to.eql({ t: 's', v: "hello world" });
    expect(row[3]).to.eql({ t: 'b', v: true });
  });
});
