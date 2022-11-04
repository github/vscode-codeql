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
import {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryDownloadStatus
} from '../../../remote-queries/shared/variant-analysis';
import { createMockVariantAnalysis } from '../../factories/remote-queries/shared/variant-analysis';
import * as VariantAnalysisModule from '../../../remote-queries/shared/variant-analysis';
import { createTimestampFile } from '../../../helpers';

describe('Variant Analysis Manager', async function() {
  let sandbox: sinon.SinonSandbox;
  let pathExistsStub: sinon.SinonStub;
  let readJsonStub: sinon.SinonStub;
  let outputJsonStub: sinon.SinonStub;
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
    pathExistsStub = sandbox.stub(fs, 'pathExists').callThrough();
    readJsonStub = sandbox.stub(fs, 'readJson').callThrough();
    outputJsonStub = sandbox.stub(fs, 'outputJson');

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

  describe('rehydrateVariantAnalysis', () => {
    const variantAnalysis = createMockVariantAnalysis({});

    describe('when the directory does not exist', () => {
      beforeEach(() => {
        pathExistsStub.withArgs(path.join(storagePath, variantAnalysis.id.toString())).resolves(false);
      });

      it('should fire the removed event if the file does not exist', async () => {
        const stub = sandbox.stub();
        variantAnalysisManager.onVariantAnalysisRemoved(stub);

        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(stub).to.have.been.calledOnce;
        sinon.assert.calledWith(pathExistsStub, path.join(storagePath, variantAnalysis.id.toString()));
      });
    });

    describe('when the directory exists', () => {
      beforeEach(() => {
        pathExistsStub.withArgs(path.join(storagePath, variantAnalysis.id.toString())).resolves(true);
      });

      it('should store the variant analysis', async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(await variantAnalysisManager.getVariantAnalysis(variantAnalysis.id)).to.deep.equal(variantAnalysis);
      });

      it('should not error if the repo states file does not exist', async () => {
        readJsonStub.withArgs(path.join(storagePath, variantAnalysis.id.toString(), 'repo_states.json')).rejects(new Error('File does not exist'));

        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        sinon.assert.calledWith(readJsonStub, path.join(storagePath, variantAnalysis.id.toString(), 'repo_states.json'));
        expect(await variantAnalysisManager.getRepoStates(variantAnalysis.id)).to.deep.equal([]);
      });

      it('should read in the repo states if it exists', async () => {
        readJsonStub.withArgs(path.join(storagePath, variantAnalysis.id.toString(), 'repo_states.json')).resolves({
          [scannedRepos[0].repository.id]: {
            repositoryId: scannedRepos[0].repository.id,
            downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
          },
          [scannedRepos[1].repository.id]: {
            repositoryId: scannedRepos[1].repository.id,
            downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.InProgress,
          },
        });

        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        sinon.assert.calledWith(readJsonStub, path.join(storagePath, variantAnalysis.id.toString(), 'repo_states.json'));
        expect(await variantAnalysisManager.getRepoStates(variantAnalysis.id)).to.have.same.deep.members([
          {
            repositoryId: scannedRepos[0].repository.id,
            downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
          },
          {
            repositoryId: scannedRepos[1].repository.id,
            downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.InProgress,
          },
        ]);
      });
    });
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

      describe('autoDownloadVariantAnalysisResult', async () => {
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

        it('should skip the download if the repository has already been downloaded', async () => {
          // First, do a download so it is downloaded. This avoids having to mock the repo states.
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysisApiResponse,
            cancellationTokenSource.token
          );

          getVariantAnalysisRepoStub.resetHistory();

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysisApiResponse,
            cancellationTokenSource.token
          );

          expect(getVariantAnalysisRepoStub.notCalled).to.be.true;
        });

        it('should write the repo state when the download is successful', async () => {
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysisApiResponse,
            cancellationTokenSource.token
          );

          sinon.assert.calledWith(outputJsonStub, path.join(storagePath, variantAnalysisApiResponse.id.toString(), 'repo_states.json'), {
            [scannedRepos[0].repository.id]: {
              repositoryId: scannedRepos[0].repository.id,
              downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
            },
          });
        });

        it('should not write the repo state when the download fails', async () => {
          getVariantAnalysisRepoResultStub.rejects(new Error('Failed to download'));

          try {
            await variantAnalysisManager.autoDownloadVariantAnalysisResult(
              scannedRepos[0],
              variantAnalysisApiResponse,
              cancellationTokenSource.token
            );
            fail('Expected an error to be thrown');
          } catch (e: any) {
            // we can ignore this error, we expect this
          }

          sinon.assert.notCalled(outputJsonStub);
        });

        it('should have a failed repo state when the repo task API fails', async () => {
          getVariantAnalysisRepoStub.onFirstCall().rejects(new Error('Failed to download'));

          try {
            await variantAnalysisManager.autoDownloadVariantAnalysisResult(
              scannedRepos[0],
              variantAnalysisApiResponse,
              cancellationTokenSource.token
            );
            fail('Expected an error to be thrown');
          } catch (e) {
            // we can ignore this error, we expect this
          }

          sinon.assert.notCalled(outputJsonStub);

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[1],
            variantAnalysisApiResponse,
            cancellationTokenSource.token
          );

          sinon.assert.calledWith(outputJsonStub, path.join(storagePath, variantAnalysisApiResponse.id.toString(), 'repo_states.json'), {
            [scannedRepos[0].repository.id]: {
              repositoryId: scannedRepos[0].repository.id,
              downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Failed,
            },
            [scannedRepos[1].repository.id]: {
              repositoryId: scannedRepos[1].repository.id,
              downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
            },
          });
        });

        it('should have a failed repo state when the download fails', async () => {
          getVariantAnalysisRepoResultStub.onFirstCall().rejects(new Error('Failed to download'));

          try {
            await variantAnalysisManager.autoDownloadVariantAnalysisResult(
              scannedRepos[0],
              variantAnalysisApiResponse,
              cancellationTokenSource.token
            );
            fail('Expected an error to be thrown');
          } catch (e) {
            // we can ignore this error, we expect this
          }

          sinon.assert.notCalled(outputJsonStub);

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[1],
            variantAnalysisApiResponse,
            cancellationTokenSource.token
          );

          sinon.assert.calledWith(outputJsonStub, path.join(storagePath, variantAnalysisApiResponse.id.toString(), 'repo_states.json'), {
            [scannedRepos[0].repository.id]: {
              repositoryId: scannedRepos[0].repository.id,
              downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Failed,
            },
            [scannedRepos[1].repository.id]: {
              repositoryId: scannedRepos[1].repository.id,
              downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
            },
          });
        });

        it('should update the repo state correctly', async () => {
          // To set some initial repo states, we need to mock the correct methods so that the repo states are read in.
          // The actual tests for these are in rehydrateVariantAnalysis, so we can just mock them here and test that
          // the methods are called.

          pathExistsStub.withArgs(path.join(storagePath, variantAnalysisApiResponse.id.toString())).resolves(true);
          // This will read in the correct repo states
          readJsonStub.withArgs(path.join(storagePath, variantAnalysisApiResponse.id.toString(), 'repo_states.json')).resolves({
            [scannedRepos[1].repository.id]: {
              repositoryId: scannedRepos[1].repository.id,
              downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
            },
            [scannedRepos[2].repository.id]: {
              repositoryId: scannedRepos[2].repository.id,
              downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.InProgress,
            },
          });

          await variantAnalysisManager.rehydrateVariantAnalysis({
            ...createMockVariantAnalysis({}),
            id: variantAnalysisApiResponse.id,
          });
          sinon.assert.calledWith(readJsonStub, path.join(storagePath, variantAnalysisApiResponse.id.toString(), 'repo_states.json'));

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysisApiResponse,
            cancellationTokenSource.token
          );

          sinon.assert.calledWith(outputJsonStub, path.join(storagePath, variantAnalysisApiResponse.id.toString(), 'repo_states.json'), {
            [scannedRepos[1].repository.id]: {
              repositoryId: scannedRepos[1].repository.id,
              downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
            },
            [scannedRepos[2].repository.id]: {
              repositoryId: scannedRepos[2].repository.id,
              downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.InProgress,
            },
            [scannedRepos[0].repository.id]: {
              repositoryId: scannedRepos[0].repository.id,
              downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
            }
          });
        });
      });

      describe('enqueueDownload', async () => {
        it('should pop download tasks off the queue', async () => {
          const getResultsSpy = sandbox.spy(variantAnalysisManager, 'autoDownloadVariantAnalysisResult');

          await variantAnalysisManager.enqueueDownload(scannedRepos[0], variantAnalysisApiResponse, cancellationTokenSource.token);
          await variantAnalysisManager.enqueueDownload(scannedRepos[1], variantAnalysisApiResponse, cancellationTokenSource.token);
          await variantAnalysisManager.enqueueDownload(scannedRepos[2], variantAnalysisApiResponse, cancellationTokenSource.token);

          expect(variantAnalysisManager.downloadsQueueSize()).to.equal(0);
          expect(getResultsSpy).to.have.been.calledThrice;
        });
      });

      describe('removeVariantAnalysis', async () => {
        let removeAnalysisResultsStub: sinon.SinonStub;
        let removeStorageStub: sinon.SinonStub;
        let dummyVariantAnalysis: VariantAnalysis;

        beforeEach(async () => {
          dummyVariantAnalysis = createMockVariantAnalysis({});
          removeAnalysisResultsStub = sandbox.stub(variantAnalysisResultsManager, 'removeAnalysisResults');
          removeStorageStub = sandbox.stub(fs, 'remove');
        });

        it('should remove variant analysis', async () => {
          await variantAnalysisManager.onVariantAnalysisUpdated(dummyVariantAnalysis);
          expect(variantAnalysisManager.variantAnalysesSize).to.eq(1);

          await variantAnalysisManager.removeVariantAnalysis(dummyVariantAnalysis);

          expect(removeAnalysisResultsStub).to.have.been.calledOnce;
          expect(removeStorageStub).to.have.been.calledOnce;
          expect(variantAnalysisManager.variantAnalysesSize).to.equal(0);
        });
      });
    });
  });

  describe('when rehydrating a query', async () => {
    let variantAnalysis: VariantAnalysis;
    let variantAnalysisRemovedSpy: sinon.SinonSpy;
    let monitorVariantAnalysisCommandSpy: sinon.SinonSpy;

    beforeEach(() => {
      variantAnalysis = createMockVariantAnalysis({});

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
        await createTimestampFile(variantAnalysisStorageLocation);
      });

      afterEach(() => {
        fs.rmSync(variantAnalysisStorageLocation, { recursive: true });
      });

      describe('when the variant analysis is not complete', async () => {
        beforeEach(() => {
          sandbox.stub(VariantAnalysisModule, 'isVariantAnalysisComplete').resolves(false);
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
          sandbox.stub(VariantAnalysisModule, 'isVariantAnalysisComplete').resolves(true);
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
});
