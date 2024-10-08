import { extLogger } from "../../../../src/common/logging/vscode";
import { outputJson, pathExists, readFile, readJson, remove } from "fs-extra";
import { join, resolve } from "path";

import { VariantAnalysisResultsManager } from "../../../../src/variant-analysis/variant-analysis-results-manager";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { storagePath } from "../../global.helper";
import { faker } from "@faker-js/faker";
import { createMockVariantAnalysisRepositoryTask } from "../../../factories/variant-analysis/shared/variant-analysis-repo-tasks";
import type {
  VariantAnalysisRepositoryTask,
  VariantAnalysisScannedRepositoryResult,
} from "../../../../src/variant-analysis/shared/variant-analysis";
import { mockedObject } from "../../utils/mocking.helpers";
import { createMockVariantAnalysisConfig } from "../../../factories/config";
import { setupServer } from "msw/node";
import { http } from "msw";

jest.setTimeout(10_000);

const server = setupServer();

beforeAll(() =>
  server.listen({
    onUnhandledRequest: "error",
  }),
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe(VariantAnalysisResultsManager.name, () => {
  let variantAnalysisId: number;
  let variantAnalysisResultsManager: VariantAnalysisResultsManager;

  beforeEach(async () => {
    variantAnalysisId = faker.number.int();

    const cli = mockedObject<CodeQLCliServer>({});
    const variantAnalysisConfig = createMockVariantAnalysisConfig();
    variantAnalysisResultsManager = new VariantAnalysisResultsManager(
      cli,
      variantAnalysisConfig,
      extLogger,
    );
  });

  describe("download", () => {
    let dummyRepoTask: ReturnType<
      typeof createMockVariantAnalysisRepositoryTask
    >;
    let variantAnalysisStoragePath: string;
    let repoTaskStorageDirectory: string;

    beforeEach(async () => {
      jest.spyOn(extLogger, "log").mockResolvedValue(undefined);

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
      if (await pathExists(variantAnalysisStoragePath)) {
        await remove(variantAnalysisStoragePath);
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
        const dummyRepoTask: VariantAnalysisRepositoryTask =
          createMockVariantAnalysisRepositoryTask();
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
      let fileContents: Buffer;
      let artifactRequest: Request | undefined;

      beforeEach(async () => {
        const sourceFilePath = join(
          __dirname,
          "data/variant-analysis-results.zip",
        );
        fileContents = await readFile(sourceFilePath);

        artifactRequest = undefined;

        server.resetHandlers(
          http.get(dummyRepoTask.artifactUrl, ({ request }) => {
            if (artifactRequest) {
              throw new Error("Unexpected artifact request");
            }

            artifactRequest = request;

            return new Response(fileContents);
          }),
        );
      });

      it("should call the API to download the results", async () => {
        await variantAnalysisResultsManager.download(
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath,
          () => Promise.resolve(),
        );

        expect(artifactRequest).not.toBeUndefined();
      });

      it("should save the results zip file to disk", async () => {
        await variantAnalysisResultsManager.download(
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath,
          () => Promise.resolve(),
        );

        expect(
          await pathExists(`${repoTaskStorageDirectory}/results.zip`),
        ).toBe(true);
      });

      it("should unzip the results in a `results/` folder", async () => {
        await variantAnalysisResultsManager.download(
          variantAnalysisId,
          dummyRepoTask,
          variantAnalysisStoragePath,
          () => Promise.resolve(),
        );

        expect(
          await pathExists(`${repoTaskStorageDirectory}/results/results.sarif`),
        ).toBe(true);
      });

      it("should report download progress", async () => {
        server.resetHandlers(
          http.get(dummyRepoTask.artifactUrl, () => {
            // This generates a "fake" stream which "downloads" the file in 5 chunks,
            // rather than in 1 chunk. This is used for testing that we actually get
            // multiple progress reports.
            const stream = new ReadableStream({
              start(controller) {
                const partLength = fileContents.length / 5;
                for (let i = 0; i < 5; i++) {
                  controller.enqueue(
                    fileContents.subarray(i * partLength, (i + 1) * partLength),
                  );
                }
                controller.close();
              },
            });

            return new Response(stream, {
              headers: {
                "Content-Length": fileContents.length.toString(),
              },
            });
          }),
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
    let onResultLoadedSpy: jest.Mock<
      void,
      [VariantAnalysisScannedRepositoryResult]
    >;

    beforeEach(() => {
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
      if (await pathExists(variantAnalysisStoragePath)) {
        await remove(variantAnalysisStoragePath);
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
        await outputJson(
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
          await outputJson(
            join(repoTaskStorageDirectory, "results/results.sarif"),
            await readJson(
              resolve(__dirname, "../../../data/sarif/validSarif.sarif"),
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
          await remove(variantAnalysisStoragePath);

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
          await remove(variantAnalysisStoragePath);

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
          await remove(variantAnalysisStoragePath);

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
