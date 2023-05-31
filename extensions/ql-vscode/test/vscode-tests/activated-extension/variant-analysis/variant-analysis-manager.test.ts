import {
  commands,
  env,
  TextDocument,
  TextEditor,
  Uri,
  window,
  workspace,
} from "vscode";
import { extLogger } from "../../../../src/common";
import * as ghApiClient from "../../../../src/variant-analysis/gh-api/gh-api-client";
import * as ghActionsApiClient from "../../../../src/variant-analysis/gh-api/gh-actions-api-client";
import * as fs from "fs-extra";
import { join } from "path";
import { Readable } from "stream";
import * as fetchModule from "node-fetch";
import { Response } from "node-fetch";

import { VariantAnalysisManager } from "../../../../src/variant-analysis/variant-analysis-manager";
import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { getActivatedExtension, storagePath } from "../../global.helper";
import { VariantAnalysisResultsManager } from "../../../../src/variant-analysis/variant-analysis-results-manager";
import { createMockVariantAnalysis } from "../../../factories/variant-analysis/shared/variant-analysis";
import * as VariantAnalysisModule from "../../../../src/variant-analysis/shared/variant-analysis";
import {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisScannedRepositoryState,
  VariantAnalysisStatus,
} from "../../../../src/variant-analysis/shared/variant-analysis";
import {
  createMockScannedRepo,
  createMockScannedRepos,
} from "../../../factories/variant-analysis/shared/scanned-repositories";
import { createMockVariantAnalysisRepoTask } from "../../../factories/variant-analysis/gh-api/variant-analysis-repo-task";
import { VariantAnalysisRepoTask } from "../../../../src/variant-analysis/gh-api/variant-analysis";
import { SortKey } from "../../../../src/pure/variant-analysis-filter-sort";
import { DbManager } from "../../../../src/databases/db-manager";
import { App } from "../../../../src/common/app";
import { ExtensionApp } from "../../../../src/common/vscode/vscode-app";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
import { mockedObject } from "../../utils/mocking.helpers";
import {
  REPO_STATES_FILENAME,
  writeRepoStates,
} from "../../../../src/variant-analysis/repo-states-store";
import { permissiveFilterSortState } from "../../../unit-tests/variant-analysis-filter-sort.test";
import { createTimestampFile } from "../../../../src/pure/helpers-pure";

// up to 3 minutes per test
jest.setTimeout(3 * 60 * 1000);

describe("Variant Analysis Manager", () => {
  let app: App;
  let variantAnalysisManager: VariantAnalysisManager;
  let variantAnalysisResultsManager: VariantAnalysisResultsManager;
  let variantAnalysis: VariantAnalysis;
  let scannedRepos: VariantAnalysisScannedRepository[];

  beforeEach(async () => {
    jest.spyOn(extLogger, "log").mockResolvedValue(undefined);

    scannedRepos = createMockScannedRepos();
    variantAnalysis = createMockVariantAnalysis({
      status: VariantAnalysisStatus.InProgress,
      scannedRepos,
    });

    const extension = await getActivatedExtension();
    const cli = mockedObject<CodeQLCliServer>({});
    app = new ExtensionApp(extension.ctx);
    const dbManager = new DbManager(app, new DbConfigStore(app));
    variantAnalysisResultsManager = new VariantAnalysisResultsManager(
      cli,
      extLogger,
    );
    variantAnalysisManager = new VariantAnalysisManager(
      extension.ctx,
      app,
      cli,
      storagePath,
      variantAnalysisResultsManager,
      dbManager,
    );
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
        await writeRepoStates(
          join(
            storagePath,
            variantAnalysis.id.toString(),
            REPO_STATES_FILENAME,
          ),
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
    let getVariantAnalysisRepoStub: jest.SpiedFunction<
      typeof ghApiClient.getVariantAnalysisRepo
    >;
    let getVariantAnalysisRepoResultStub: jest.SpiedFunction<
      typeof fetchModule.default
    >;

    let repoStatesPath: string;

    beforeEach(async () => {
      getVariantAnalysisRepoStub = jest.spyOn(
        ghApiClient,
        "getVariantAnalysisRepo",
      );
      getVariantAnalysisRepoResultStub = jest.spyOn(fetchModule, "default");

      repoStatesPath = join(
        storagePath,
        variantAnalysis.id.toString(),
        REPO_STATES_FILENAME,
      );
    });

    describe("when the artifact_url is missing", () => {
      beforeEach(async () => {
        const dummyRepoTask = createMockVariantAnalysisRepoTask();
        delete dummyRepoTask.artifact_url;

        getVariantAnalysisRepoStub.mockResolvedValue(dummyRepoTask);
      });

      it("should not try to download the result", async () => {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
        );

        expect(getVariantAnalysisRepoResultStub).not.toHaveBeenCalled();
      });
    });

    describe("when the artifact_url is present", () => {
      let dummyRepoTask: VariantAnalysisRepoTask;

      beforeEach(async () => {
        dummyRepoTask = createMockVariantAnalysisRepoTask();

        getVariantAnalysisRepoStub.mockResolvedValue(dummyRepoTask);

        const sourceFilePath = join(
          __dirname,
          "data/variant-analysis-results.zip",
        );
        const fileContents = fs.readFileSync(sourceFilePath);
        const response = new Response(Readable.from(fileContents));
        response.size = fileContents.length;
        getVariantAnalysisRepoResultStub.mockResolvedValue(response);
      });

      it("should fetch a repo task", async () => {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
        );

        expect(getVariantAnalysisRepoStub).toHaveBeenCalled();
      });

      it("should fetch a repo result", async () => {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
        );

        expect(getVariantAnalysisRepoResultStub).toHaveBeenCalled();
      });

      it("should skip the download if the repository has already been downloaded", async () => {
        // First, do a download so it is downloaded. This avoids having to mock the repo states.
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
        );

        getVariantAnalysisRepoStub.mockClear();

        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
        );

        expect(getVariantAnalysisRepoStub).not.toHaveBeenCalled();
      });

      it("should write the repo state when the download is successful", async () => {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
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
          ),
        ).rejects.toThrow();

        await expect(fs.pathExists(repoStatesPath)).resolves.toBe(false);

        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[1],
          variantAnalysis,
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
          ),
        ).rejects.toThrow();

        await expect(fs.pathExists(repoStatesPath)).resolves.toBe(false);

        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[1],
          variantAnalysis,
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
    it("should pop download tasks off the queue", async () => {
      const getResultsSpy = jest
        .spyOn(variantAnalysisManager, "autoDownloadVariantAnalysisResult")
        .mockResolvedValue(undefined);

      await variantAnalysisManager.enqueueDownload(
        scannedRepos[0],
        variantAnalysis,
      );
      await variantAnalysisManager.enqueueDownload(
        scannedRepos[1],
        variantAnalysis,
      );
      await variantAnalysisManager.enqueueDownload(
        scannedRepos[2],
        variantAnalysis,
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
            "codeQL.monitorRehydratedVariantAnalysis",
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
        app.credentials,
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

      it("should be valid JSON when put in object", async () => {
        await variantAnalysisManager.copyRepoListToClipboard(
          variantAnalysis.id,
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

      it("should use the sort key", async () => {
        await variantAnalysisManager.copyRepoListToClipboard(
          variantAnalysis.id,
          {
            ...permissiveFilterSortState,
            sortKey: SortKey.NumberOfResults,
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
            ...permissiveFilterSortState,
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
        .mockResolvedValue(mockedObject<TextEditor>({}));
      openTextDocumentSpy = jest
        .spyOn(workspace, "openTextDocument")
        .mockResolvedValue(mockedObject<TextDocument>({}));
    });

    afterEach(() => {
      fs.rmSync(variantAnalysisStorageLocation, { recursive: true });
    });

    it("opens the query text", async () => {
      await variantAnalysisManager.openQueryText(variantAnalysis.id);

      expect(openTextDocumentSpy).toHaveBeenCalledTimes(1);
      expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);

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
        .mockResolvedValue(mockedObject<TextEditor>({}));
      openTextDocumentSpy = jest
        .spyOn(workspace, "openTextDocument")
        .mockResolvedValue(mockedObject<TextDocument>({}));
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
