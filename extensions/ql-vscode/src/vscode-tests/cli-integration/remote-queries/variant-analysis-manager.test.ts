import * as sinon from 'sinon';
import { expect } from 'chai';
import { CancellationTokenSource, commands, extensions } from 'vscode';
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
import { createMockVariantAnalysis } from '../../factories/remote-queries/shared/variant-analysis';
import { VariantAnalysis, VariantAnalysisStatus } from '../../../remote-queries/shared/variant-analysis';

describe('Variant Analysis Manager', async function() {
  let sandbox: sinon.SinonSandbox;
  let cli: CodeQLCliServer;
  let cancellationTokenSource: CancellationTokenSource;
  let variantAnalysisManager: VariantAnalysisManager;
  let variantAnalysisApiResponse: VariantAnalysisApiResponse;
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
    variantAnalysisApiResponse = createMockApiResponse('in_progress', scannedRepos);

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
          variantAnalysisApiResponse,
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
          variantAnalysisApiResponse,
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
          variantAnalysisApiResponse,
          cancellationTokenSource.token
        );

        expect(getVariantAnalysisRepoStub.notCalled).to.be.true;
      });

      it('should fetch a repo task', async () => {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysisApiResponse,
          cancellationTokenSource.token
        );

        expect(getVariantAnalysisRepoStub.calledOnce).to.be.true;
      });

      it('should fetch a repo result', async () => {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysisApiResponse,
          cancellationTokenSource.token
        );

        expect(getVariantAnalysisRepoResultStub.calledOnce).to.be.true;
      });

      it('should pop download tasks off the queue', async () => {
        const getResultsSpy = sandbox.spy(variantAnalysisManager, 'autoDownloadVariantAnalysisResult');

        await variantAnalysisManager.enqueueDownload(scannedRepos[0], variantAnalysisApiResponse, cancellationTokenSource.token);
        await variantAnalysisManager.enqueueDownload(scannedRepos[1], variantAnalysisApiResponse, cancellationTokenSource.token);
        await variantAnalysisManager.enqueueDownload(scannedRepos[2], variantAnalysisApiResponse, cancellationTokenSource.token);

        expect(variantAnalysisManager.downloadsQueueSize()).to.equal(0);
        expect(getResultsSpy).to.have.been.calledThrice;
      });
    });
  });

  describe('when rehydrating a query', async () => {
    let variantAnalysis: VariantAnalysis;
    let variantAnalysisRemovedSpy: sinon.SinonSpy;
    let monitorVariantAnalysisCommandSpy: sinon.SinonSpy;

    beforeEach(() => {
      variantAnalysis = createMockVariantAnalysis();

      variantAnalysisRemovedSpy = sinon.spy();
      variantAnalysisManager.onVariantAnalysisRemoved(variantAnalysisRemovedSpy);

      monitorVariantAnalysisCommandSpy = sinon.spy();
      sandbox.stub(commands, 'executeCommand').callsFake(monitorVariantAnalysisCommandSpy);
    });

    describe('when variant analysis record doesn\'t exist', async () => {
      it('should remove the variant analysis', async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);
        sinon.assert.calledOnce(variantAnalysisRemovedSpy);
      });

      it('should not trigger a monitoring command', async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);
        sinon.assert.notCalled(monitorVariantAnalysisCommandSpy);
      });
    });

    describe('when variant analysis record does exist', async () => {
      let variantAnalysisStorageLocation: string;

      beforeEach(async () => {
        variantAnalysisStorageLocation = variantAnalysisManager.getVariantAnalysisStorageLocation(variantAnalysis.id);
        await variantAnalysisManager.prepareStorageDirectory(variantAnalysis.id);
      });

      afterEach(() => {
        fs.rmSync(variantAnalysisStorageLocation, { recursive: true });
      });

      describe('when the variant analysis is not complete', async () => {
        beforeEach(() => {
          sinon.stub(variantAnalysisManager, 'isVariantAnalysisComplete').resolves(false);
        });

        it('should not remove the variant analysis', async () => {
          await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);
          sinon.assert.notCalled(variantAnalysisRemovedSpy);
        });

        it('should trigger a monitoring command', async () => {
          await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);
          sinon.assert.calledWith(monitorVariantAnalysisCommandSpy, 'codeQL.monitorVariantAnalysis');
        });
      });

      describe('when the variant analysis is complete', async () => {
        beforeEach(() => {
          sinon.stub(variantAnalysisManager, 'isVariantAnalysisComplete').resolves(true);
        });

        it('should not remove the variant analysis', async () => {
          await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);
          sinon.assert.notCalled(variantAnalysisRemovedSpy);
        });

        it('should not trigger a monitoring command', async () => {
          await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);
          sinon.assert.notCalled(monitorVariantAnalysisCommandSpy);
        });
      });
    });
  });

  describe('isVariantAnalysisComplete', async () => {
    let variantAnalysis: VariantAnalysis;

    beforeEach(() => {
      variantAnalysis = createMockVariantAnalysis();
    });

    describe('when variant analysis status is InProgress', async () => {
      beforeEach(() => {
        variantAnalysis.status = VariantAnalysisStatus.InProgress;
      });

      describe('when scanned repos is undefined', async () => {
        it('should say the variant analysis is not complete', async () => {
          variantAnalysis.scannedRepos = undefined;
          expect(variantAnalysisManager.isVariantAnalysisComplete(variantAnalysis)).to.equal(false);
        });
      });

      describe('when scanned repos is non-empty', async () => {
        describe('when not all results are downloaded', async () => {
          it('should say the variant analysis is not complete', async () => {
            sinon.stub(variantAnalysisResultsManager, 'isVariantAnalysisRepoDownloaded').resolves(false);
            expect(variantAnalysisManager.isVariantAnalysisComplete(variantAnalysis)).to.equal(false);
          });
        });

        describe('when all results are downloaded', async () => {
          it('should say the variant analysis is complete', async () => {
            sinon.stub(variantAnalysisResultsManager, 'isVariantAnalysisRepoDownloaded').resolves(true);
            expect(variantAnalysisManager.isVariantAnalysisComplete(variantAnalysis)).to.equal(true);
          });
        });
      });
    });

    for (const variantAnalysisStatus of [
      VariantAnalysisStatus.Succeeded,
      VariantAnalysisStatus.Failed,
      VariantAnalysisStatus.Canceled
    ]) {
      describe(`when variant analysis status is ${variantAnalysisStatus}`, async () => {
        beforeEach(() => {
          variantAnalysis.status = variantAnalysisStatus;
        });

        describe('when scanned repos is undefined', async () => {
          it('should say the variant analysis is complete', async () => {
            variantAnalysis.scannedRepos = undefined;
            expect(variantAnalysisManager.isVariantAnalysisComplete(variantAnalysis)).to.equal(true);
          });
        });

        describe('when scanned repos is empty', async () => {
          it('should say the variant analysis is complete', async () => {
            variantAnalysis.scannedRepos = [];
            expect(variantAnalysisManager.isVariantAnalysisComplete(variantAnalysis)).to.equal(true);
          });
        });

        describe('when scanned repos is non-empty', async () => {
          describe('when not all results are downloaded', async () => {
            it('should say the variant analysis is not complete', async () => {
              sinon.stub(variantAnalysisResultsManager, 'isVariantAnalysisRepoDownloaded').resolves(false);
              expect(variantAnalysisManager.isVariantAnalysisComplete(variantAnalysis)).to.equal(false);
            });
          });

          describe('when all results are downloaded', async () => {
            it('should say the variant analysis is complete', async () => {
              sinon.stub(variantAnalysisResultsManager, 'isVariantAnalysisRepoDownloaded').resolves(true);
              expect(variantAnalysisManager.isVariantAnalysisComplete(variantAnalysis)).to.equal(true);
            });
          });
        });
      });
    }
  });
});
