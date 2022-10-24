import * as sinon from 'sinon';
import { expect } from 'chai';
import { CancellationTokenSource, commands } from 'vscode';
import * as config from '../../../config';
import * as path from 'path';

import * as ghApiClient from '../../../remote-queries/gh-api/gh-api-client';
import { VariantAnalysisMonitor } from '../../../remote-queries/variant-analysis-monitor';
import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisFailureReason,
  VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository,
} from '../../../remote-queries/gh-api/variant-analysis';
import { createFailedMockApiResponse, createMockApiResponse } from '../../factories/remote-queries/gh-api/variant-analysis-api-response';
import { VariantAnalysis, VariantAnalysisStatus } from '../../../remote-queries/shared/variant-analysis';
import { createMockScannedRepos } from '../../factories/remote-queries/gh-api/scanned-repositories';
import { processFailureReason } from '../../../remote-queries/variant-analysis-processor';
import { Credentials } from '../../../authentication';
import { createMockVariantAnalysis } from '../../factories/remote-queries/shared/variant-analysis';
import { VariantAnalysisManager } from '../../../remote-queries/variant-analysis-manager';
import { createMockExtensionContext } from '..';
import { CodeQLCliServer } from '../../../cli';
import { logger } from '../../../logging';
import { createMockCliServer } from './factories/cli';

describe('Variant Analysis Monitor', async function() {
  this.timeout(60000);

  let sandbox: sinon.SinonSandbox;
  let cli: CodeQLCliServer;
  let mockGetVariantAnalysis: sinon.SinonStub;
  let cancellationTokenSource: CancellationTokenSource;
  let variantAnalysisMonitor: VariantAnalysisMonitor;
  let variantAnalysis: VariantAnalysis;
  let variantAnalysisManager: VariantAnalysisManager;
  let mockGetDownloadResult: sinon.SinonStub;
  let commandSpy: sinon.SinonStub;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(config, 'isVariantAnalysisLiveResultsEnabled').returns(false);

    commandSpy = sandbox.stub(commands, 'executeCommand');

    cancellationTokenSource = new CancellationTokenSource();

    variantAnalysis = createMockVariantAnalysis();

    try {
      const ctx = createMockExtensionContext();
      cli = createMockCliServer(sandbox);
      const storagePath = path.join(__dirname);

      variantAnalysisMonitor = new VariantAnalysisMonitor(ctx);
      variantAnalysisManager = new VariantAnalysisManager(ctx, cli, storagePath, logger);
    } catch (e) {
      fail(e as Error);
    }

    mockGetDownloadResult = sandbox.stub(variantAnalysisManager, 'autoDownloadVariantAnalysisResult');

    limitNumberOfAttemptsToMonitor();
  });

  afterEach(async () => {
    sandbox.restore();
  });

  describe('when credentials are invalid', async () => {
    beforeEach(async () => { sandbox.stub(Credentials, 'initialize').resolves(undefined); });

    it('should return early if credentials are wrong', async () => {
      try {
        await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationTokenSource.token);
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
      cancellationTokenSource.cancel();

      const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationTokenSource.token);

      expect(result).to.eql({ status: 'Cancelled', error: 'Variant Analysis was canceled.' });
    });

    describe('when the variant analysis fails', async () => {
      let mockFailedApiResponse: VariantAnalysisApiResponse;

      beforeEach(async function() {
        mockFailedApiResponse = createFailedMockApiResponse('in_progress');
        mockGetVariantAnalysis = sandbox.stub(ghApiClient, 'getVariantAnalysis').resolves(mockFailedApiResponse);
      });

      it('should mark as failed locally and stop monitoring', async () => {
        const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationTokenSource.token);

        expect(mockGetVariantAnalysis.calledOnce).to.be.true;
        expect(result.status).to.eql('Failed');
        expect(result.error).to.eql(`Variant Analysis has failed: ${mockFailedApiResponse.failure_reason}`);
        expect(result.variantAnalysis?.status).to.equal(VariantAnalysisStatus.Failed);
        expect(result.variantAnalysis?.failureReason).to.equal(processFailureReason(mockFailedApiResponse.failure_reason as VariantAnalysisFailureReason));
      });

      it('should emit `onVariantAnalysisChange`', async () => {
        const spy = sandbox.spy();
        variantAnalysisMonitor.onVariantAnalysisChange(spy);

        const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationTokenSource.token);

        expect(spy).to.have.been.calledWith(result.variantAnalysis);
      });
    });

    describe('when the variant analysis is in progress', async () => {
      let mockApiResponse: VariantAnalysisApiResponse;
      let scannedRepos: ApiVariantAnalysisScannedRepository[];
      let succeededRepos: ApiVariantAnalysisScannedRepository[];

      describe('when there are successfully scanned repos', async () => {
        beforeEach(async function() {
          scannedRepos = createMockScannedRepos(['pending', 'pending', 'in_progress', 'in_progress', 'succeeded', 'succeeded', 'succeeded']);
          mockApiResponse = createMockApiResponse('completed', scannedRepos);
          mockGetVariantAnalysis = sandbox.stub(ghApiClient, 'getVariantAnalysis').resolves(mockApiResponse);
          succeededRepos = scannedRepos.filter(r => r.analysis_status === 'succeeded');
        });

        it('should succeed and return a list of scanned repo ids', async () => {
          const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationTokenSource.token);

          expect(result.status).to.equal('CompletedSuccessfully');
          expect(result.scannedReposDownloaded).to.eql(succeededRepos.map(r => r.repository.id));
        });

        it('should trigger a download extension command for each repo', async () => {
          const succeededRepos = scannedRepos.filter(r => r.analysis_status === 'succeeded');

          await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationTokenSource.token);

          expect(commandSpy).to.have.callCount(succeededRepos.length);

          succeededRepos.forEach((succeededRepo, index) => {
            expect(commandSpy.getCall(index).args[0]).to.eq('codeQL.autoDownloadVariantAnalysisResult');
            expect(commandSpy.getCall(index).args[1]).to.eq(succeededRepo);
            expect(commandSpy.getCall(index).args[2]).to.eq(mockApiResponse);
          });
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
          const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationTokenSource.token);

          expect(result.status).to.equal('CompletedSuccessfully');
          expect(result.scannedReposDownloaded).to.eql([]);
        });

        it('should not try to download any repos', async () => {
          await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationTokenSource.token);

          expect(mockGetDownloadResult).to.not.have.been.called;
        });
      });

      describe('when there are no repos to scan', async () => {
        beforeEach(async function() {
          scannedRepos = [];
          mockApiResponse = createMockApiResponse('completed', scannedRepos);
          mockGetVariantAnalysis = sandbox.stub(ghApiClient, 'getVariantAnalysis').resolves(mockApiResponse);
        });

        it('should succeed and return an empty list of scanned repo ids', async () => {
          const result = await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationTokenSource.token);

          expect(result.status).to.equal('CompletedSuccessfully');
          expect(result.scannedReposDownloaded).to.eql([]);
        });

        it('should not try to download any repos', async () => {
          await variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationTokenSource.token);

          expect(mockGetDownloadResult).to.not.have.been.called;
        });
      });
    });
  });

  function limitNumberOfAttemptsToMonitor() {
    VariantAnalysisMonitor.maxAttemptCount = 3;
    VariantAnalysisMonitor.sleepTime = 1;
  }
});

