import { extensions } from "vscode";
import { CodeQLExtensionInterface } from "../../../extension";
import { extLogger } from "../../../common";
import { Credentials } from "../../../authentication";
import * as fs from "fs-extra";
import { join } from "path";

import { VariantAnalysisResultsManager } from "../../../remote-queries/variant-analysis-results-manager";
import { CodeQLCliServer } from "../../../cli";
import { storagePath } from "../global.helper";
import { faker } from "@faker-js/faker";
import * as ghApiClient from "../../../remote-queries/gh-api/gh-api-client";
import { createMockVariantAnalysisRepositoryTask } from "../../factories/remote-queries/shared/variant-analysis-repo-tasks";
import {
  VariantAnalysisRepositoryTask,
  VariantAnalysisScannedRepositoryResult,
} from "../../../remote-queries/shared/variant-analysis";

jest.setTimeout(10_000);

describe(VariantAnalysisResultsManager.name, () => {
  let cli: CodeQLCliServer;
  let variantAnalysisId: number;

  beforeEach(async () => {
    variantAnalysisId = faker.datatype.number();

    const extension = await extensions
      .getExtension<CodeQLExtensionInterface | Record<string, never>>(
        "GitHub.vscode-codeql",
      )!
      .activate();
    cli = extension.cliServer;
  });

  describe("download", () => {
    const mockCredentials = {
      getOctokit: () =>
        Promise.resolve({
          request: jest.fn(),
        }),
    } as unknown as Credentials;
    let dummyRepoTask: VariantAnalysisRepositoryTask;
    let variantAnalysisStoragePath: string;
    let repoTaskStorageDirectory: string;
    let variantAnalysisResultsManager: VariantAnalysisResultsManager;

    beforeEach(async () => {
      jest.spyOn(extLogger, "log").mockResolvedValue(undefined);
      jest.spyOn(fs, "mkdirSync").mockReturnValue(undefined);
      jest.spyOn(fs, "writeFile").mockReturnValue(undefined);

      variantAnalysisResultsManager = new VariantAnalysisResultsManager(
        cli,
        extLogger,
      );

      dummyRepoTask = createMockVariantAnalysisRepositoryTask();

      variantAnalysisStoragePath = join(
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
        ).toBe(false);
      });
    });

    describe("when the artifact_url is missing", () => {
      it("should not try to download the result", async () => {
        const dummyRepoTask = createMockVariantAnalysisRepositoryTask();
        delete dummyRepoTask.artifactUrl;

        await expect(
          variantAnalysisResultsManager.download(
            mockCredentials,
            variantAnalysisId,
            dummyRepoTask,
            variantAnalysisStoragePath,
          ),
        ).rejects.toThrow("Missing artifact URL");
      });
    });

    describe("when the artifact_url is present", () => {
      let arrayBuffer: ArrayBuffer;

      let getVariantAnalysisRepoResultStub: jest.SpiedFunction<
        typeof ghApiClient.getVariantAnalysisRepoResult
      >;

      beforeEach(async () => {
        const sourceFilePath = join(
          __dirname,
          "../../../../src/vscode-tests/cli-integration/data/variant-analysis-results.zip",
        );
        arrayBuffer = fs.readFileSync(sourceFilePath).buffer;

        getVariantAnalysisRepoResultStub = jest
          .spyOn(ghApiClient, "getVariantAnalysisRepoResult")
          .mockImplementation(
            (_credentials: Credentials, downloadUrl: string) => {
              if (downloadUrl === dummyRepoTask.artifactUrl) {
                return Promise.resolve(arrayBuffer);
              }
              return Promise.reject(new Error("Unexpected artifact URL"));
            },
          );
      });

      it("should call the API to download the results", async () => {
        await variantAnalysisResultsManager.download(
          mockCredentials,
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath,
        );

        expect(getVariantAnalysisRepoResultStub).toHaveBeenCalledTimes(1);
      });

      it("should save the results zip file to disk", async () => {
        await variantAnalysisResultsManager.download(
          mockCredentials,
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath,
        );

        expect(fs.existsSync(`${repoTaskStorageDirectory}/results.zip`)).toBe(
          true,
        );
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
        ).toBe(true);
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
          ).toBe(true);
        });
      });
    });
  });

  describe("loadResults", () => {
    let dummyRepoTask: VariantAnalysisRepositoryTask;
    let variantAnalysisStoragePath: string;
    let repoTaskStorageDirectory: string;
    let variantAnalysisResultsManager: VariantAnalysisResultsManager;
    let onResultLoadedSpy: jest.Mock<
      void,
      [VariantAnalysisScannedRepositoryResult]
    >;

    beforeEach(() => {
      variantAnalysisResultsManager = new VariantAnalysisResultsManager(
        cli,
        extLogger,
      );
      onResultLoadedSpy = jest.fn();
      variantAnalysisResultsManager.onResultLoaded(onResultLoadedSpy);

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
      if (await fs.pathExists(variantAnalysisStoragePath)) {
        await fs.remove(variantAnalysisStoragePath);
      }
    });

    describe("when results are not downloaded", () => {
      it("should reject when results are not cached", async () => {
        await expect(
          variantAnalysisResultsManager.loadResults(
            variantAnalysisId,
            variantAnalysisStoragePath,
            dummyRepoTask.repository.fullName,
          ),
        ).rejects.toThrow("Variant analysis results not downloaded");
      });
    });

    describe("when the repo task has been written to disk", () => {
      beforeEach(async () => {
        await fs.outputJson(
          path.join(repoTaskStorageDirectory, "repo_task.json"),
          dummyRepoTask,
        );
      });

      describe("when the results are not downloaded", () => {
        it("should reject when results are not cached", async () => {
          await expect(
            variantAnalysisResultsManager.loadResults(
              variantAnalysisId,
              variantAnalysisStoragePath,
              dummyRepoTask.repository.fullName,
            ),
          ).rejects.toThrow("Missing results file");
        });
      });

      describe("when the SARIF results are downloaded", () => {
        beforeEach(async () => {
          await fs.outputJson(
            path.join(repoTaskStorageDirectory, "results/results.sarif"),
            await fs.readJson(
              path.resolve(
                __dirname,
                "../../no-workspace/data/sarif/validSarif.sarif",
              ),
            ),
          );
        });

        it("should return the results when not cached", async () => {
          await expect(
            variantAnalysisResultsManager.loadResults(
              variantAnalysisId,
              variantAnalysisStoragePath,
              dummyRepoTask.repository.fullName,
            ),
          ).resolves.toHaveProperty("interpretedResults");

          expect(onResultLoadedSpy).toHaveBeenCalledTimes(1);
          expect(onResultLoadedSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              variantAnalysisId,
              repositoryId: dummyRepoTask.repository.id,
            }),
          );
        });

        it("should return the results when cached", async () => {
          // Load into cache
          await variantAnalysisResultsManager.loadResults(
            variantAnalysisId,
            variantAnalysisStoragePath,
            dummyRepoTask.repository.fullName,
          );

          onResultLoadedSpy.mockClear();

          // Delete the directory so it can't read from disk
          await fs.remove(variantAnalysisStoragePath);

          await expect(
            variantAnalysisResultsManager.loadResults(
              variantAnalysisId,
              variantAnalysisStoragePath,
              dummyRepoTask.repository.fullName,
            ),
          ).resolves.toHaveProperty("interpretedResults");

          expect(onResultLoadedSpy).toHaveBeenCalledTimes(1);
          expect(onResultLoadedSpy).toHaveBeenCalledWith(
            expect.objectContaining({
              variantAnalysisId,
              repositoryId: dummyRepoTask.repository.id,
            }),
          );
        });

        it("should not cache when skipCacheStore is given", async () => {
          await variantAnalysisResultsManager.loadResults(
            variantAnalysisId,
            variantAnalysisStoragePath,
            dummyRepoTask.repository.fullName,
            {
              skipCacheStore: true,
            },
          );

          // Delete the directory so it can't read from disk
          await fs.remove(variantAnalysisStoragePath);

          await expect(
            variantAnalysisResultsManager.loadResults(
              variantAnalysisId,
              variantAnalysisStoragePath,
              dummyRepoTask.repository.fullName,
            ),
          ).rejects.toThrow("Variant analysis results not downloaded");

          expect(onResultLoadedSpy).not.toHaveBeenCalled();
        });

        it("should use cache when skipCacheStore is given", async () => {
          // Load into cache
          await variantAnalysisResultsManager.loadResults(
            variantAnalysisId,
            variantAnalysisStoragePath,
            dummyRepoTask.repository.fullName,
          );

          // Delete the directory so it can't read from disk
          await fs.remove(variantAnalysisStoragePath);

          await expect(
            variantAnalysisResultsManager.loadResults(
              variantAnalysisId,
              variantAnalysisStoragePath,
              dummyRepoTask.repository.fullName,
              {
                skipCacheStore: true,
              },
            ),
          ).resolves.toHaveProperty("interpretedResults");
        });
      });
    });
  });
});
