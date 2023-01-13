import {
  CancellationTokenSource,
  commands,
  env,
  extensions,
  QuickPickItem,
  TextDocument,
  TextEditor,
  Uri,
  window,
  workspace,
} from "vscode";
import { CodeQLExtensionInterface } from "../../../../src/extension";
import { extLogger } from "../../../../src/common";
import * as config from "../../../../src/config";
import {
  setRemoteControllerRepo,
  setRemoteRepositoryLists,
} from "../../../../src/config";
import * as ghApiClient from "../../../../src/remote-queries/gh-api/gh-api-client";
import * as ghActionsApiClient from "../../../../src/remote-queries/gh-api/gh-actions-api-client";
import { Credentials } from "../../../../src/authentication";
import * as fs from "fs-extra";
import { join } from "path";

import { VariantAnalysisManager } from "../../../../src/remote-queries/variant-analysis-manager";
import { CodeQLCliServer } from "../../../../src/cli";
import {
  fixWorkspaceReferences,
  restoreWorkspaceReferences,
  storagePath,
} from "../global.helper";
import { VariantAnalysisResultsManager } from "../../../../src/remote-queries/variant-analysis-results-manager";
import { createMockVariantAnalysis } from "../../../factories/remote-queries/shared/variant-analysis";
import * as VariantAnalysisModule from "../../../../src/remote-queries/shared/variant-analysis";
import {
  createMockScannedRepo,
  createMockScannedRepos,
} from "../../../factories/remote-queries/shared/scanned-repositories";
import {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisScannedRepositoryState,
  VariantAnalysisStatus,
} from "../../../../src/remote-queries/shared/variant-analysis";
import { createTimestampFile } from "../../../../src/helpers";
import { createMockVariantAnalysisRepoTask } from "../../../factories/remote-queries/gh-api/variant-analysis-repo-task";
import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisRepoTask,
} from "../../../../src/remote-queries/gh-api/variant-analysis";
import { createMockApiResponse } from "../../../factories/remote-queries/gh-api/variant-analysis-api-response";
import { UserCancellationException } from "../../../../src/commandRunner";
import { Repository } from "../../../../src/remote-queries/gh-api/repository";
import {
  defaultFilterSortState,
  SortKey,
} from "../../../../src/pure/variant-analysis-filter-sort";
import { DbManager } from "../../../../src/databases/db-manager";

// up to 3 minutes per test
jest.setTimeout(3 * 60 * 1000);

describe("Variant Analysis Manager", () => {
  let cli: CodeQLCliServer;
  let cancellationTokenSource: CancellationTokenSource;
  let variantAnalysisManager: VariantAnalysisManager;
  let variantAnalysisResultsManager: VariantAnalysisResultsManager;
  let dbManager: DbManager;
  let variantAnalysis: VariantAnalysis;
  let scannedRepos: VariantAnalysisScannedRepository[];

  beforeEach(async () => {
    jest.spyOn(extLogger, "log").mockResolvedValue(undefined);
    jest
      .spyOn(config, "isVariantAnalysisLiveResultsEnabled")
      .mockReturnValue(false);

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
      dbManager,
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

    const baseDir = join(__dirname, "..");
    const qlpackFileWithWorkspaceRefs = getFile(
      "data-remote-qlpack/qlpack.yml",
    ).fsPath;

    function getFile(file: string): Uri {
      return Uri.file(join(baseDir, file));
    }

    beforeEach(async () => {
      const mockCredentials = {
        getOctokit: () =>
          Promise.resolve({
            request: jest.fn(),
          }),
      } as unknown as Credentials;
      jest.spyOn(Credentials, "initialize").mockResolvedValue(mockCredentials);

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
      it("should fire the removed event if the file does not exist", async () => {
        const stub = jest.fn();
        variantAnalysisManager.onVariantAnalysisRemoved(stub);

        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(stub).toBeCalledTimes(1);
      });
    });

    describe("when the directory exists", () => {
      beforeEach(async () => {
        await fs.ensureDir(join(storagePath, variantAnalysis.id.toString()));
      });

      it("should store the variant analysis", async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(
          await variantAnalysisManager.getVariantAnalysis(variantAnalysis.id),
        ).toEqual(variantAnalysis);
      });

      it("should not error if the repo states file does not exist", async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(
          await variantAnalysisManager.getRepoStates(variantAnalysis.id),
        ).toEqual([]);
      });

      it("should read in the repo states if it exists", async () => {
        await fs.writeJson(
          join(storagePath, variantAnalysis.id.toString(), "repo_states.json"),
          {
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
          },
        );

        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

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

  describe("autoDownloadVariantAnalysisResult", () => {
    let arrayBuffer: ArrayBuffer;

    let getVariantAnalysisRepoStub: jest.SpiedFunction<
      typeof ghApiClient.getVariantAnalysisRepo
    >;
    let getVariantAnalysisRepoResultStub: jest.SpiedFunction<
      typeof ghApiClient.getVariantAnalysisRepoResult
    >;

    let repoStatesPath: string;

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
        "../data/variant-analysis-results.zip",
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

      repoStatesPath = join(
        storagePath,
        variantAnalysis.id.toString(),
        "repo_states.json",
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

        await expect(fs.readJson(repoStatesPath)).resolves.toEqual({
          [scannedRepos[0].repository.id]: {
            repositoryId: scannedRepos[0].repository.id,
            downloadStatus:
              VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
          },
        });
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

        await expect(fs.pathExists(repoStatesPath)).resolves.toBe(false);
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

        await expect(fs.pathExists(repoStatesPath)).resolves.toBe(false);

        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[1],
          variantAnalysis,
          cancellationTokenSource.token,
        );

        await expect(fs.readJson(repoStatesPath)).resolves.toEqual({
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
        });
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

        await expect(fs.pathExists(repoStatesPath)).resolves.toBe(false);

        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[1],
          variantAnalysis,
          cancellationTokenSource.token,
        );

        await expect(fs.readJson(repoStatesPath)).resolves.toEqual({
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
        });
      });

      it("should update the repo state correctly", async () => {
        await mockRepoStates({
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
        });

        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
          cancellationTokenSource.token,
        );

        await expect(fs.readJson(repoStatesPath)).resolves.toEqual({
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
        });
      });

      async function mockRepoStates(
        repoStates: Record<number, VariantAnalysisScannedRepositoryState>,
      ) {
        await fs.outputJson(repoStatesPath, repoStates);
      }
    });
  });

  describe("enqueueDownload", () => {
    beforeEach(async () => {
      const mockCredentials = {
        getOctokit: () =>
          Promise.resolve({
            request: jest.fn(),
          }),
      } as unknown as Credentials;
      jest.spyOn(Credentials, "initialize").mockResolvedValue(mockCredentials);
    });

    it("should pop download tasks off the queue", async () => {
      const getResultsSpy = jest
        .spyOn(variantAnalysisManager, "autoDownloadVariantAnalysisResult")
        .mockResolvedValue(undefined);

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
    let dummyVariantAnalysis: VariantAnalysis;

    beforeEach(async () => {
      dummyVariantAnalysis = createMockVariantAnalysis({});

      removeAnalysisResultsStub = jest
        .spyOn(variantAnalysisResultsManager, "removeAnalysisResults")
        .mockReturnValue(undefined);
    });

    it("should remove variant analysis", async () => {
      await fs.ensureDir(join(storagePath, dummyVariantAnalysis.id.toString()));

      await variantAnalysisManager.rehydrateVariantAnalysis(
        dummyVariantAnalysis,
      );
      expect(variantAnalysisManager.variantAnalysesSize).toBe(1);

      await variantAnalysisManager.removeVariantAnalysis(dummyVariantAnalysis);

      expect(removeAnalysisResultsStub).toBeCalledTimes(1);
      expect(variantAnalysisManager.variantAnalysesSize).toBe(0);

      await expect(
        fs.pathExists(join(storagePath, dummyVariantAnalysis.id.toString())),
      ).resolves.toBe(false);
    });
  });

  describe("rehydrateVariantAnalysis", () => {
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

    let mockCredentials: Credentials;

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

      mockCredentials = {
        getOctokit: () =>
          Promise.resolve({
            request: jest.fn(),
          }),
      } as unknown as Credentials;
      jest.spyOn(Credentials, "initialize").mockResolvedValue(mockCredentials);
    });

    afterEach(() => {
      fs.rmSync(variantAnalysisStorageLocation, { recursive: true });
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
        await variantAnalysisManager.cancelVariantAnalysis(variantAnalysis.id);
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

      describe("variantAnalysisReposPanel true", () => {
        beforeEach(() => {
          jest
            .spyOn(config, "isVariantAnalysisReposPanelEnabled")
            .mockReturnValue(true);
        });

        it("should be valid JSON when put in object", async () => {
          await variantAnalysisManager.copyRepoListToClipboard(
            variantAnalysis.id,
          );

          const text = writeTextStub.mock.calls[0][0];

          const parsed = JSON.parse(`${text}`);

          expect(parsed).toEqual({
            name: "new-repo-list",
            repositories: [
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

          const parsed = JSON.parse(`${text}`);

          expect(parsed).toEqual({
            name: "new-repo-list",
            repositories: [
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

          const parsed = JSON.parse(`${text}`);

          expect(parsed).toEqual({
            name: "new-repo-list",
            repositories: [scannedRepos[4].repository.fullName],
          });
        });
      });
      describe("variantAnalysisReposPanel false", () => {
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

  describe("openQueryText", () => {
    let variantAnalysis: VariantAnalysis;
    let variantAnalysisStorageLocation: string;

    let showTextDocumentSpy: jest.SpiedFunction<typeof window.showTextDocument>;
    let openTextDocumentSpy: jest.SpiedFunction<
      typeof workspace.openTextDocument
    >;

    beforeEach(async () => {
      variantAnalysis = createMockVariantAnalysis({});

      variantAnalysisStorageLocation =
        variantAnalysisManager.getVariantAnalysisStorageLocation(
          variantAnalysis.id,
        );
      await createTimestampFile(variantAnalysisStorageLocation);
      await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

      showTextDocumentSpy = jest
        .spyOn(window, "showTextDocument")
        .mockResolvedValue(undefined as unknown as TextEditor);
      openTextDocumentSpy = jest
        .spyOn(workspace, "openTextDocument")
        .mockResolvedValue(undefined as unknown as TextDocument);
    });

    afterEach(() => {
      fs.rmSync(variantAnalysisStorageLocation, { recursive: true });
    });

    it("opens the query text", async () => {
      await variantAnalysisManager.openQueryText(variantAnalysis.id);

      expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
      expect(openTextDocumentSpy).toHaveBeenCalledTimes(1);

      const uri: Uri = openTextDocumentSpy.mock.calls[0][0] as Uri;
      expect(uri.scheme).toEqual("codeql-variant-analysis");
      expect(uri.path).toEqual(variantAnalysis.query.filePath);
      const params = new URLSearchParams(uri.query);
      expect(Array.from(params.keys())).toEqual(["variantAnalysisId"]);
      expect(params.get("variantAnalysisId")).toEqual(
        variantAnalysis.id.toString(),
      );
    });
  });

  describe("openQueryFile", () => {
    let variantAnalysis: VariantAnalysis;
    let variantAnalysisStorageLocation: string;

    let showTextDocumentSpy: jest.SpiedFunction<typeof window.showTextDocument>;
    let openTextDocumentSpy: jest.SpiedFunction<
      typeof workspace.openTextDocument
    >;

    beforeEach(async () => {
      variantAnalysis = createMockVariantAnalysis({});

      variantAnalysisStorageLocation =
        variantAnalysisManager.getVariantAnalysisStorageLocation(
          variantAnalysis.id,
        );
      await createTimestampFile(variantAnalysisStorageLocation);
      await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

      showTextDocumentSpy = jest
        .spyOn(window, "showTextDocument")
        .mockResolvedValue(undefined as unknown as TextEditor);
      openTextDocumentSpy = jest
        .spyOn(workspace, "openTextDocument")
        .mockResolvedValue(undefined as unknown as TextDocument);
    });

    afterEach(() => {
      fs.rmSync(variantAnalysisStorageLocation, { recursive: true });
    });

    it("opens the query file", async () => {
      await variantAnalysisManager.openQueryFile(variantAnalysis.id);

      expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
      expect(openTextDocumentSpy).toHaveBeenCalledTimes(1);

      const filename: string = openTextDocumentSpy.mock.calls[0][0] as string;
      expect(filename).toEqual(variantAnalysis.query.filePath);
    });
  });
});
