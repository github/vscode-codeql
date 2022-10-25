import * as sinon from 'sinon';
import { expect } from 'chai';
import { extensions } from 'vscode';
import { CodeQLExtensionInterface } from '../../../extension';
import { logger } from '../../../logging';
import { Credentials } from '../../../authentication';
import * as fs from 'fs-extra';
import * as path from 'path';

import { VariantAnalysisResultsManager } from '../../../remote-queries/variant-analysis-results-manager';
import { createMockVariantAnalysisRepoTask } from '../../factories/remote-queries/gh-api/variant-analysis-repo-task';
import { CodeQLCliServer } from '../../../cli';
import { storagePath } from '../global.helper';
import { faker } from '@faker-js/faker';
import * as ghApiClient from '../../../remote-queries/gh-api/gh-api-client';
import { VariantAnalysisRepoTask } from '../../../remote-queries/gh-api/variant-analysis';
import { createMockVariantAnalysis } from '../../factories/remote-queries/shared/variant-analysis';
import { VariantAnalysis, VariantAnalysisStatus } from '../../../remote-queries/shared/variant-analysis';
import { createMockScannedRepos } from '../../factories/remote-queries/shared/scanned-repositories';
import { createMockScannedRepoResult } from '../../factories/remote-queries/shared/scanned-repo-result';

describe(VariantAnalysisResultsManager.name, function() {
  this.timeout(10000);

  let sandbox: sinon.SinonSandbox;
  let cli: CodeQLCliServer;
  let variantAnalysisId: number;
  let variantAnalysisResultsManager: VariantAnalysisResultsManager;
  let getVariantAnalysisRepoResultStub: sinon.SinonStub;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(logger, 'log');
    sandbox.stub(fs, 'mkdirSync');
    sandbox.stub(fs, 'writeFile');

    variantAnalysisId = faker.datatype.number();

    try {
      const extension = await extensions.getExtension<CodeQLExtensionInterface | Record<string, never>>('GitHub.vscode-codeql')!.activate();
      cli = extension.cliServer;
      variantAnalysisResultsManager = new VariantAnalysisResultsManager(cli, logger);
    } catch (e) {
      fail(e as Error);
    }
  });

  afterEach(async () => {
    sandbox.restore();
  });

  describe('download', () => {
    let getOctokitStub: sinon.SinonStub;
    let variantAnalysisStoragePath: string;
    const mockCredentials = {
      getOctokit: () => Promise.resolve({
        request: getOctokitStub
      })
    } as unknown as Credentials;

    beforeEach(async () => {
      variantAnalysisStoragePath = path.join(storagePath, variantAnalysisId.toString());
    });

    describe('when the artifact_url is missing', async () => {
      it('should not try to download the result', async () => {
        const dummyRepoTask = createMockVariantAnalysisRepoTask();
        delete dummyRepoTask.artifact_url;

        try {
          await variantAnalysisResultsManager.download(
            mockCredentials,
            variantAnalysisId,
            dummyRepoTask,
            variantAnalysisStoragePath
          );

          expect.fail('Expected an error to be thrown');
        } catch (e: any) {
          expect(e.message).to.equal('Missing artifact URL');
        }
      });
    });

    describe('when the artifact_url is present', async () => {
      let dummyRepoTask: VariantAnalysisRepoTask;
      let storageDirectory: string;
      let arrayBuffer: ArrayBuffer;

      beforeEach(async () => {
        dummyRepoTask = createMockVariantAnalysisRepoTask();

        storageDirectory = variantAnalysisResultsManager.getRepoStorageDirectory(variantAnalysisStoragePath, dummyRepoTask.repository.full_name);
        const sourceFilePath = path.join(__dirname, '../../../../src/vscode-tests/cli-integration/data/variant-analysis-results.zip');
        arrayBuffer = fs.readFileSync(sourceFilePath).buffer;

        getVariantAnalysisRepoResultStub = sandbox
          .stub(ghApiClient, 'getVariantAnalysisRepoResult')
          .withArgs(mockCredentials, dummyRepoTask.artifact_url as string)
          .resolves(arrayBuffer);
      });

      afterEach(async () => {
        fs.removeSync(`${storageDirectory}/results.zip`);
        fs.removeSync(`${storageDirectory}/results`);
      });

      it('should call the API to download the results', async () => {
        await variantAnalysisResultsManager.download(
          mockCredentials,
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath
        );

        expect(getVariantAnalysisRepoResultStub.calledOnce).to.be.true;
      });

      it('should save the results zip file to disk', async () => {
        await variantAnalysisResultsManager.download(
          mockCredentials,
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath
        );

        expect(fs.existsSync(`${storageDirectory}/results.zip`)).to.be.true;
      });

      it('should unzip the results in a `results/` folder', async () => {
        await variantAnalysisResultsManager.download(
          mockCredentials,
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath
        );

        expect(fs.existsSync(`${storageDirectory}/results/results.sarif`)).to.be.true;
      });
    });
  });

  describe('loadResultsIntoMemory', () => {
    let variantAnalysisStoragePath: string;
    let dummyVariantAnalysis: VariantAnalysis;
    let repoFullName1: string;
    let repoFullName2: string;

    beforeEach(async () => {
      const scannedRepos = createMockScannedRepos();
      dummyVariantAnalysis = createMockVariantAnalysis(
        VariantAnalysisStatus.InProgress,
        scannedRepos
      );
      variantAnalysisStoragePath = path.join(storagePath, variantAnalysisId.toString());
      repoFullName1 = scannedRepos[0].repository.fullName;
      repoFullName2 = scannedRepos[1].repository.fullName;

      sandbox.stub(fs, 'pathExists').resolves(true);
      const result = createMockScannedRepoResult();
      sandbox.stub(variantAnalysisResultsManager, 'loadResultsFromStorage').resolves(result);
    });

    it('should load results into memory', async () => {
      await variantAnalysisResultsManager.loadResultsIntoMemory(
        dummyVariantAnalysis.id,
        variantAnalysisStoragePath,
        repoFullName1
      );

      await variantAnalysisResultsManager.loadResultsIntoMemory(
        dummyVariantAnalysis.id,
        variantAnalysisStoragePath,
        repoFullName2
      );

      expect(variantAnalysisResultsManager.cachedResults.size).to.eq(2);
    });
  });

  describe('removeAnalysesResults', () => {
    let variantAnalysisStoragePath: string;
    let dummyVariantAnalysis: VariantAnalysis;
    let repoFullName1: string;
    let repoFullName2: string;

    beforeEach(async () => {
      const scannedRepos = createMockScannedRepos();
      dummyVariantAnalysis = createMockVariantAnalysis(
        VariantAnalysisStatus.InProgress,
        scannedRepos
      );
      variantAnalysisStoragePath = path.join(storagePath, variantAnalysisId.toString());
      repoFullName1 = scannedRepos[0].repository.fullName;
      repoFullName2 = scannedRepos[1].repository.fullName;

      sandbox.stub(fs, 'pathExists').resolves(true);
      const result = createMockScannedRepoResult();
      sandbox.stub(variantAnalysisResultsManager, 'loadResultsFromStorage').resolves(result);

      await variantAnalysisResultsManager.loadResultsIntoMemory(
        dummyVariantAnalysis.id,
        variantAnalysisStoragePath,
        repoFullName1
      );

      await variantAnalysisResultsManager.loadResultsIntoMemory(
        dummyVariantAnalysis.id,
        variantAnalysisStoragePath,
        repoFullName2
      );
    });

    it('should remove all cached results related to a variant analysis', async () => {
      expect(variantAnalysisResultsManager.cachedResults.size).to.eq(2);

      await variantAnalysisResultsManager.removeAnalysesResults(dummyVariantAnalysis);

      expect(variantAnalysisResultsManager.cachedResults.size).to.eq(0);
    });

  });
});
