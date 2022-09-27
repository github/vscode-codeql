import * as sinon from 'sinon';
import { expect } from 'chai';
import { CancellationToken, extensions } from 'vscode';
import { CodeQLExtensionInterface } from '../../../extension';
import { logger } from '../../../logging';

import * as ghApiClient from '../../../remote-queries/gh-api/gh-api-client';
import { VariantAnalysisMonitor } from '../../../remote-queries/variant-analysis-monitor';
import { VariantAnalysis as VariantAnalysisApiResponse, VariantAnalysisFailureReason } from '../../../remote-queries/gh-api/variant-analysis';
import { createFailedMockApiResponse, createMockApiResponse } from '../../factories/remote-queries/gh-api/variant-analysis-api-response';
import { createMockCredentials } from '../../utils/credentials';
import { VariantAnalysisStatus } from '../../../remote-queries/shared/variant-analysis';
import { processFailureReason } from '../../../remote-queries/variant-analysis-processor';

describe('Variant Analysis Monitor', async function() {
  let sandbox: sinon.SinonSandbox;
  let mockGetVariantAnalysis: sinon.SinonStub;

  let cancellationToken: CancellationToken;
  let variantAnalysisMonitor: VariantAnalysisMonitor;
  let variantAnalysis: any;

  beforeEach(async function() {
    sandbox = sinon.createSandbox();

    sandbox.stub(logger, 'log');

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
  afterEach(async () => sandbox.restore());

  describe('when credentials are invalid', async () => {
    beforeEach(async () => createMockCredentials(sandbox, undefined));
    afterEach(async () => sandbox.restore());

    it('should return early if credentials are wrong', async () => {
      try {
        await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationToken);
      } catch (error: any) {
        expect(error.message).to.equal('Error authenticating with GitHub');
      }
    });
  });

  describe('when credentials are valid', async () => {
    beforeEach(async () => createMockCredentials(sandbox));
    afterEach(async () => sandbox.restore());

    it('should return early if variant analysis is cancelled', async () => {
      const token = {
        isCancellationRequested: true
      } as unknown as CancellationToken;

      const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, token);

      expect(result).to.eql({ status: 'Cancelled', error: 'Variant Analysis was canceled.' });
    });

    describe('when the variant analysis fails', async () => {
      let mockFailedApiResponse: VariantAnalysisApiResponse;

      beforeEach(async function() {
        mockFailedApiResponse = createFailedMockApiResponse('in_progress');
        mockGetVariantAnalysis = sinon.stub(ghApiClient, 'getVariantAnalysis').resolves(mockFailedApiResponse);
      });
      afterEach(async () => sandbox.restore());

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

    describe('when the variant analysis succeeds', async () => {
      beforeEach(async function() {
        const mockApiResponse = createMockApiResponse();
        mockGetVariantAnalysis = sinon.stub(ghApiClient, 'getVariantAnalysis').resolves(mockApiResponse);
      });
      afterEach(async () => sandbox.restore());

      it('should return success', async () => {
        const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationToken);

        expect(result).to.eql({ status: 'CompletedSuccessfully', scannedReposDownloaded: [] });
      });
    });

    describe('when the variant analysis times out', async () => {
      beforeEach(async function() {
        const mockApiResponse = createMockApiResponse();
        mockGetVariantAnalysis = sinon.stub(ghApiClient, 'getVariantAnalysis').resolves(mockApiResponse);
      });
      afterEach(async () => sandbox.restore());

      it('should return success', async () => {
        const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationToken);

        expect(result).to.eql({ status: 'CompletedSuccessfully', scannedReposDownloaded: [] });
      });
    });
  });

  function limitNumberOfAttemptsToMonitor() {
    VariantAnalysisMonitor.maxAttemptCount = 3;
    VariantAnalysisMonitor.sleepTime = 1;
  }
});

