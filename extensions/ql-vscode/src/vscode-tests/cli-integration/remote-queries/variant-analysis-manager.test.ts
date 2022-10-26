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
import { VariantAnalysisResultsManager } from '../../../remote-queries/variant-analysis-results-manager';

describe('Variant Analysis Manager', async function() {
  let sandbox: sinon.SinonSandbox;
  let cli: CodeQLCliServer;
  let cancellationTokenSource: CancellationTokenSource;
  let variantAnalysisManager: VariantAnalysisManager;
  let variantAnalysis: VariantAnalysisApiResponse;
  let scannedRepos: ApiVariantAnalysisScannedRepository[];
  let getVariantAnalysisRepoStub: sinon.SinonStub;
  let getVariantAnalysisRepoResultStub: sinon.SinonStub;
  let variantAnalysisResultsManager: VariantAnalysisResultsManager;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(logger, 'log');
    sandbox.stub(config, 'isVariantAnalysisLiveResultsEnabled').returns(false);
    sandbox.stub(fs, 'mkdirSync');
    sandbox.stub(fs, 'writeFile');

    cancellationTokenSource = new CancellationTokenSource();

    scannedRepos = createMockScannedRepos();
    variantAnalysis = createMockApiResponse('in_progress', scannedRepos);

    try {
      const extension = await extensions.getExtension<CodeQLExtensionInterface | Record<string, never>>('GitHub.vscode-codeql')!.activate();
      cli = extension.cliServer;
      variantAnalysisResultsManager = new VariantAnalysisResultsManager(cli, logger);
      variantAnalysisManager = new VariantAnalysisManager(extension.ctx, storagePath, variantAnalysisResultsManager);
    } catch (e) {
      fail(e as Error);
    }
  });

  afterEach(async () => {
    sandbox.restore();
  });

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
    let arrayBuffer: ArrayBuffer;

    beforeEach(async () => {
      const mockCredentials = {
        getOctokit: () => Promise.resolve({
          request: getOctokitStub
        })
      } as unknown as Credentials;
      sandbox.stub(Credentials, 'initialize').resolves(mockCredentials);

      const sourceFilePath = path.join(__dirname, '../../../../src/vscode-tests/cli-integration/data/variant-analysis-results.zip');
      arrayBuffer = fs.readFileSync(sourceFilePath).buffer;
    });

    describe('when the artifact_url is missing', async () => {
      beforeEach(async () => {
        const dummyRepoTask = createMockVariantAnalysisRepoTask();
        delete dummyRepoTask.artifact_url;

        getVariantAnalysisRepoStub = sandbox.stub(ghApiClient, 'getVariantAnalysisRepo').resolves(dummyRepoTask);
        getVariantAnalysisRepoResultStub = sandbox.stub(ghApiClient, 'getVariantAnalysisRepoResult').resolves(arrayBuffer);
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
      let dummyRepoTask: VariantAnalysisRepoTask;

      beforeEach(async () => {
        dummyRepoTask = createMockVariantAnalysisRepoTask();

        getVariantAnalysisRepoStub = sandbox.stub(ghApiClient, 'getVariantAnalysisRepo').resolves(dummyRepoTask);
        getVariantAnalysisRepoResultStub = sandbox.stub(ghApiClient, 'getVariantAnalysisRepoResult').resolves(arrayBuffer);
      });

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

      it('should pop download tasks off the queue', async () => {
        const getResultsSpy = sandbox.spy(variantAnalysisManager, 'autoDownloadVariantAnalysisResult');

        await variantAnalysisManager.enqueueDownload(scannedRepos[0], variantAnalysis, cancellationTokenSource.token);
        await variantAnalysisManager.enqueueDownload(scannedRepos[1], variantAnalysis, cancellationTokenSource.token);
        await variantAnalysisManager.enqueueDownload(scannedRepos[2], variantAnalysis, cancellationTokenSource.token);

        expect(variantAnalysisManager.downloadsQueueSize()).to.equal(0);
        expect(getResultsSpy).to.have.been.calledThrice;
      });
    });
  });
});
