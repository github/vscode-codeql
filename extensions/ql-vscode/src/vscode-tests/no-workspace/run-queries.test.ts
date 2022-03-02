import * as chai from 'chai';
import * as path from 'path';
import 'mocha';
import 'sinon-chai';
import * as sinon from 'sinon';
import * as chaiAsPromised from 'chai-as-promised';
import { Uri } from 'vscode';

import { QueryEvaluationInfo } from '../../run-queries';
import { Severity, compileQuery } from '../../pure/messages';
import * as config from '../../config';

chai.use(chaiAsPromised);
const expect = chai.expect;

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

  function createMockQueryServerClient() {
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
      }
    };
  }
});
