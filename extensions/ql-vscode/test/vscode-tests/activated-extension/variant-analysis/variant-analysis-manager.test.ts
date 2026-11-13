import type { Extension, TextDocument, TextEditor, Uri } from "vscode";
import {
  commands,
  ConfigurationTarget,
  env,
  extensions,
  window,
  workspace,
} from "vscode";
import { extLogger } from "../../../../src/common/logging/vscode";
import * as ghActionsApiClient from "../../../../src/variant-analysis/gh-api/gh-actions-api-client";
import * as variantAnalysisApi from "../../../../src/variant-analysis/variant-analysis-api";
import {
  ensureDir,
  outputJson,
  pathExists,
  readFile,
  readJson,
  remove,
} from "fs-extra";
import { join } from "path";

import { VariantAnalysisManager } from "../../../../src/variant-analysis/variant-analysis-manager";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { getActivatedExtension, storagePath } from "../../global.helper";
import { VariantAnalysisResultsManager } from "../../../../src/variant-analysis/variant-analysis-results-manager";
import { createMockVariantAnalysis } from "../../../factories/variant-analysis/shared/variant-analysis";
import * as VariantAnalysisModule from "../../../../src/variant-analysis/shared/variant-analysis";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisScannedRepositoryState,
} from "../../../../src/variant-analysis/shared/variant-analysis";
import {
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisStatus,
} from "../../../../src/variant-analysis/shared/variant-analysis";
import {
  createMockScannedRepo,
  createMockScannedRepos,
} from "../../../factories/variant-analysis/shared/scanned-repositories";
import { createTimestampFile } from "../../../../src/run-queries-shared";
import { createMockVariantAnalysisRepoTask } from "../../../factories/variant-analysis/gh-api/variant-analysis-repo-task";
import type { VariantAnalysisRepoTask } from "../../../../src/variant-analysis/gh-api/variant-analysis";
import { SortKey } from "../../../../src/variant-analysis/shared/variant-analysis-filter-sort";
import { DbManager } from "../../../../src/databases/db-manager";
import type { App } from "../../../../src/common/app";
import { ExtensionApp } from "../../../../src/common/vscode/extension-app";
import { DbConfigStore } from "../../../../src/databases/config/db-config-store";
import { mockedObject } from "../../utils/mocking.helpers";
import {
  REPO_STATES_FILENAME,
  writeRepoStates,
} from "../../../../src/variant-analysis/repo-states-store";
import { permissiveFilterSortState } from "../../../unit-tests/variant-analysis-filter-sort.test";
import { createMockVariantAnalysisConfig } from "../../../factories/config";
import { setupServer } from "msw/node";
import type { RequestHandler } from "msw";
import { http } from "msw";
import { getErrorMessage } from "../../../../src/common/helpers-pure";
import { createMockSubmission } from "../../../factories/variant-analysis/shared/variant-analysis-submission";
import { createMockApiResponse } from "../../../factories/variant-analysis/gh-api/variant-analysis-api-response";
import { mapVariantAnalysisFromSubmission } from "../../../../src/variant-analysis/variant-analysis-mapper";
import { VariantAnalysisMonitor } from "../../../../src/variant-analysis/variant-analysis-monitor";
import { createMockVariantAnalysisHistoryItem } from "../../../factories/query-history/variant-analysis-history-item";
import {
  readQueryHistoryFromFile,
  writeQueryHistoryToFile,
} from "../../../../src/query-history/store/query-history-store";

// up to 3 minutes per test
jest.setTimeout(3 * 60 * 1000);

const server = setupServer();

beforeAll(() =>
  server.listen({
    onUnhandledRequest: "error",
  }),
);
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let requests: Request[] = [];

beforeAll(() => {
  server.events.on("request:start", ({ request }) => {
    requests.push(request);
  });
});

beforeEach(() => {
  requests = [];
});

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
    const dbManager = new DbManager(
      app,
      new DbConfigStore(app),
      createMockVariantAnalysisConfig(),
    );
    const variantAnalysisConfig = createMockVariantAnalysisConfig();
    variantAnalysisResultsManager = new VariantAnalysisResultsManager(
      cli,
      variantAnalysisConfig,
      extLogger,
    );
    variantAnalysisManager = new VariantAnalysisManager(
      app,
      cli,
      storagePath,
      variantAnalysisResultsManager,
      dbManager,
      variantAnalysisConfig,
    );
  });

  it("runs the custom-server lifecycle through persisted history and downloaded results", async () => {
    const serverUrl = "https://mrva.example.com";
    const artifactUrl = "https://artifacts.example.com/results.zip";
    const sourceUrl = "https://source.example.com/example/repo";
    const config = workspace.getConfiguration("codeQL.variantAnalysis");
    await config.update("serverUrl", serverUrl, ConfigurationTarget.Global);
    await config.update(
      "serverTokenProvider",
      "example.provider",
      ConfigurationTarget.Global,
    );
    const token = jest.fn().mockResolvedValue("server-token");
    const activate = jest.fn().mockResolvedValue({
      getVariantAnalysisServerToken: token,
    });
    const extensionLookup = extensions.getExtension.bind(extensions);
    jest
      .spyOn(extensions, "getExtension")
      .mockImplementation((id) =>
        id === "example.provider"
          ? mockedObject<Extension<unknown>>({ isActive: false, activate })
          : extensionLookup(id),
      );
    const github = jest
      .spyOn(app.credentials, "getOctokit")
      .mockRejectedValue(
        new Error("Custom-server requests must not use GitHub authentication"),
      );
    const response = createMockApiResponse("in_progress", []);
    response.controller_repo.id = 0;
    delete response.actions_workflow_run_id;
    const task = createMockVariantAnalysisRepoTask();
    task.artifact_url = artifactUrl;
    task.repository.html_url = sourceUrl;
    const apiPath = `${serverUrl}/repositories/0/code-scanning/codeql/variant-analyses`;
    const runPath = `${apiPath}/${response.id}`;
    let polls = 0;
    server.resetHandlers(
      http.post(apiPath, () => Response.json(response)),
      http.get(runPath, () =>
        Response.json(
          ++polls === 1
            ? response
            : {
                ...response,
                status: "succeeded",
                scanned_repositories: [
                  {
                    repository: task.repository,
                    analysis_status: "succeeded",
                    result_count: 1,
                  },
                ],
              },
        ),
      ),
      http.get(`${runPath}/repositories/${task.repository.id}`, () =>
        Response.json(task),
      ),
      http.get(
        artifactUrl,
        async () =>
          new Response(
            await readFile(
              join(__dirname, "data/variant-analysis-results.zip"),
            ),
          ),
      ),
    );
    const submission = {
      ...createMockSubmission(),
      serverUrl,
      controllerRepoId: 0,
    };
    const storage = variantAnalysisManager.getVariantAnalysisStorageLocation(
      response.id,
    );
    const historyPath = join(storage, "history.json");
    const sleepTime = VariantAnalysisMonitor.sleepTime;
    VariantAnalysisMonitor.sleepTime = 1;
    const downloads: Array<Promise<void>> = [];
    jest
      .spyOn(app.commands, "execute")
      .mockImplementation(async (command, ...args) => {
        if (command === "codeQL.autoDownloadVariantAnalysisResult") {
          const [repo, run] = args as [
            VariantAnalysisScannedRepository,
            VariantAnalysis,
          ];
          const download =
            variantAnalysisManager.autoDownloadVariantAnalysisResult(repo, run);
          downloads.push(download);
          await download;
        }
      });
    try {
      const submitted = await variantAnalysisApi.submitVariantAnalysis(
        app.credentials,
        submission,
      );
      const run = mapVariantAnalysisFromSubmission(submission, submitted, []);
      await createTimestampFile(storage);
      await writeQueryHistoryToFile(
        [createMockVariantAnalysisHistoryItem({ variantAnalysis: run })],
        historyPath,
      );
      const [saved] = await readQueryHistoryFromFile(historyPath);
      if (saved.t !== "variant-analysis") {
        throw new Error("Expected persisted server run");
      }
      await variantAnalysisManager.rehydrateVariantAnalysis(
        saved.variantAnalysis,
      );
      expect(
        variantAnalysisManager.tryGetVariantAnalysis(run.id)?.serverUrl,
      ).toBe(serverUrl);
      await variantAnalysisManager.monitorVariantAnalysis(
        saved.variantAnalysis,
      );
      await Promise.all(downloads);
      expect(downloads).toHaveLength(1);
      expect(variantAnalysisManager.tryGetVariantAnalysis(run.id)?.status).toBe(
        VariantAnalysisStatus.Succeeded,
      );
      expect(variantAnalysisManager.getRepoStates(run.id)).toEqual([
        expect.objectContaining({
          downloadStatus:
            VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
        }),
      ]);
      const results = await variantAnalysisManager.loadResults(
        run.id,
        task.repository.full_name,
      );
      expect(results.interpretedResults?.length).toBeGreaterThan(0);
      expect(results.interpretedResults?.[0].fileLink.fileLinkPrefix).toBe(
        `${sourceUrl}/blob/HEAD`,
      );
      expect(
        requests.map((request) => `${request.method} ${request.url}`),
      ).toEqual([
        `POST ${apiPath}`,
        `GET ${runPath}`,
        `GET ${runPath}`,
        `GET ${runPath}/repositories/${task.repository.id}`,
        `GET ${artifactUrl}`,
      ]);
      for (const request of requests) {
        expect(request.headers.get("authorization")).toBe(
          request.url === artifactUrl ? null : "Bearer server-token",
        );
      }
      expect(activate).toHaveBeenCalled();
      expect(github).not.toHaveBeenCalled();
    } finally {
      VariantAnalysisMonitor.sleepTime = sleepTime;
      await Promise.allSettled(downloads);
      await remove(storage);
      variantAnalysisManager.dispose();
      variantAnalysisResultsManager.dispose();
    }
  });

  describe("rehydrateVariantAnalysis", () => {
    const variantAnalysis = createMockVariantAnalysis({});

    describe("when the directory does not exist", () => {
      it("should fire the removed event if the file does not exist", async () => {
        const stub = jest.fn();
        variantAnalysisManager.onVariantAnalysisRemoved(stub);

        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(stub).toHaveBeenCalledTimes(1);
      });
    });

    describe("when the directory exists", () => {
      beforeEach(async () => {
        await ensureDir(join(storagePath, variantAnalysis.id.toString()));
      });

      it("should store the variant analysis", async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(
          variantAnalysisManager.tryGetVariantAnalysis(variantAnalysis.id),
        ).toEqual(variantAnalysis);
      });

      it("should not error if the repo states file does not exist", async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(
          variantAnalysisManager.getRepoStates(variantAnalysis.id),
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
          variantAnalysisManager.getRepoStates(variantAnalysis.id),
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
      typeof variantAnalysisApi.getVariantAnalysisRepo
    >;

    let repoStatesPath: string;

    beforeEach(async () => {
      getVariantAnalysisRepoStub = jest.spyOn(
        variantAnalysisApi,
        "getVariantAnalysisRepo",
      );

      repoStatesPath = join(
        storagePath,
        variantAnalysis.id.toString(),
        REPO_STATES_FILENAME,
      );
    });

    describe("when the artifact_url is missing", () => {
      beforeEach(async () => {
        const dummyRepoTask: VariantAnalysisRepoTask =
          createMockVariantAnalysisRepoTask();
        delete dummyRepoTask.artifact_url;

        getVariantAnalysisRepoStub.mockResolvedValue(dummyRepoTask);
      });

      it("should not try to download the result", async () => {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
        );

        expect(requests).toEqual([]);
      });
    });

    describe("when the artifact_url is present", () => {
      let dummyRepoTask: ReturnType<typeof createMockVariantAnalysisRepoTask>;
      let handlers: RequestHandler[];

      beforeEach(async () => {
        dummyRepoTask = createMockVariantAnalysisRepoTask();

        getVariantAnalysisRepoStub.mockResolvedValue(dummyRepoTask);

        handlers = [
          http.get(dummyRepoTask.artifact_url, async () => {
            const sourceFilePath = join(
              __dirname,
              "data/variant-analysis-results.zip",
            );
            const fileContents = await readFile(sourceFilePath);
            return new Response(fileContents);
          }),
        ];
        server.resetHandlers(...handlers);
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

        expect(requests).toHaveLength(1);
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

        await expect(readJson(repoStatesPath)).resolves.toEqual({
          [scannedRepos[0].repository.id]: {
            repositoryId: scannedRepos[0].repository.id,
            downloadStatus:
              VariantAnalysisScannedRepositoryDownloadStatus.Succeeded,
          },
        });
      });

      it("should not write the repo state when the download fails", async () => {
        server.resetHandlers(
          http.get(dummyRepoTask.artifact_url, async () => {
            return new Response(JSON.stringify({}), { status: 500 });
          }),
        );

        await expect(
          variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
          ),
        ).rejects.toThrow();

        await expect(pathExists(repoStatesPath)).resolves.toBe(false);
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

        await expect(pathExists(repoStatesPath)).resolves.toBe(false);

        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[1],
          variantAnalysis,
        );

        await expect(readJson(repoStatesPath)).resolves.toEqual({
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
        server.resetHandlers(
          http.get(dummyRepoTask.artifact_url, async () => {
            return new Response(JSON.stringify({}), { status: 500 });
          }),
        );

        await expect(
          variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
          ),
        ).rejects.toThrow();

        await expect(pathExists(repoStatesPath)).resolves.toBe(false);

        server.resetHandlers(...handlers);

        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[1],
          variantAnalysis,
        );

        await expect(readJson(repoStatesPath)).resolves.toEqual({
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

        await expect(readJson(repoStatesPath)).resolves.toEqual({
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
        await outputJson(repoStatesPath, repoStates);
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
      expect(getResultsSpy).toHaveBeenCalledTimes(3);
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
      await ensureDir(join(storagePath, dummyVariantAnalysis.id.toString()));

      await variantAnalysisManager.rehydrateVariantAnalysis(
        dummyVariantAnalysis,
      );
      expect(variantAnalysisManager.variantAnalysesSize).toBe(1);

      await variantAnalysisManager.removeVariantAnalysis(dummyVariantAnalysis);

      expect(removeAnalysisResultsStub).toHaveBeenCalledTimes(1);
      expect(variantAnalysisManager.variantAnalysesSize).toBe(0);

      await expect(
        pathExists(join(storagePath, dummyVariantAnalysis.id.toString())),
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

      afterEach(async () => {
        await remove(variantAnalysisStorageLocation);
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

    afterEach(async () => {
      await remove(variantAnalysisStorageLocation);
    });

    it("should return early if the variant analysis is not found", async () => {
      try {
        await variantAnalysisManager.cancelVariantAnalysis(
          variantAnalysis.id + 100,
        );
      } catch (error) {
        expect(getErrorMessage(error)).toBe(
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
      } catch (error) {
        expect(getErrorMessage(error)).toBe(
          `No workflow run id for variant analysis with id: ${variantAnalysis.id}`,
        );
      }
    });

    it("should make API request to cancel if valid", async () => {
      await variantAnalysisManager.cancelVariantAnalysis(variantAnalysis.id);

      expect(mockCancelVariantAnalysis).toHaveBeenCalledWith(
        app.credentials,
        variantAnalysis,
      );
    });

    it("delegates custom-server logs without requiring a workflow ID", async () => {
      const openLogs = jest
        .spyOn(variantAnalysisApi, "openServerVariantAnalysisLogs")
        .mockResolvedValue(undefined);
      const serverRun = {
        ...variantAnalysis,
        serverUrl: "https://mrva.example.com",
        actionsWorkflowRunId: undefined,
      };
      await variantAnalysisManager.onVariantAnalysisUpdated(serverRun);
      await variantAnalysisManager.openVariantAnalysisLogs(serverRun.id);
      expect(openLogs).toHaveBeenCalledWith(serverRun);
    });

    it("opens the GitHub workflow URL for GitHub logs", async () => {
      const open = jest
        .spyOn(commands, "executeCommand")
        .mockResolvedValue(undefined);
      await variantAnalysisManager.openVariantAnalysisLogs(variantAnalysis.id);
      expect(open).toHaveBeenCalledWith(
        "vscode.open",
        expect.objectContaining({
          path: `/${variantAnalysis.controllerRepo.fullName}/actions/runs/${variantAnalysis.actionsWorkflowRunId}`,
        }),
      );
    });

    it("allows custom-server cancellation without an Actions workflow run ID", async () => {
      const cancel = jest
        .spyOn(variantAnalysisApi, "cancelVariantAnalysis")
        .mockResolvedValue(undefined);
      const serverRun = {
        ...variantAnalysis,
        serverUrl: "https://mrva.example.com",
        actionsWorkflowRunId: undefined,
      };
      await variantAnalysisManager.onVariantAnalysisUpdated(serverRun);
      await variantAnalysisManager.cancelVariantAnalysis(serverRun.id);
      expect(cancel).toHaveBeenCalledWith(app.credentials, serverRun);
      expect(mockCancelVariantAnalysis).not.toHaveBeenCalled();
    });

    it("should set the status to canceling", async () => {
      await variantAnalysisManager.cancelVariantAnalysis(variantAnalysis.id);

      const updatedAnalysis = variantAnalysisManager.tryGetVariantAnalysis(
        variantAnalysis.id,
      );
      expect(updatedAnalysis?.status).toBe(VariantAnalysisStatus.Canceling);
    });

    it("should set the status back to in progress if canceling fails", async () => {
      mockCancelVariantAnalysis.mockRejectedValueOnce(
        new Error("Error when cancelling"),
      );

      await expect(
        variantAnalysisManager.cancelVariantAnalysis(variantAnalysis.id),
      ).rejects.toThrow("Error when cancelling");

      const updatedAnalysis = variantAnalysisManager.tryGetVariantAnalysis(
        variantAnalysis.id,
      );
      expect(updatedAnalysis?.status).toBe(VariantAnalysisStatus.InProgress);
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

    afterEach(async () => {
      await remove(variantAnalysisStorageLocation);
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

        expect(writeTextStub).not.toHaveBeenCalled();
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

        expect(writeTextStub).not.toHaveBeenCalled();
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

        expect(writeTextStub).toHaveBeenCalledTimes(1);
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

    afterEach(async () => {
      await remove(variantAnalysisStorageLocation);
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

    afterEach(async () => {
      await remove(variantAnalysisStorageLocation);
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
