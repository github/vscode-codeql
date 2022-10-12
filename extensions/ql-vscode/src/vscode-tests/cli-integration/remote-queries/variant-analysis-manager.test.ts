import * as sinon from 'sinon';
import { expect } from 'chai';
import { CancellationTokenSource, extensions } from 'vscode';
import { CodeQLExtensionInterface } from '../../../extension';
import { logger } from '../../../logging';
import * as config from '../../../config';
import * as ghApiClient from '../../../remote-queries/gh-api/gh-api-client';
import { Credentials } from '../../../authentication';
import * as fs from 'fs-extra';
import * as path from 'path';

import { VariantAnalysisManager } from '../../../remote-queries/variant-analysis-manager';
import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisRepoTask,
  VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository
} from '../../../remote-queries/gh-api/variant-analysis';
import { createMockApiResponse } from '../../factories/remote-queries/gh-api/variant-analysis-api-response';
import { createMockScannedRepos } from '../../factories/remote-queries/gh-api/scanned-repositories';
import { createMockVariantAnalysisRepoTask } from '../../factories/remote-queries/gh-api/variant-analysis-repo-task';
import { CodeQLCliServer } from '../../../cli';
import { storagePath } from '../global.helper';

describe('Variant Analysis Manager', async function() {
  let sandbox: sinon.SinonSandbox;
  let cli: CodeQLCliServer;
  let cancellationTokenSource: CancellationTokenSource;
  let variantAnalysisManager: VariantAnalysisManager;
  let variantAnalysis: VariantAnalysisApiResponse;
  let scannedRepos: ApiVariantAnalysisScannedRepository[];
  let getVariantAnalysisRepoStub: sinon.SinonStub;
  let getVariantAnalysisRepoResultStub: sinon.SinonStub;
  let arrayBuffer: ArrayBuffer;
  let dummyRepoTask: VariantAnalysisRepoTask;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(logger, 'log');
    sandbox.stub(config, 'isVariantAnalysisLiveResultsEnabled').returns(false);
    sandbox.stub(fs, 'mkdirSync');
    sandbox.stub(fs, 'writeFile');

    cancellationTokenSource = new CancellationTokenSource();

    try {
      const extension = await extensions.getExtension<CodeQLExtensionInterface | Record<string, never>>('GitHub.vscode-codeql')!.activate();
      cli = extension.cliServer;
      variantAnalysisManager = new VariantAnalysisManager(extension.ctx, cli, storagePath, logger);
    } catch (e) {
      fail(e as Error);
    }

    scannedRepos = createMockScannedRepos(['pending', 'pending', 'in_progress', 'in_progress', 'succeeded', 'succeeded', 'succeeded']);
    variantAnalysis = createMockApiResponse('in_progress', scannedRepos);

    dummyRepoTask = createMockVariantAnalysisRepoTask();
    getVariantAnalysisRepoStub = sandbox.stub(ghApiClient, 'getVariantAnalysisRepo').resolves(dummyRepoTask);

    const sourceFilePath = path.join(__dirname, '../../../../src/vscode-tests/cli-integration/data/variant-analysis-results.zip');
    arrayBuffer = fs.readFileSync(sourceFilePath).buffer;
    getVariantAnalysisRepoResultStub = sandbox.stub(ghApiClient, 'getVariantAnalysisRepoResult').resolves(arrayBuffer);
  });

  afterEach(async () => {
    sandbox.restore();
  });

  describe('autoDownloadVariantAnalysisResult', async () => {
    describe('when credentials are invalid', async () => {
      beforeEach(async () => { sandbox.stub(Credentials, 'initialize').resolves(undefined); });

      it('should return early if credentials are wrong', async () => {
        try {
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token
          );
        } catch (error: any) {
          expect(error.message).to.equal('Error authenticating with GitHub');
        }
      });
    });

    describe('when credentials are valid', async () => {
      let getOctokitStub: sinon.SinonStub;

      beforeEach(async () => {
        const mockCredentials = {
          getOctokit: () => Promise.resolve({
            request: getOctokitStub
          })
        } as unknown as Credentials;
        sandbox.stub(Credentials, 'initialize').resolves(mockCredentials);
      });

      describe('when the artifact_url is missing', async () => {
        let brokenRepoTask: VariantAnalysisRepoTask;

        beforeEach(async () => {
          brokenRepoTask = dummyRepoTask;
          delete brokenRepoTask.artifact_url;

          sandbox.restore();
          getVariantAnalysisRepoStub = sandbox.stub(ghApiClient, 'getVariantAnalysisRepo').resolves(brokenRepoTask);
        });

        it('should not try to download the result', async () => {
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token
          );

          expect(getVariantAnalysisRepoResultStub.notCalled).to.be.true;
        });
      });

      describe('when the artifact_url is present', async () => {
        it('should return early if variant analysis is cancelled', async () => {
          cancellationTokenSource.cancel();

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token
          );

          expect(getVariantAnalysisRepoStub.notCalled).to.be.true;
        });

        it('should fetch a repo task', async () => {
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token
          );

          expect(getVariantAnalysisRepoStub.calledOnce).to.be.true;
        });

        it('should fetch a repo result', async () => {
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token
          );

          expect(getVariantAnalysisRepoResultStub.calledOnce).to.be.true;
        });
      });
    });
  });

  describe('autoDownloadVariantAnalysisResults', async () => {
    it('should only attempt to download each repo once', async () => {
      const getResultSpy = sandbox.spy(variantAnalysisManager, 'autoDownloadVariantAnalysisResult');
      const succeededRepos = scannedRepos.filter(r => r.analysis_status === 'succeeded');

      await variantAnalysisManager.autoDownloadVariantAnalysisResults(variantAnalysis, succeededRepos, cancellationTokenSource.token);

      expect(getResultSpy).to.have.callCount(succeededRepos.length);

      succeededRepos.forEach((succeededRepo, index) => {
        expect(getResultSpy.getCall(index).args[0]).to.eq(succeededRepo);
        expect(getResultSpy.getCall(index).args[1]).to.eq(variantAnalysis);
        expect(getResultSpy.getCall(index).args[2]).to.eq(cancellationTokenSource.token);
      });
    });
  });
});
