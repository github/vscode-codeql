import * as sinon from 'sinon';
import { expect } from 'chai';
import { CancellationToken, extensions } from 'vscode';
import { CodeQLExtensionInterface } from '../../../extension';
import { logger } from '../../../logging';
import * as config from '../../../config';
import * as ghApiClient from '../../../remote-queries/gh-api/gh-api-client';
import { Credentials } from '../../../authentication';
import * as fs from 'fs-extra';

import { VariantAnalysisManager } from '../../../remote-queries/variant-analysis-manager';
import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository
} from '../../../remote-queries/gh-api/variant-analysis';
import { createMockApiResponse } from '../../factories/remote-queries/gh-api/variant-analysis-api-response';
import { createMockScannedRepos } from '../../factories/remote-queries/gh-api/scanned-repositories';
import { createMockVariantAnalysisRepoTask } from '../../factories/remote-queries/gh-api/variant-analysis-repo-task';

describe('Variant Analysis Manager', async function() {
  let sandbox: sinon.SinonSandbox;
  let cancellationToken: CancellationToken;
  let variantAnalysisManager: VariantAnalysisManager;
  let variantAnalysis: VariantAnalysisApiResponse;
  let scannedRepos: ApiVariantAnalysisScannedRepository[];
  let getVariantAnalysisRepoStub: sinon.SinonStub;
  let getVariantAnalysisRepoResultStub: sinon.SinonStub;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(logger, 'log');
    sandbox.stub(config, 'isVariantAnalysisLiveResultsEnabled').returns(false);
    sandbox.stub(fs, 'mkdirSync');
    sandbox.stub(fs, 'writeFile');

    cancellationToken = {
      isCancellationRequested: false
    } as unknown as CancellationToken;

    scannedRepos = createMockScannedRepos();
    variantAnalysis = createMockApiResponse('in_progress', scannedRepos);

    try {
      const extension = await extensions.getExtension<CodeQLExtensionInterface | Record<string, never>>('GitHub.vscode-codeql')!.activate();
      variantAnalysisManager = new VariantAnalysisManager(extension.ctx, logger);
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
          cancellationToken
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
      beforeEach(async () => {
        const dummyRepoTask = createMockVariantAnalysisRepoTask();
        delete dummyRepoTask.artifact_url;
        getVariantAnalysisRepoStub = sandbox.stub(ghApiClient, 'getVariantAnalysisRepo').resolves(dummyRepoTask);

        const dummyResult = 'this-is-a-repo-result';
        getVariantAnalysisRepoResultStub = sandbox.stub(ghApiClient, 'getVariantAnalysisRepoResult').resolves(dummyResult);
      });

      it('should not try to download the result', async () => {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
          cancellationToken
        );

        expect(getVariantAnalysisRepoResultStub.notCalled).to.be.true;
      });
    });

    describe('when the artifact_url is present', async () => {
      beforeEach(async () => {
        const dummyRepoTask = createMockVariantAnalysisRepoTask();
        getVariantAnalysisRepoStub = sandbox.stub(ghApiClient, 'getVariantAnalysisRepo').resolves(dummyRepoTask);

        const dummyResult = 'this-is-a-repo-result';
        getVariantAnalysisRepoResultStub = sandbox.stub(ghApiClient, 'getVariantAnalysisRepoResult').resolves(dummyResult);
      });

      it('should return early if variant analysis is cancelled', async () => {
        cancellationToken.isCancellationRequested = true;

        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
          cancellationToken
        );

        expect(getVariantAnalysisRepoStub.notCalled).to.be.true;
      });

      it('should fetch a repo task', async () => {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
          cancellationToken
        );

        expect(getVariantAnalysisRepoStub.calledOnce).to.be.true;
      });

      it('should fetch a repo result', async () => {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
          cancellationToken
        );

        expect(getVariantAnalysisRepoResultStub.calledOnce).to.be.true;
      });

      it('should save the result to disk', async () => {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
          cancellationToken
        );

        expect(getVariantAnalysisRepoResultStub.calledOnce).to.be.true;
      });
    });
  });
});
