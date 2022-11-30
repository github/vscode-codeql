import {
  CancellationTokenSource,
  commands,
  env,
  extensions,
  QuickPickItem,
  Uri,
  window,
} from "vscode";
import { CodeQLExtensionInterface } from "../../../extension";
import { extLogger } from "../../../common";
import * as config from "../../../config";
import {
  setRemoteControllerRepo,
  setRemoteRepositoryLists,
} from "../../../config";
import * as ghApiClient from "../../../remote-queries/gh-api/gh-api-client";
import * as ghActionsApiClient from "../../../remote-queries/gh-api/gh-actions-api-client";
import { Credentials } from "../../../authentication";
import * as fs from "fs-extra";
import { join } from "path";

import { VariantAnalysisManager } from "../../../remote-queries/variant-analysis-manager";
import { CodeQLCliServer } from "../../../cli";
import {
  fixWorkspaceReferences,
  restoreWorkspaceReferences,
  storagePath,
} from "../global.helper";
import { VariantAnalysisResultsManager } from "../../../remote-queries/variant-analysis-results-manager";
import { createMockVariantAnalysis } from "../../factories/remote-queries/shared/variant-analysis";
import * as VariantAnalysisModule from "../../../remote-queries/shared/variant-analysis";
import {
  createMockScannedRepo,
  createMockScannedRepos,
} from "../../factories/remote-queries/shared/scanned-repositories";
import {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisStatus,
} from "../../../remote-queries/shared/variant-analysis";
import { createTimestampFile } from "../../../helpers";
import { createMockVariantAnalysisRepoTask } from "../../factories/remote-queries/gh-api/variant-analysis-repo-task";
import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisRepoTask,
} from "../../../remote-queries/gh-api/variant-analysis";
import { createMockApiResponse } from "../../factories/remote-queries/gh-api/variant-analysis-api-response";
import { UserCancellationException } from "../../../commandRunner";
import { Repository } from "../../../remote-queries/gh-api/repository";
import {
  defaultFilterSortState,
  SortKey,
} from "../../../pure/variant-analysis-filter-sort";

// up to 3 minutes per test
jest.setTimeout(3 * 60 * 1000);

describe("Variant Analysis Manager", () => {
  let pathExistsStub: jest.SpiedFunction<typeof fs.pathExists>;
  let readJsonStub: jest.SpiedFunction<typeof fs.readJson>;
  let outputJsonStub: jest.SpiedFunction<typeof fs.outputJson>;
  let writeFileStub: jest.SpiedFunction<typeof fs.writeFile>;
  let cli: CodeQLCliServer;
  let cancellationTokenSource: CancellationTokenSource;
  let variantAnalysisManager: VariantAnalysisManager;
  let variantAnalysisResultsManager: VariantAnalysisResultsManager;
  let variantAnalysis: VariantAnalysis;
  let scannedRepos: VariantAnalysisScannedRepository[];

  beforeEach(async () => {
    pathExistsStub = jest.spyOn(fs, "pathExists");
    readJsonStub = jest.spyOn(fs, "readJson");
    outputJsonStub = jest.spyOn(fs, "outputJson").mockReturnValue(undefined);
    writeFileStub = jest.spyOn(fs, "writeFile").mockReturnValue(undefined);

    jest.spyOn(extLogger, "log").mockResolvedValue(undefined);
    jest
      .spyOn(config, "isVariantAnalysisLiveResultsEnabled")
      .mockReturnValue(false);
    jest.spyOn(fs, "mkdirSync").mockReturnValue(undefined);

    cancellationTokenSource = new CancellationTokenSource();

    scannedRepos = createMockScannedRepos();
    variantAnalysis = createMockVariantAnalysis({
      status: VariantAnalysisStatus.InProgress,
      scannedRepos,
    });

    const extension = await extensions
      .getExtension<CodeQLExtensionInterface | Record<string, never>>(
        "GitHub.vscode-codeql",
      )!
      .activate();
    cli = extension.cliServer;
    variantAnalysisResultsManager = new VariantAnalysisResultsManager(
      cli,
      extLogger,
    );
    variantAnalysisManager = new VariantAnalysisManager(
      extension.ctx,
      cli,
      storagePath,
      variantAnalysisResultsManager,
    );
  });

  describe("runVariantAnalysis", () => {
    const progress = jest.fn();
    let showQuickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
    let mockGetRepositoryFromNwo: jest.SpiedFunction<
      typeof ghApiClient.getRepositoryFromNwo
    >;
    let mockSubmitVariantAnalysis: jest.SpiedFunction<
      typeof ghApiClient.submitVariantAnalysis
    >;
    let mockApiResponse: VariantAnalysisApiResponse;
    let originalDeps: Record<string, string> | undefined;
    let executeCommandSpy: jest.SpiedFunction<typeof commands.executeCommand>;

    const baseDir = join(
      __dirname,
      "../../../../src/vscode-tests/cli-integration",
    );
    const qlpackFileWithWorkspaceRefs = getFile(
      "data-remote-qlpack/qlpack.yml",
    ).fsPath;

    function getFile(file: string): Uri {
      return Uri.file(join(baseDir, file));
    }

    beforeEach(async () => {
      writeFileStub.mockRestore();

      // Should not have asked for a language
      showQuickPickSpy = jest
        .spyOn(window, "showQuickPick")
        .mockResolvedValueOnce({
          repositories: ["github/vscode-codeql"],
        } as unknown as QuickPickItem)
        .mockResolvedValueOnce("javascript" as unknown as QuickPickItem);

      cancellationTokenSource = new CancellationTokenSource();

      const dummyRepository: Repository = {
        id: 123,
        name: "vscode-codeql",
        full_name: "github/vscode-codeql",
        private: false,
      };
      mockGetRepositoryFromNwo = jest
        .spyOn(ghApiClient, "getRepositoryFromNwo")
        .mockResolvedValue(dummyRepository);

      mockApiResponse = createMockApiResponse("in_progress");
      mockSubmitVariantAnalysis = jest
        .spyOn(ghApiClient, "submitVariantAnalysis")
        .mockResolvedValue(mockApiResponse);

      executeCommandSpy = jest.spyOn(commands, "executeCommand");

      // always run in the vscode-codeql repo
      await setRemoteControllerRepo("github/vscode-codeql");
      await setRemoteRepositoryLists({
        "vscode-codeql": ["github/vscode-codeql"],
      });

      // Only new version support `${workspace}` in qlpack.yml
      originalDeps = await fixWorkspaceReferences(
        qlpackFileWithWorkspaceRefs,
        cli,
      );
    });

    afterEach(async () => {
      await restoreWorkspaceReferences(
        qlpackFileWithWorkspaceRefs,
        originalDeps,
      );
    });

    it("should run a variant analysis that is part of a qlpack", async () => {
      const fileUri = getFile("data-remote-qlpack/in-pack.ql");

      await variantAnalysisManager.runVariantAnalysis(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(executeCommandSpy).toBeCalledWith(
        "codeQL.monitorVariantAnalysis",
        expect.objectContaining({
          id: mockApiResponse.id,
          status: VariantAnalysisStatus.InProgress,
        }),
      );

      expect(showQuickPickSpy).toBeCalledTimes(1);

      expect(mockGetRepositoryFromNwo).toBeCalledTimes(1);
      expect(mockSubmitVariantAnalysis).toBeCalledTimes(1);
    });

    it("should run a remote query that is not part of a qlpack", async () => {
      const fileUri = getFile("data-remote-no-qlpack/in-pack.ql");

      await variantAnalysisManager.runVariantAnalysis(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(executeCommandSpy).toBeCalledWith(
        "codeQL.monitorVariantAnalysis",
        expect.objectContaining({
          id: mockApiResponse.id,
          status: VariantAnalysisStatus.InProgress,
        }),
      );

      expect(mockGetRepositoryFromNwo).toBeCalledTimes(1);
      expect(mockSubmitVariantAnalysis).toBeCalledTimes(1);
    });

    it("should run a remote query that is nested inside a qlpack", async () => {
      const fileUri = getFile("data-remote-qlpack-nested/subfolder/in-pack.ql");

      await variantAnalysisManager.runVariantAnalysis(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(executeCommandSpy).toBeCalledWith(
        "codeQL.monitorVariantAnalysis",
        expect.objectContaining({
          id: mockApiResponse.id,
          status: VariantAnalysisStatus.InProgress,
        }),
      );

      expect(mockGetRepositoryFromNwo).toBeCalledTimes(1);
      expect(mockSubmitVariantAnalysis).toBeCalledTimes(1);
    });

    it("should cancel a run before uploading", async () => {
      const fileUri = getFile("data-remote-no-qlpack/in-pack.ql");

      const promise = variantAnalysisManager.runVariantAnalysis(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      cancellationTokenSource.cancel();

      await expect(promise).rejects.toThrow(UserCancellationException);
    });
  });

  describe("rehydrateVariantAnalysis", () => {
    const variantAnalysis = createMockVariantAnalysis({});

    describe("when the directory does not exist", () => {
      beforeEach(() => {
        pathExistsStub.mockImplementation(() => false);
      });

      it("should fire the removed event if the file does not exist", async () => {
        const stub = jest.fn();
        variantAnalysisManager.onVariantAnalysisRemoved(stub);

        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(stub).toBeCalledTimes(1);
        expect(pathExistsStub).toHaveBeenCalledTimes(1);
        expect(pathExistsStub).toBeCalledWith(
          join(storagePath, variantAnalysis.id.toString()),
        );
      });
    });

    describe("when the directory exists", () => {
      beforeEach(() => {
        pathExistsStub.mockImplementation(() => true);
      });

      it("should store the variant analysis", async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(
          await variantAnalysisManager.getVariantAnalysis(variantAnalysis.id),
        ).toEqual(variantAnalysis);

        expect(pathExistsStub).toBeCalledWith(
          join(storagePath, variantAnalysis.id.toString()),
        );
      });

      it("should not error if the repo states file does not exist", async () => {
        readJsonStub.mockImplementation(() =>
          Promise.reject(new Error("File does not exist")),
        );

        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(readJsonStub).toHaveBeenCalledTimes(1);
        expect(readJsonStub).toHaveBeenCalledWith(
          join(storagePath, variantAnalysis.id.toString(), "repo_states.json"),
        );
        expect(
          await variantAnalysisManager.getRepoStates(variantAnalysis.id),
        ).toEqual([]);
      });

      it("should read in the repo states if it exists", async () => {
        readJsonStub.mockImplementation(() =>
          Promise.resolve({
            [scannedRepos[0].repository.id]: {
              repositoryId: scannedRepos[0].repository.id,
              downloadStatus:
                VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
            },
            [scannedRepos[1].repository.id]: {
              repositoryId: scannedRepos[1].repository.id,
              downloadStatus:
                VariantAnalysisScannedRepositoryDownloadStatus.InProgress,
            },
          }),
        );

        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(readJsonStub).toHaveBeenCalledTimes(1);
        expect(readJsonStub).toHaveBeenCalledWith(
          join(storagePath, variantAnalysis.id.toString(), "repo_states.json"),
        );
        expect(
          await variantAnalysisManager.getRepoStates(variantAnalysis.id),
        ).toEqual(
          expect.arrayContaining([
            {
              repositoryId: scannedRepos[0].repository.id,
              downloadStatus:
                VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
            },
            {
              repositoryId: scannedRepos[1].repository.id,
              downloadStatus:
                VariantAnalysisScannedRepositoryDownloadStatus.InProgress,
            },
          ]),
        );
      });
    });
  });

  describe("when credentials are invalid", () => {
    beforeEach(async () => {
      jest
        .spyOn(Credentials, "initialize")
        .mockResolvedValue(undefined as unknown as Credentials);
    });

    it("should return early if credentials are wrong", async () => {
      try {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
          cancellationTokenSource.token,
        );
      } catch (error: any) {
        expect(error.message).toBe("Error authenticating with GitHub");
      }
    });
  });

  describe("when credentials are valid", () => {
    let arrayBuffer: ArrayBuffer;

    let getVariantAnalysisRepoStub: jest.SpiedFunction<
      typeof ghApiClient.getVariantAnalysisRepo
    >;
    let getVariantAnalysisRepoResultStub: jest.SpiedFunction<
      typeof ghApiClient.getVariantAnalysisRepoResult
    >;

    beforeEach(async () => {
      const mockCredentials = {
        getOctokit: () =>
          Promise.resolve({
            request: jest.fn(),
          }),
      } as unknown as Credentials;
      jest.spyOn(Credentials, "initialize").mockResolvedValue(mockCredentials);

      const sourceFilePath = join(
        __dirname,
        "../../../../src/vscode-tests/cli-integration/data/variant-analysis-results.zip",
      );
      arrayBuffer = fs.readFileSync(sourceFilePath).buffer;

      getVariantAnalysisRepoStub = jest.spyOn(
        ghApiClient,
        "getVariantAnalysisRepo",
      );
      getVariantAnalysisRepoResultStub = jest.spyOn(
        ghApiClient,
        "getVariantAnalysisRepoResult",
      );
    });

    describe("when the artifact_url is missing", () => {
      beforeEach(async () => {
        const dummyRepoTask = createMockVariantAnalysisRepoTask();
        delete dummyRepoTask.artifact_url;

        getVariantAnalysisRepoStub.mockResolvedValue(dummyRepoTask);
        getVariantAnalysisRepoResultStub.mockResolvedValue(arrayBuffer);
      });

      it("should not try to download the result", async () => {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
          cancellationTokenSource.token,
        );

        expect(getVariantAnalysisRepoResultStub).not.toHaveBeenCalled();
      });
    });

    describe("when the artifact_url is present", () => {
      let dummyRepoTask: VariantAnalysisRepoTask;

      beforeEach(async () => {
        dummyRepoTask = createMockVariantAnalysisRepoTask();

        getVariantAnalysisRepoStub.mockResolvedValue(dummyRepoTask);
        getVariantAnalysisRepoResultStub.mockResolvedValue(arrayBuffer);
      });

      describe("autoDownloadVariantAnalysisResult", () => {
        it("should return early if variant analysis is cancelled", async () => {
          cancellationTokenSource.cancel();

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(getVariantAnalysisRepoStub).not.toHaveBeenCalled();
        });

        it("should fetch a repo task", async () => {
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(getVariantAnalysisRepoStub).toHaveBeenCalled();
        });

        it("should fetch a repo result", async () => {
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(getVariantAnalysisRepoResultStub).toHaveBeenCalled();
        });

        it("should skip the download if the repository has already been downloaded", async () => {
          // First, do a download so it is downloaded. This avoids having to mock the repo states.
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          getVariantAnalysisRepoStub.mockClear();

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(getVariantAnalysisRepoStub).not.toHaveBeenCalled();
        });

        it("should write the repo state when the download is successful", async () => {
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(outputJsonStub).toHaveBeenCalledWith(
            join(
              storagePath,
              variantAnalysis.id.toString(),
              "repo_states.json",
            ),
            {
              [scannedRepos[0].repository.id]: {
                repositoryId: scannedRepos[0].repository.id,
                downloadStatus:
                  VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
              },
            },
          );
        });

        it("should not write the repo state when the download fails", async () => {
          getVariantAnalysisRepoResultStub.mockRejectedValue(
            new Error("Failed to download"),
          );

          await expect(
            variantAnalysisManager.autoDownloadVariantAnalysisResult(
              scannedRepos[0],
              variantAnalysis,
              cancellationTokenSource.token,
            ),
          ).rejects.toThrow();

          expect(outputJsonStub).not.toHaveBeenCalled();
        });

        it("should have a failed repo state when the repo task API fails", async () => {
          getVariantAnalysisRepoStub.mockRejectedValueOnce(
            new Error("Failed to download"),
          );

          await expect(
            variantAnalysisManager.autoDownloadVariantAnalysisResult(
              scannedRepos[0],
              variantAnalysis,
              cancellationTokenSource.token,
            ),
          ).rejects.toThrow();

          expect(outputJsonStub).not.toHaveBeenCalled();

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[1],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(outputJsonStub).toHaveBeenCalledWith(
            join(
              storagePath,
              variantAnalysis.id.toString(),
              "repo_states.json",
            ),
            {
              [scannedRepos[0].repository.id]: {
                repositoryId: scannedRepos[0].repository.id,
                downloadStatus:
                  VariantAnalysisScannedRepositoryDownloadStatus.Failed,
              },
              [scannedRepos[1].repository.id]: {
                repositoryId: scannedRepos[1].repository.id,
                downloadStatus:
                  VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
              },
            },
          );
        });

        it("should have a failed repo state when the download fails", async () => {
          getVariantAnalysisRepoResultStub.mockRejectedValueOnce(
            new Error("Failed to download"),
          );

          await expect(
            variantAnalysisManager.autoDownloadVariantAnalysisResult(
              scannedRepos[0],
              variantAnalysis,
              cancellationTokenSource.token,
            ),
          ).rejects.toThrow();

          expect(outputJsonStub).not.toHaveBeenCalled();

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[1],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(outputJsonStub).toHaveBeenCalledWith(
            join(
              storagePath,
              variantAnalysis.id.toString(),
              "repo_states.json",
            ),
            {
              [scannedRepos[0].repository.id]: {
                repositoryId: scannedRepos[0].repository.id,
                downloadStatus:
                  VariantAnalysisScannedRepositoryDownloadStatus.Failed,
              },
              [scannedRepos[1].repository.id]: {
                repositoryId: scannedRepos[1].repository.id,
                downloadStatus:
                  VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
              },
            },
          );
        });

        it("should update the repo state correctly", async () => {
          // To set some initial repo states, we need to mock the correct methods so that the repo states are read in.
          // The actual tests for these are in rehydrateVariantAnalysis, so we can just mock them here and test that
          // the methods are called.

          pathExistsStub.mockImplementation(() => true);
          // This will read in the correct repo states
          readJsonStub.mockImplementation(() =>
            Promise.resolve({
              [scannedRepos[1].repository.id]: {
                repositoryId: scannedRepos[1].repository.id,
                downloadStatus:
                  VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
              },
              [scannedRepos[2].repository.id]: {
                repositoryId: scannedRepos[2].repository.id,
                downloadStatus:
                  VariantAnalysisScannedRepositoryDownloadStatus.InProgress,
              },
            }),
          );

          await variantAnalysisManager.rehydrateVariantAnalysis(
            variantAnalysis,
          );

          expect(pathExistsStub).toBeCalledWith(
            join(storagePath, variantAnalysis.id.toString()),
          );
          expect(readJsonStub).toHaveBeenCalledTimes(1);
          expect(readJsonStub).toHaveBeenCalledWith(
            join(
              storagePath,
              variantAnalysis.id.toString(),
              "repo_states.json",
            ),
          );

          pathExistsStub.mockRestore();

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(outputJsonStub).toHaveBeenCalledWith(
            join(
              storagePath,
              variantAnalysis.id.toString(),
              "repo_states.json",
            ),
            {
              [scannedRepos[1].repository.id]: {
                repositoryId: scannedRepos[1].repository.id,
                downloadStatus:
                  VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
              },
              [scannedRepos[2].repository.id]: {
                repositoryId: scannedRepos[2].repository.id,
                downloadStatus:
                  VariantAnalysisScannedRepositoryDownloadStatus.InProgress,
              },
              [scannedRepos[0].repository.id]: {
                repositoryId: scannedRepos[0].repository.id,
                downloadStatus:
                  VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
              },
            },
          );
        });
      });

      describe("enqueueDownload", () => {
        it("should pop download tasks off the queue", async () => {
          const getResultsSpy = jest.spyOn(
            variantAnalysisManager,
            "autoDownloadVariantAnalysisResult",
          );

          await variantAnalysisManager.enqueueDownload(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );
          await variantAnalysisManager.enqueueDownload(
            scannedRepos[1],
            variantAnalysis,
            cancellationTokenSource.token,
          );
          await variantAnalysisManager.enqueueDownload(
            scannedRepos[2],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(variantAnalysisManager.downloadsQueueSize()).toBe(0);
          expect(getResultsSpy).toBeCalledTimes(3);
        });
      });

      describe("removeVariantAnalysis", () => {
        let removeAnalysisResultsStub: jest.SpiedFunction<
          typeof variantAnalysisResultsManager.removeAnalysisResults
        >;
        let removeStorageStub: jest.SpiedFunction<typeof fs.remove>;
        let dummyVariantAnalysis: VariantAnalysis;

        beforeEach(async () => {
          dummyVariantAnalysis = createMockVariantAnalysis({});

          removeAnalysisResultsStub = jest
            .spyOn(variantAnalysisResultsManager, "removeAnalysisResults")
            .mockReturnValue(undefined);

          removeStorageStub = jest
            .spyOn(fs, "remove")
            .mockReturnValue(undefined);
        });

        it("should remove variant analysis", async () => {
          pathExistsStub.mockImplementation(() => true);
          await variantAnalysisManager.rehydrateVariantAnalysis(
            dummyVariantAnalysis,
          );
          expect(pathExistsStub).toBeCalledWith(
            path.join(storagePath, dummyVariantAnalysis.id.toString()),
          );
          expect(variantAnalysisManager.variantAnalysesSize).toBe(1);

          await variantAnalysisManager.removeVariantAnalysis(
            dummyVariantAnalysis,
          );

          expect(removeAnalysisResultsStub).toBeCalledTimes(1);
          expect(removeStorageStub).toBeCalledTimes(1);
          expect(variantAnalysisManager.variantAnalysesSize).toBe(0);
        });
      });
    });
  });

  describe("when rehydrating a query", () => {
    let variantAnalysis: VariantAnalysis;
    const variantAnalysisRemovedSpy = jest.fn();
    let executeCommandSpy: jest.SpiedFunction<typeof commands.executeCommand>;

    beforeEach(() => {
      variantAnalysis = createMockVariantAnalysis({});

      variantAnalysisManager.onVariantAnalysisRemoved(
        variantAnalysisRemovedSpy,
      );

      executeCommandSpy = jest
        .spyOn(commands, "executeCommand")
        .mockResolvedValue(undefined);
    });

    describe("when variant analysis record doesn't exist", () => {
      it("should remove the variant analysis", async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);
        expect(variantAnalysisRemovedSpy).toHaveBeenCalledTimes(1);
      });

      it("should not trigger a monitoring command", async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);
        expect(executeCommandSpy).not.toHaveBeenCalled();
      });
    });

    describe("when variant analysis record does exist", () => {
      let variantAnalysisStorageLocation: string;

      beforeEach(async () => {
        variantAnalysisStorageLocation =
          variantAnalysisManager.getVariantAnalysisStorageLocation(
            variantAnalysis.id,
          );
        await createTimestampFile(variantAnalysisStorageLocation);
      });

      afterEach(() => {
        fs.rmSync(variantAnalysisStorageLocation, { recursive: true });
      });

      describe("when the variant analysis is not complete", () => {
        beforeEach(() => {
          jest
            .spyOn(VariantAnalysisModule, "isVariantAnalysisComplete")
            .mockResolvedValue(false);
        });

        it("should not remove the variant analysis", async () => {
          await variantAnalysisManager.rehydrateVariantAnalysis(
            variantAnalysis,
          );
          expect(variantAnalysisRemovedSpy).not.toHaveBeenCalled();
        });

        it("should trigger a monitoring command", async () => {
          await variantAnalysisManager.rehydrateVariantAnalysis(
            variantAnalysis,
          );
          expect(executeCommandSpy).toHaveBeenCalledWith(
            "codeQL.monitorVariantAnalysis",
            expect.anything(),
          );
        });
      });

      describe("when the variant analysis is complete", () => {
        beforeEach(() => {
          jest
            .spyOn(VariantAnalysisModule, "isVariantAnalysisComplete")
            .mockResolvedValue(true);
        });

        it("should not remove the variant analysis", async () => {
          await variantAnalysisManager.rehydrateVariantAnalysis(
            variantAnalysis,
          );
          expect(variantAnalysisRemovedSpy).not.toHaveBeenCalled();
        });

        it("should not trigger a monitoring command", async () => {
          await variantAnalysisManager.rehydrateVariantAnalysis(
            variantAnalysis,
          );
          expect(executeCommandSpy).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe("cancelVariantAnalysis", () => {
    let variantAnalysis: VariantAnalysis;
    let mockCancelVariantAnalysis: jest.SpiedFunction<
      typeof ghActionsApiClient.cancelVariantAnalysis
    >;

    let variantAnalysisStorageLocation: string;

    beforeEach(async () => {
      variantAnalysis = createMockVariantAnalysis({});

      mockCancelVariantAnalysis = jest
        .spyOn(ghActionsApiClient, "cancelVariantAnalysis")
        .mockResolvedValue(undefined);

      variantAnalysisStorageLocation =
        variantAnalysisManager.getVariantAnalysisStorageLocation(
          variantAnalysis.id,
        );
      await createTimestampFile(variantAnalysisStorageLocation);
      await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);
    });

    afterEach(() => {
      fs.rmSync(variantAnalysisStorageLocation, { recursive: true });
    });

    describe("when the credentials are invalid", () => {
      beforeEach(async () => {
        jest
          .spyOn(Credentials, "initialize")
          .mockResolvedValue(undefined as unknown as Credentials);
      });

      it("should return early", async () => {
        try {
          await variantAnalysisManager.cancelVariantAnalysis(
            variantAnalysis.id,
          );
        } catch (error: any) {
          expect(error.message).toBe("Error authenticating with GitHub");
        }
      });
    });

    describe("when the credentials are valid", () => {
      let mockCredentials: Credentials;

      beforeEach(async () => {
        mockCredentials = {
          getOctokit: () =>
            Promise.resolve({
              request: jest.fn(),
            }),
        } as unknown as Credentials;
        jest
          .spyOn(Credentials, "initialize")
          .mockResolvedValue(mockCredentials);
      });

      it("should return early if the variant analysis is not found", async () => {
        try {
          await variantAnalysisManager.cancelVariantAnalysis(
            variantAnalysis.id + 100,
          );
        } catch (error: any) {
          expect(error.message).toBe(
            `No variant analysis with id: ${variantAnalysis.id + 100}`,
          );
        }
      });

      it("should return early if the variant analysis does not have an actions workflow run id", async () => {
        await variantAnalysisManager.onVariantAnalysisUpdated({
          ...variantAnalysis,
          actionsWorkflowRunId: undefined,
        });

        try {
          await variantAnalysisManager.cancelVariantAnalysis(
            variantAnalysis.id,
          );
        } catch (error: any) {
          expect(error.message).toBe(
            `No workflow run id for variant analysis with id: ${variantAnalysis.id}`,
          );
        }
      });

      it("should return cancel if valid", async () => {
        await variantAnalysisManager.cancelVariantAnalysis(variantAnalysis.id);

        expect(mockCancelVariantAnalysis).toBeCalledWith(
          mockCredentials,
          variantAnalysis,
        );
      });
    });
  });

  describe("copyRepoListToClipboard", () => {
    let variantAnalysis: VariantAnalysis;
    let variantAnalysisStorageLocation: string;

    const writeTextStub = jest.fn();

    beforeEach(async () => {
      variantAnalysis = createMockVariantAnalysis({});

      variantAnalysisStorageLocation =
        variantAnalysisManager.getVariantAnalysisStorageLocation(
          variantAnalysis.id,
        );
      await createTimestampFile(variantAnalysisStorageLocation);
      await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

      jest.spyOn(env, "clipboard", "get").mockReturnValue({
        readText: jest.fn(),
        writeText: writeTextStub,
      });
    });

    afterEach(() => {
      fs.rmSync(variantAnalysisStorageLocation, { recursive: true });
    });

    describe("when the variant analysis does not have any repositories", () => {
      beforeEach(async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis({
          ...variantAnalysis,
          scannedRepos: [],
        });
      });

      it("should not copy any text", async () => {
        await variantAnalysisManager.copyRepoListToClipboard(
          variantAnalysis.id,
        );

        expect(writeTextStub).not.toBeCalled();
      });
    });

    describe("when the variant analysis does not have any repositories with results", () => {
      beforeEach(async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis({
          ...variantAnalysis,
          scannedRepos: [
            {
              ...createMockScannedRepo(),
              resultCount: 0,
            },
            {
              ...createMockScannedRepo(),
              resultCount: undefined,
            },
          ],
        });
      });

      it("should not copy any text", async () => {
        await variantAnalysisManager.copyRepoListToClipboard(
          variantAnalysis.id,
        );

        expect(writeTextStub).not.toBeCalled();
      });
    });

    describe("when the variant analysis has repositories with results", () => {
      const scannedRepos = [
        {
          ...createMockScannedRepo("pear"),
          resultCount: 100,
        },
        {
          ...createMockScannedRepo("apple"),
          resultCount: 0,
        },
        {
          ...createMockScannedRepo("citrus"),
          resultCount: 200,
        },
        {
          ...createMockScannedRepo("sky"),
          resultCount: undefined,
        },
        {
          ...createMockScannedRepo("banana"),
          resultCount: 5,
        },
      ];

      beforeEach(async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis({
          ...variantAnalysis,
          scannedRepos,
        });
      });

      it("should copy text", async () => {
        await variantAnalysisManager.copyRepoListToClipboard(
          variantAnalysis.id,
        );

        expect(writeTextStub).toBeCalledTimes(1);
      });

      it("should be valid JSON when put in object", async () => {
        await variantAnalysisManager.copyRepoListToClipboard(
          variantAnalysis.id,
        );

        const text = writeTextStub.mock.calls[0][0];

        const parsed = JSON.parse(`{${text}}`);

        expect(parsed).toEqual({
          "new-repo-list": [
            scannedRepos[4].repository.fullName,
            scannedRepos[2].repository.fullName,
            scannedRepos[0].repository.fullName,
          ],
        });
      });

      it("should use the sort key", async () => {
        await variantAnalysisManager.copyRepoListToClipboard(
          variantAnalysis.id,
          {
            ...defaultFilterSortState,
            sortKey: SortKey.ResultsCount,
          },
        );

        const text = writeTextStub.mock.calls[0][0];

        const parsed = JSON.parse(`{${text}}`);

        expect(parsed).toEqual({
          "new-repo-list": [
            scannedRepos[2].repository.fullName,
            scannedRepos[0].repository.fullName,
            scannedRepos[4].repository.fullName,
          ],
        });
      });

      it("should use the search value", async () => {
        await variantAnalysisManager.copyRepoListToClipboard(
          variantAnalysis.id,
          {
            ...defaultFilterSortState,
            searchValue: "ban",
          },
        );

        const text = writeTextStub.mock.calls[0][0];

        const parsed = JSON.parse(`{${text}}`);

        expect(parsed).toEqual({
          "new-repo-list": [scannedRepos[4].repository.fullName],
        });
      });
    });
  });
});
