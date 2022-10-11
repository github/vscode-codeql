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

describe(VariantAnalysisResultsManager.name, () => {
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
      variantAnalysisResultsManager = new VariantAnalysisResultsManager(cli, storagePath, logger);
    } catch (e) {
      fail(e as Error);
    }
  });

  afterEach(async () => {
    sandbox.restore();
  });

  describe('download', () => {
    let getOctokitStub: sinon.SinonStub;
    const mockCredentials = {
      getOctokit: () => Promise.resolve({
        request: getOctokitStub
      })
    } as unknown as Credentials;

    describe('when the artifact_url is missing', async () => {
      it('should not try to download the result', async () => {
        const dummyRepoTask = createMockVariantAnalysisRepoTask();
        delete dummyRepoTask.artifact_url;

        try {
          await variantAnalysisResultsManager.download(
            mockCredentials,
            variantAnalysisId,
            dummyRepoTask
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

        storageDirectory = variantAnalysisResultsManager.getRepoStorageDirectory(variantAnalysisId, dummyRepoTask.repository.full_name);
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
          dummyRepoTask
        );

        expect(getVariantAnalysisRepoResultStub.calledOnce).to.be.true;
      });

      it('should save the results zip file to disk', async () => {
        await variantAnalysisResultsManager.download(
          mockCredentials,
          variantAnalysisId,
          dummyRepoTask
        );

        expect(fs.existsSync(`${storageDirectory}/results.zip`)).to.be.true;
      });

      it('should unzip the results in a `results/` folder', async () => {
        await variantAnalysisResultsManager.download(
          mockCredentials,
          variantAnalysisId,
          dummyRepoTask
        );

        expect(fs.existsSync(`${storageDirectory}/results/results.sarif`)).to.be.true;
      });
    });
  });
});
