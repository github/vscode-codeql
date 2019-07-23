import { expect } from 'chai';
import * as fs from 'fs';
import 'mocha';
import * as path from 'path';
import * as tmp from 'tmp';
import * as url from 'url';
import * as compilation from '../gen/compilation_server_protocol_pb';
import * as evaluation from '../gen/evaluation_server_protocol_pb';
import { parse } from '../src/bqrs';
import * as qsClient from '../src/queryserver-client';
import { QLConfiguration } from '../src/config';

declare module "url" {
  export function pathToFileURL(urlStr: string): Url;
}

const tmpDir = tmp.dirSync({ prefix: 'query_test_', keep: false, unsafeCleanup: true });

const COMPILED_QUERY_PATH = path.join(tmpDir.name, 'compiled.qlo');
const RESULTS_PATH = path.join(tmpDir.name, 'results.bqrs');

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
  const qs = new qsClient.Server({
    qlDistributionPath,
    javaCommand: path.join(qlDistributionPath, 'tools/java/bin/java')
  }, {
      logger: s => console.log('logger says', s),
    });

  it('should be able to compile a query', async function() {
    this.timeout(5000);
    try {
      const qlProgram = new compilation.QlProgram();
      qlProgram.setLibraryPathList([]);
      qlProgram.setDbschemePath(path.join(__dirname, 'data/test.dbscheme'));
      qlProgram.setQueryPath(path.join(__dirname, 'data/query.ql'));

      const result = await new Promise<compilation.CheckQueryResult.AsObject>((res, rej) => {
        qs.compileQuery(qlProgram,
          COMPILED_QUERY_PATH,
          {
            onProgress: () => { },
            onResult: x => { res(x); },
            onDone: () => { },
          },
          undefined,
        );
      });

      expect(result.messagesList.length).to.equal(0);
      compilationSucceeded.resolve();
    }
    catch (e) {
      compilationSucceeded.reject(e);
    }
  });

  it('should be able to run a query', async () => {
    try {
      await compilationSucceeded.done();
      const queryToRun = new evaluation.QueryToRun();
      queryToRun.setResultPath(RESULTS_PATH);
      queryToRun.setQloUri(url.pathToFileURL(COMPILED_QUERY_PATH).toString());
      queryToRun.setTimeoutSecs(1000);
      queryToRun.setAllowUnkownTemplates(true);
      const db = new evaluation.Database();
      db.setDatabaseDirectory(path.join(__dirname, 'test-db'));
      db.setWorkingSet('default');
      const result = await new Promise<evaluation.Result.AsObject>((res, rej) => {
        qs.runQuery(queryToRun, db,
          {
            onProgress: () => { },
            onResult: res,
            onDone: () => { },
          }
        )
      });
      console.log(result.message);
      evaluationSucceeded.resolve();
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
