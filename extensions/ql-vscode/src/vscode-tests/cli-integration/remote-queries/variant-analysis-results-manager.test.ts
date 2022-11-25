import * as sinon from "sinon";
import { expect } from "chai";
import { extensions } from "vscode";
import { CodeQLExtensionInterface } from "../../../extension";
import { logger } from "../../../logging";
import { Credentials } from "../../../authentication";
import * as fs from "fs-extra";
import * as path from "path";

import { VariantAnalysisResultsManager } from "../../../remote-queries/variant-analysis-results-manager";
import { CodeQLCliServer } from "../../../cli";
import { storagePath } from "../global.helper";
import { faker } from "@faker-js/faker";
import * as ghApiClient from "../../../remote-queries/gh-api/gh-api-client";
import { createMockVariantAnalysisRepositoryTask } from "../../factories/remote-queries/shared/variant-analysis-repo-tasks";
import { VariantAnalysisRepositoryTask } from "../../../remote-queries/shared/variant-analysis";

describe(VariantAnalysisResultsManager.name, function () {
  this.timeout(10000);

  let sandbox: sinon.SinonSandbox;
  let cli: CodeQLCliServer;
  let variantAnalysisId: number;
  let variantAnalysisResultsManager: VariantAnalysisResultsManager;
  let getVariantAnalysisRepoResultStub: sinon.SinonStub;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(logger, "log");
    sandbox.stub(fs, "mkdirSync");
    sandbox.stub(fs, "writeFile");

    variantAnalysisId = faker.datatype.number();

    try {
      const extension = await extensions
        .getExtension<CodeQLExtensionInterface | Record<string, never>>(
          "GitHub.vscode-codeql",
        )!
        .activate();
      cli = extension.cliServer;
      variantAnalysisResultsManager = new VariantAnalysisResultsManager(
        cli,
        logger,
      );
    } catch (e) {
      fail(e as Error);
    }
  });

  afterEach(async () => {
    sandbox.restore();
  });

  describe("download", () => {
    let getOctokitStub: sinon.SinonStub;
    const mockCredentials = {
      getOctokit: () =>
        Promise.resolve({
          request: getOctokitStub,
        }),
    } as unknown as Credentials;
    let dummyRepoTask: VariantAnalysisRepositoryTask;
    let variantAnalysisStoragePath: string;
    let repoTaskStorageDirectory: string;

    beforeEach(async () => {
      dummyRepoTask = createMockVariantAnalysisRepositoryTask();

      variantAnalysisStoragePath = path.join(
        storagePath,
        variantAnalysisId.toString(),
      );
      repoTaskStorageDirectory =
        variantAnalysisResultsManager.getRepoStorageDirectory(
          variantAnalysisStoragePath,
          dummyRepoTask.repository.fullName,
        );
    });

    afterEach(async () => {
      if (fs.existsSync(variantAnalysisStoragePath)) {
        fs.rmSync(variantAnalysisStoragePath, { recursive: true });
      }
    });

    describe("isVariantAnalysisRepoDownloaded", () => {
      it("should return false when no results are downloaded", async () => {
        expect(
          await variantAnalysisResultsManager.isVariantAnalysisRepoDownloaded(
            variantAnalysisStoragePath,
            dummyRepoTask.repository.fullName,
          ),
        ).to.equal(false);
      });
    });

    describe("when the artifact_url is missing", async () => {
      it("should not try to download the result", async () => {
        const dummyRepoTask = createMockVariantAnalysisRepositoryTask();
        delete dummyRepoTask.artifactUrl;

        try {
          await variantAnalysisResultsManager.download(
            mockCredentials,
            variantAnalysisId,
            dummyRepoTask,
            variantAnalysisStoragePath,
          );

          expect.fail("Expected an error to be thrown");
        } catch (e: any) {
          expect(e.message).to.equal("Missing artifact URL");
        }
      });
    });

    describe("when the artifact_url is present", async () => {
      let arrayBuffer: ArrayBuffer;

      beforeEach(async () => {
        const sourceFilePath = path.join(
          __dirname,
          "../../../../src/vscode-tests/cli-integration/data/variant-analysis-results.zip",
        );
        arrayBuffer = fs.readFileSync(sourceFilePath).buffer;

        getVariantAnalysisRepoResultStub = sandbox
          .stub(ghApiClient, "getVariantAnalysisRepoResult")
          .withArgs(mockCredentials, dummyRepoTask.artifactUrl as string)
          .resolves(arrayBuffer);
      });

      it("should call the API to download the results", async () => {
        await variantAnalysisResultsManager.download(
          mockCredentials,
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath,
        );

        expect(getVariantAnalysisRepoResultStub.calledOnce).to.be.true;
      });

      it("should save the results zip file to disk", async () => {
        await variantAnalysisResultsManager.download(
          mockCredentials,
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath,
        );

        expect(fs.existsSync(`${repoTaskStorageDirectory}/results.zip`)).to.be
          .true;
      });

      it("should unzip the results in a `results/` folder", async () => {
        await variantAnalysisResultsManager.download(
          mockCredentials,
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath,
        );

        expect(
          fs.existsSync(`${repoTaskStorageDirectory}/results/results.sarif`),
        ).to.be.true;
      });

      describe("isVariantAnalysisRepoDownloaded", () => {
        it("should return true once results are downloaded", async () => {
          await variantAnalysisResultsManager.download(
            mockCredentials,
            variantAnalysisId,
            dummyRepoTask,
            variantAnalysisStoragePath,
          );

          expect(
            await variantAnalysisResultsManager.isVariantAnalysisRepoDownloaded(
              variantAnalysisStoragePath,
              dummyRepoTask.repository.fullName,
            ),
          ).to.equal(true);
        });
      });
    });
  });
});
