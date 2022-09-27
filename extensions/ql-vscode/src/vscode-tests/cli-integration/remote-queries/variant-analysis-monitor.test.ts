import * as sinon from 'sinon';
import { expect } from 'chai';
import { CancellationToken, extensions } from 'vscode';
import { CodeQLExtensionInterface } from '../../../extension';
import { logger } from '../../../logging';
import * as config from '../../../config';

import * as ghApiClient from '../../../remote-queries/gh-api/gh-api-client';
import { VariantAnalysisMonitor } from '../../../remote-queries/variant-analysis-monitor';
import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository,
  VariantAnalysisFailureReason
} from '../../../remote-queries/gh-api/variant-analysis';
import { createFailedMockApiResponse, createMockApiResponse } from '../../factories/remote-queries/gh-api/variant-analysis-api-response';
import { VariantAnalysisStatus } from '../../../remote-queries/shared/variant-analysis';
import { createMockScannedRepos } from '../../factories/remote-queries/gh-api/scanned-repositories';
import { processFailureReason } from '../../../remote-queries/variant-analysis-processor';
import { Credentials } from '../../../authentication';

describe('Variant Analysis Monitor', async function() {
  let sandbox: sinon.SinonSandbox;
  let mockGetVariantAnalysis: sinon.SinonStub;
  let cancellationToken: CancellationToken;
  let variantAnalysisMonitor: VariantAnalysisMonitor;
  let variantAnalysis: any;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(logger, 'log');
    sandbox.stub(config, 'isVariantAnalysisLiveResultsEnabled').returns(false);

    cancellationToken = {
      isCancellationRequested: false
    } as unknown as CancellationToken;

    variantAnalysis = {
      id: 123,
      controllerRepoId: 1,
    };

    try {
      const extension = await extensions.getExtension<CodeQLExtensionInterface | Record<string, never>>('GitHub.vscode-codeql')!.activate();
      variantAnalysisMonitor = new VariantAnalysisMonitor(extension.ctx, logger);
    } catch (e) {
      fail(e as Error);
    }

    limitNumberOfAttemptsToMonitor();
  });

  afterEach(async () => {
    sandbox.restore();
  });

  describe('when credentials are invalid', async () => {
    beforeEach(async () => { sandbox.stub(Credentials, 'initialize').resolves(undefined); });

    it('should return early if credentials are wrong', async () => {
      try {
        await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationToken);
      } catch (error: any) {
        expect(error.message).to.equal('Error authenticating with GitHub');
      }
    });
  });

  describe('when credentials are valid', async () => {
    beforeEach(async () => {
      const mockCredentials = {
        getOctokit: () => Promise.resolve({
          request: mockGetVariantAnalysis
        })
      } as unknown as Credentials;
      sandbox.stub(Credentials, 'initialize').resolves(mockCredentials);
    });

    it('should return early if variant analysis is cancelled', async () => {
      cancellationToken.isCancellationRequested = true;

      const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationToken);

      expect(result).to.eql({ status: 'Cancelled', error: 'Variant Analysis was canceled.' });
    });

    describe('when the variant analysis fails', async () => {
      let mockFailedApiResponse: VariantAnalysisApiResponse;

      beforeEach(async function() {
        mockFailedApiResponse = createFailedMockApiResponse('in_progress');
        mockGetVariantAnalysis = sandbox.stub(ghApiClient, 'getVariantAnalysis').resolves(mockFailedApiResponse);
      });

      it('should mark as failed locally and stop monitoring', async () => {
        const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationToken);
        variantAnalysis = result.variantAnalysis;

        expect(mockGetVariantAnalysis.calledOnce).to.be.true;
        expect(result.status).to.eql('Failed');
        expect(result.error).to.eql(`Variant Analysis has failed: ${mockFailedApiResponse.failure_reason}`);
        expect(variantAnalysis.status).to.equal(VariantAnalysisStatus.Failed);
        expect(variantAnalysis.failureReason).to.equal(processFailureReason(mockFailedApiResponse.failure_reason as VariantAnalysisFailureReason));
      });
    });

    describe('when the variant analysis completes', async () => {
      let mockApiResponse: VariantAnalysisApiResponse;
      let scannedRepos: ApiVariantAnalysisScannedRepository[];

      describe('when there are successfully scanned repos', async () => {
        beforeEach(async function() {
          scannedRepos = createMockScannedRepos(['pending', 'in_progress', 'succeeded']);
          mockApiResponse = createMockApiResponse('completed', scannedRepos);
          mockGetVariantAnalysis = sandbox.stub(ghApiClient, 'getVariantAnalysis').resolves(mockApiResponse);
        });

        it('should succeed and return a list of scanned repo ids', async () => {
          const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationToken);
          const scannedRepoIds = scannedRepos.filter(r => r.analysis_status == 'succeeded').map(r => r.repository.id);

          expect(result.status).to.equal('CompletedSuccessfully');
          expect(result.scannedReposDownloaded).to.eql(scannedRepoIds);
        });
      });

      describe('when there are only in progress repos', async () => {
        let scannedRepos: ApiVariantAnalysisScannedRepository[];

        beforeEach(async function() {
          scannedRepos = createMockScannedRepos(['pending', 'in_progress']);
          mockApiResponse = createMockApiResponse('in_progress', scannedRepos);
          mockGetVariantAnalysis = sandbox.stub(ghApiClient, 'getVariantAnalysis').resolves(mockApiResponse);
        });

        it('should succeed and return an empty list of scanned repo ids', async () => {
          const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationToken);

          expect(result.status).to.equal('CompletedSuccessfully');
          expect(result.scannedReposDownloaded).to.eql([]);
        });
      });

      describe('when there are no repos to scan', async () => {
        beforeEach(async function() {
          scannedRepos = [];
          mockApiResponse = createMockApiResponse('completed', scannedRepos);
          mockGetVariantAnalysis = sandbox.stub(ghApiClient, 'getVariantAnalysis').resolves(mockApiResponse);
        });

        it('should succeed and return an empty list of scanned repo ids', async () => {
          const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationToken);

          expect(result.status).to.equal('CompletedSuccessfully');
          expect(result.scannedReposDownloaded).to.eql([]);
        });
      });
    });
  });

  function limitNumberOfAttemptsToMonitor() {
    VariantAnalysisMonitor.maxAttemptCount = 3;
    VariantAnalysisMonitor.sleepTime = 1;
  }
});

