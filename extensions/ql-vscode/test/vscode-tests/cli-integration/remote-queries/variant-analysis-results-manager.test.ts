import { extensions } from "vscode";
import { CodeQLExtensionInterface } from "../../../../src/extension";
import { extLogger } from "../../../../src/common";
import * as fs from "fs-extra";
import { join, resolve } from "path";
import { Readable } from "stream";
import { Response, RequestInfo, RequestInit } from "node-fetch";
import * as fetchModule from "node-fetch";

import { VariantAnalysisResultsManager } from "../../../../src/remote-queries/variant-analysis-results-manager";
import { CodeQLCliServer } from "../../../../src/cli";
import { storagePath } from "../global.helper";
import { faker } from "@faker-js/faker";
import { createMockVariantAnalysisRepositoryTask } from "../../../factories/remote-queries/shared/variant-analysis-repo-tasks";
import {
  VariantAnalysisRepositoryTask,
  VariantAnalysisScannedRepositoryResult,
} from "../../../../src/remote-queries/shared/variant-analysis";

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
    let dummyRepoTask: VariantAnalysisRepositoryTask;
    let variantAnalysisStoragePath: string;
    let repoTaskStorageDirectory: string;
    let variantAnalysisResultsManager: VariantAnalysisResultsManager;

    beforeEach(async () => {
      jest.spyOn(extLogger, "log").mockResolvedValue(undefined);

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
            variantAnalysisId,
            dummyRepoTask,
            variantAnalysisStoragePath,
            () => Promise.resolve(),
          ),
        ).rejects.toThrow("Missing artifact URL");
      });
    });

    describe("when the artifact_url is present", () => {
      let getVariantAnalysisRepoResultStub: jest.SpiedFunction<
        typeof fetchModule.default
      >;
      let fileContents: Buffer;

      beforeEach(async () => {
        const sourceFilePath = join(
          __dirname,
          "../data/variant-analysis-results.zip",
        );
        fileContents = fs.readFileSync(sourceFilePath);

        getVariantAnalysisRepoResultStub = jest
          .spyOn(fetchModule, "default")
          .mockImplementation((url: RequestInfo, _init?: RequestInit) => {
            if (url === dummyRepoTask.artifactUrl) {
              return Promise.resolve(new Response(Readable.from(fileContents)));
            }
            return Promise.reject(new Error("Unexpected artifact URL"));
          });
      });

      it("should call the API to download the results", async () => {
        await variantAnalysisResultsManager.download(
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath,
          () => Promise.resolve(),
        );

        expect(getVariantAnalysisRepoResultStub).toHaveBeenCalledTimes(1);
      });

      it("should save the results zip file to disk", async () => {
        await variantAnalysisResultsManager.download(
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath,
          () => Promise.resolve(),
        );

        expect(fs.existsSync(`${repoTaskStorageDirectory}/results.zip`)).toBe(
          true,
        );
      });

      it("should unzip the results in a `results/` folder", async () => {
        await variantAnalysisResultsManager.download(
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath,
          () => Promise.resolve(),
        );

        expect(
          fs.existsSync(`${repoTaskStorageDirectory}/results/results.sarif`),
        ).toBe(true);
      });

      it("should report download progress", async () => {
        // This generates a "fake" stream which "downloads" the file in 5 chunks,
        // rather than in 1 chunk. This is used for testing that we actually get
        // multiple progress reports.
        async function* generateInParts() {
          const partLength = fileContents.length / 5;
          for (let i = 0; i < 5; i++) {
            yield fileContents.slice(i * partLength, (i + 1) * partLength);
          }
        }

        getVariantAnalysisRepoResultStub.mockImplementation(
          (url: RequestInfo, _init?: RequestInit) => {
            if (url === dummyRepoTask.artifactUrl) {
              const response = new Response(Readable.from(generateInParts()));
              response.size = fileContents.length;
              return Promise.resolve(response);
            }
            return Promise.reject(new Error("Unexpected artifact URL"));
          },
        );

        const downloadPercentageChanged = jest
          .fn()
          .mockResolvedValue(undefined);

        await variantAnalysisResultsManager.download(
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath,
          downloadPercentageChanged,
        );

        expect(downloadPercentageChanged).toHaveBeenCalledTimes(5);
        expect(downloadPercentageChanged).toHaveBeenCalledWith(20);
        expect(downloadPercentageChanged).toHaveBeenCalledWith(40);
        expect(downloadPercentageChanged).toHaveBeenCalledWith(60);
        expect(downloadPercentageChanged).toHaveBeenCalledWith(80);
        expect(downloadPercentageChanged).toHaveBeenCalledWith(100);
      });

      describe("isVariantAnalysisRepoDownloaded", () => {
        it("should return true once results are downloaded", async () => {
          await variantAnalysisResultsManager.download(
            variantAnalysisId,
            dummyRepoTask,
            variantAnalysisStoragePath,
            () => Promise.resolve(),
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
          join(repoTaskStorageDirectory, "repo_task.json"),
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
            join(repoTaskStorageDirectory, "results/results.sarif"),
            await fs.readJson(
              resolve(
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
