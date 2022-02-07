import * as chai from 'chai';
import * as path from 'path';
import 'mocha';
import 'sinon-chai';
import * as sinon from 'sinon';
import * as chaiAsPromised from 'chai-as-promised';

import { QueryEvaluationInfo, queriesDir } from '../../run-queries';
import { Severity, compileQuery } from '../../pure/messages';
import { Uri } from 'vscode';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('run-queries', () => {
  it('should create a QueryEvaluationInfo', () => {
    const info = createMockQueryInfo();

    const queryId = info.id;
    expect(info.compiledQueryPath).to.eq(path.join(queriesDir, queryId, 'compiledQuery.qlo'));
    expect(info.dilPath).to.eq(path.join(queriesDir, queryId, 'results.dil'));
    expect(info.resultsPaths.resultsPath).to.eq(path.join(queriesDir, queryId, 'results.bqrs'));
    expect(info.resultsPaths.interpretedResultsPath).to.eq(path.join(queriesDir, queryId, 'interpretedResults.sarif'));
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
  function createMockQueryInfo(databaseHasMetadataFile = true) {
    return new QueryEvaluationInfo(
      `save-dir${queryNum++}`,
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
      sendRequest: sinon.stub().returns(new Promise(resolve => {
        resolve({
          messages: [
            { message: 'err', severity: Severity.ERROR },
            { message: 'warn', severity: Severity.WARNING },
          ]
        });
      })),
      logger: {
        log: sinon.spy()
      }
    };
  }
});
