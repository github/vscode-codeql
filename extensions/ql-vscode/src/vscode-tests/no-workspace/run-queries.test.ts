import * as chai from 'chai';
import * as path from 'path';
import 'mocha';
import 'sinon-chai';
import * as sinon from 'sinon';
import * as chaiAsPromised from 'chai-as-promised';

import { QueryInfo } from '../../run-queries';
import { QlProgram, Severity, compileQuery } from '../../pure/messages';
import { DatabaseItem } from '../../databases';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('run-queries', () => {
  it('should create a QueryInfo', () => {
    const info = createMockQueryInfo();

    const queryID = info.queryID;
    expect(path.basename(info.compiledQueryPath)).to.eq(`compiledQuery${queryID}.qlo`);
    expect(path.basename(info.dilPath)).to.eq(`results${queryID}.dil`);
    expect(path.basename(info.resultsPaths.resultsPath)).to.eq(`results${queryID}.bqrs`);
    expect(path.basename(info.resultsPaths.interpretedResultsPath)).to.eq(`interpretedResults${queryID}.sarif`);
    expect(info.dataset).to.eq('file:///abc');
  });

  it('should check if interpreted results can be created', async () => {
    const info = createMockQueryInfo();
    (info.dbItem.hasMetadataFile as sinon.SinonStub).returns(true);

    expect(await info.canHaveInterpretedResults()).to.eq(true);

    (info.dbItem.hasMetadataFile as sinon.SinonStub).returns(false);
    expect(await info.canHaveInterpretedResults()).to.eq(false);

    (info.dbItem.hasMetadataFile as sinon.SinonStub).returns(true);
    info.metadata!.kind = undefined;
    expect(await info.canHaveInterpretedResults()).to.eq(false);

    info.metadata!.kind = 'table';
    expect(await info.canHaveInterpretedResults()).to.eq(false);
  });

  describe('compile', () => {
    it('should compile', async () => {
      const info = createMockQueryInfo();
      const qs = createMockQueryServerClient();
      const mockProgress = 'progress-monitor';
      const mockCancel = 'cancel-token';

      const results = await info.compile(
        qs as any,
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
          queryToCheck: 'my-program',
          resultPath: info.compiledQueryPath,
          target: { query: {} }
        },
        mockCancel,
        mockProgress
      );
    });
  });

  function createMockQueryInfo() {
    return new QueryInfo(
      'my-program' as unknown as QlProgram,
      {
        contents: {
          datasetUri: 'file:///abc'
        },
        hasMetadataFile: sinon.stub()
      } as unknown as DatabaseItem,
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
