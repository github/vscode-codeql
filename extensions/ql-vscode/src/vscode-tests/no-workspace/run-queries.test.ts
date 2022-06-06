import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as sinon from 'sinon';
import { Uri } from 'vscode';

import { QueryEvaluationInfo } from '../../run-queries';
import { Severity, compileQuery } from '../../pure/messages';
import * as config from '../../config';
import { tmpDir } from '../../helpers';
import { QueryServerClient } from '../../queryserver-client';
import { CodeQLCliServer } from '../../cli';
import { SELECT_QUERY_NAME } from '../../contextual/locationFinder';

describe('run-queries', () => {
  let sandbox: sinon.SinonSandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();

    sandbox.stub(config, 'isCanary').returns(false);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('should create a QueryEvaluationInfo', () => {
    const saveDir = 'query-save-dir';
    const info = createMockQueryInfo(true, saveDir);

    expect(info.compiledQueryPath).to.eq(path.join(saveDir, 'compiledQuery.qlo'));
    expect(info.dilPath).to.eq(path.join(saveDir, 'results.dil'));
    expect(info.resultsPaths.resultsPath).to.eq(path.join(saveDir, 'results.bqrs'));
    expect(info.resultsPaths.interpretedResultsPath).to.eq(path.join(saveDir, 'interpretedResults.sarif'));
    expect(info.dbItemPath).to.eq(Uri.file('/abc').fsPath);
  });

  it('should check if interpreted results can be created', async () => {
    const info = createMockQueryInfo(true);

    expect(info.canHaveInterpretedResults()).to.eq(true);

    (info as any).databaseHasMetadataFile = false;
    expect(info.canHaveInterpretedResults()).to.eq(false);

    (info as any).databaseHasMetadataFile = true;
    info.metadata!.kind = undefined;
    expect(info.canHaveInterpretedResults()).to.eq(false);

    info.metadata!.kind = 'table';
    expect(info.canHaveInterpretedResults()).to.eq(false);

    // Graphs are not interpreted unless canary is set
    info.metadata!.kind = 'graph';
    expect(info.canHaveInterpretedResults()).to.eq(false);

    (config.isCanary as sinon.SinonStub).returns(true);
    expect(info.canHaveInterpretedResults()).to.eq(true);
  });

  [SELECT_QUERY_NAME, 'other'].forEach(resultSetName => {
    it(`should export csv results for result set ${resultSetName}`, async () => {
      const csvLocation = path.join(tmpDir.name, 'test.csv');
      const qs = createMockQueryServerClient(
        createMockCliServer({
          bqrsInfo: [{ 'result-sets': [{ name: resultSetName }, { name: 'hucairz' }] }],
          bqrsDecode: [{
            columns: [{ kind: 'NotString' }, { kind: 'String' }],
            tuples: [['a', 'b'], ['c', 'd']],
            next: 1
          }, {
            // just for fun, give a different set of columns here
            // this won't happen with the real CLI, but it's a good test
            columns: [{ kind: 'String' }, { kind: 'NotString' }, { kind: 'StillNotString' }],
            tuples: [['a', 'b', 'c']]
          }]
        })
      );
      const info = createMockQueryInfo();
      const promise = info.exportCsvResults(qs, csvLocation);

      const result = await promise;
      expect(result).to.eq(true);

      const csv = fs.readFileSync(csvLocation, 'utf8');
      expect(csv).to.eq('a,"b"\nc,"d"\n"a",b,c\n');

      // now verify that we are using the expected result set
      expect((qs.cliServer.bqrsDecode as sinon.SinonStub).callCount).to.eq(2);
      expect((qs.cliServer.bqrsDecode as sinon.SinonStub).getCall(0).args[1]).to.eq(resultSetName);
    });
  });

  it('should handle csv exports for a query with no result sets', async () => {
    const csvLocation = path.join(tmpDir.name, 'test.csv');
    const qs = createMockQueryServerClient(
      createMockCliServer({
        bqrsInfo: [{ 'result-sets': [] }]
      })
    );
    const info = createMockQueryInfo();
    const result = await info.exportCsvResults(qs, csvLocation);
    expect(result).to.eq(false);
  });

  describe('compile', () => {
    it('should compile', async () => {
      const info = createMockQueryInfo();
      const qs = createMockQueryServerClient();
      const mockProgress = 'progress-monitor';
      const mockCancel = 'cancel-token';
      const mockQlProgram = {
        dbschemePath: '',
        libraryPath: [],
        queryPath: ''
      };

      const results = await info.compile(
        qs as any,
        mockQlProgram,
        mockProgress as any,
        mockCancel as any
      );

      expect(results).to.deep.eq([
        { message: 'err', severity: Severity.ERROR }
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
            computeDefaultStrings: true
          },
          extraOptions: {
            timeoutSecs: 5
          },
          queryToCheck: mockQlProgram,
          resultPath: info.compiledQueryPath,
          target: { query: {} }
        },
        mockCancel,
        mockProgress
      );
    });
  });

  let queryNum = 0;
  function createMockQueryInfo(databaseHasMetadataFile = true, saveDir = `save-dir${queryNum++}`) {
    return new QueryEvaluationInfo(
      saveDir,
      Uri.parse('file:///abc').fsPath,
      databaseHasMetadataFile,
      'my-scheme', // queryDbscheme,
      undefined,
      {
        kind: 'problem'
      }
    );
  }

  function createMockQueryServerClient(cliServer?: CodeQLCliServer): QueryServerClient {
    return {
      config: {
        timeoutSecs: 5
      },
      sendRequest: sandbox.stub().returns(new Promise(resolve => {
        resolve({
          messages: [
            { message: 'err', severity: Severity.ERROR },
            { message: 'warn', severity: Severity.WARNING },
          ]
        });
      })),
      logger: {
        log: sandbox.spy()
      },
      cliServer
    } as unknown as QueryServerClient;
  }

  function createMockCliServer(mockOperations: Record<string, any[]>): CodeQLCliServer {
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
