import * as sinon from "sinon";
import { assert, expect } from "chai";
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
import { logger } from "../../../logging";
import * as config from "../../../config";
import {
  setRemoteControllerRepo,
  setRemoteRepositoryLists,
} from "../../../config";
import * as ghApiClient from "../../../remote-queries/gh-api/gh-api-client";
import * as ghActionsApiClient from "../../../remote-queries/gh-api/gh-actions-api-client";
import { Credentials } from "../../../authentication";
import * as fs from "fs-extra";
import * as path from "path";

import { VariantAnalysisManager } from "../../../remote-queries/variant-analysis-manager";
import { CliVersionConstraint, CodeQLCliServer } from "../../../cli";
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

describe("Variant Analysis Manager", async function () {
  let sandbox: sinon.SinonSandbox;
  let pathExistsStub: sinon.SinonStub;
  let readJsonStub: sinon.SinonStub;
  let outputJsonStub: sinon.SinonStub;
  let writeFileStub: sinon.SinonStub;
  let cli: CodeQLCliServer;
  let cancellationTokenSource: CancellationTokenSource;
  let variantAnalysisManager: VariantAnalysisManager;
  let variantAnalysis: VariantAnalysis;
  let scannedRepos: VariantAnalysisScannedRepository[];
  let getVariantAnalysisRepoStub: sinon.SinonStub;
  let getVariantAnalysisRepoResultStub: sinon.SinonStub;
  let variantAnalysisResultsManager: VariantAnalysisResultsManager;
  let originalDeps: Record<string, string> | undefined;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    sandbox.stub(logger, "log");
    sandbox.stub(config, "isVariantAnalysisLiveResultsEnabled").returns(false);
    sandbox.stub(fs, "mkdirSync");
    writeFileStub = sandbox.stub(fs, "writeFile");
    pathExistsStub = sandbox.stub(fs, "pathExists").callThrough();
    readJsonStub = sandbox.stub(fs, "readJson").callThrough();
    outputJsonStub = sandbox.stub(fs, "outputJson");

    cancellationTokenSource = new CancellationTokenSource();

    scannedRepos = createMockScannedRepos();
    variantAnalysis = createMockVariantAnalysis({
      status: VariantAnalysisStatus.InProgress,
      scannedRepos,
    });

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
      variantAnalysisManager = new VariantAnalysisManager(
        extension.ctx,
        cli,
        storagePath,
        variantAnalysisResultsManager,
      );
    } catch (e) {
      fail(e as Error);
    }
  });

  afterEach(async () => {
    sandbox.restore();
  });

  describe("runVariantAnalysis", function () {
    // up to 3 minutes per test
    this.timeout(3 * 60 * 1000);

    let progress: sinon.SinonSpy;
    let showQuickPickSpy: sinon.SinonStub;
    let mockGetRepositoryFromNwo: sinon.SinonStub;
    let mockSubmitVariantAnalysis: sinon.SinonStub;
    let mockApiResponse: VariantAnalysisApiResponse;
    let executeCommandSpy: sinon.SinonStub;

    const baseDir = path.join(
      __dirname,
      "../../../../src/vscode-tests/cli-integration",
    );
    const qlpackFileWithWorkspaceRefs = getFile(
      "data-remote-qlpack/qlpack.yml",
    ).fsPath;

    function getFile(file: string): Uri {
      return Uri.file(path.join(baseDir, file));
    }

    beforeEach(async function () {
      if (!(await cli.cliConstraints.supportsRemoteQueries())) {
        console.log(
          `Remote queries are not supported on CodeQL CLI v${CliVersionConstraint.CLI_VERSION_REMOTE_QUERIES}. Skipping this test.`,
        );
        this.skip();
      }

      writeFileStub.callThrough();

      progress = sandbox.spy();
      // Should not have asked for a language
      showQuickPickSpy = sandbox
        .stub(window, "showQuickPick")
        .onFirstCall()
        .resolves({
          repositories: ["github/vscode-codeql"],
        } as unknown as QuickPickItem)
        .onSecondCall()
        .resolves("javascript" as unknown as QuickPickItem);

      executeCommandSpy = sandbox
        .stub(commands, "executeCommand")
        .callThrough();

      cancellationTokenSource = new CancellationTokenSource();

      const dummyRepository: Repository = {
        id: 123,
        name: "vscode-codeql",
        full_name: "github/vscode-codeql",
        private: false,
      };
      mockGetRepositoryFromNwo = sandbox
        .stub(ghApiClient, "getRepositoryFromNwo")
        .resolves(dummyRepository);

      mockApiResponse = createMockApiResponse("in_progress");
      mockSubmitVariantAnalysis = sandbox
        .stub(ghApiClient, "submitVariantAnalysis")
        .resolves(mockApiResponse);

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

      expect(executeCommandSpy).to.have.been.calledWith(
        "codeQL.monitorVariantAnalysis",
        sinon.match
          .has("id", mockApiResponse.id)
          .and(sinon.match.has("status", VariantAnalysisStatus.InProgress)),
      );

      expect(showQuickPickSpy).to.have.been.calledOnce;

      expect(mockGetRepositoryFromNwo).to.have.been.calledOnce;
      expect(mockSubmitVariantAnalysis).to.have.been.calledOnce;
    });

    it("should run a remote query that is not part of a qlpack", async () => {
      const fileUri = getFile("data-remote-no-qlpack/in-pack.ql");

      await variantAnalysisManager.runVariantAnalysis(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(executeCommandSpy).to.have.been.calledWith(
        "codeQL.monitorVariantAnalysis",
        sinon.match
          .has("id", mockApiResponse.id)
          .and(sinon.match.has("status", VariantAnalysisStatus.InProgress)),
      );

      expect(mockGetRepositoryFromNwo).to.have.been.calledOnce;
      expect(mockSubmitVariantAnalysis).to.have.been.calledOnce;
    });

    it("should run a remote query that is nested inside a qlpack", async () => {
      const fileUri = getFile("data-remote-qlpack-nested/subfolder/in-pack.ql");

      await variantAnalysisManager.runVariantAnalysis(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      expect(executeCommandSpy).to.have.been.calledWith(
        "codeQL.monitorVariantAnalysis",
        sinon.match
          .has("id", mockApiResponse.id)
          .and(sinon.match.has("status", VariantAnalysisStatus.InProgress)),
      );

      expect(mockGetRepositoryFromNwo).to.have.been.calledOnce;
      expect(mockSubmitVariantAnalysis).to.have.been.calledOnce;
    });

    it("should cancel a run before uploading", async () => {
      const fileUri = getFile("data-remote-no-qlpack/in-pack.ql");

      const promise = variantAnalysisManager.runVariantAnalysis(
        fileUri,
        progress,
        cancellationTokenSource.token,
      );

      cancellationTokenSource.cancel();

      try {
        await promise;
        assert.fail("should have thrown");
      } catch (e) {
        expect(e).to.be.instanceof(UserCancellationException);
      }
    });
  });

  describe("rehydrateVariantAnalysis", () => {
    const variantAnalysis = createMockVariantAnalysis({});

    describe("when the directory does not exist", () => {
      beforeEach(() => {
        pathExistsStub
          .withArgs(path.join(storagePath, variantAnalysis.id.toString()))
          .resolves(false);
      });

      it("should fire the removed event if the file does not exist", async () => {
        const stub = sandbox.stub();
        variantAnalysisManager.onVariantAnalysisRemoved(stub);

        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(stub).to.have.been.calledOnce;
        sinon.assert.calledWith(
          pathExistsStub,
          path.join(storagePath, variantAnalysis.id.toString()),
        );
      });
    });

    describe("when the directory exists", () => {
      beforeEach(() => {
        pathExistsStub
          .withArgs(path.join(storagePath, variantAnalysis.id.toString()))
          .resolves(true);
      });

      it("should store the variant analysis", async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        expect(
          await variantAnalysisManager.getVariantAnalysis(variantAnalysis.id),
        ).to.deep.equal(variantAnalysis);
      });

      it("should not error if the repo states file does not exist", async () => {
        readJsonStub
          .withArgs(
            path.join(
              storagePath,
              variantAnalysis.id.toString(),
              "repo_states.json",
            ),
          )
          .rejects(new Error("File does not exist"));

        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        sinon.assert.calledWith(
          readJsonStub,
          path.join(
            storagePath,
            variantAnalysis.id.toString(),
            "repo_states.json",
          ),
        );
        expect(
          await variantAnalysisManager.getRepoStates(variantAnalysis.id),
        ).to.deep.equal([]);
      });

      it("should read in the repo states if it exists", async () => {
        readJsonStub
          .withArgs(
            path.join(
              storagePath,
              variantAnalysis.id.toString(),
              "repo_states.json",
            ),
          )
          .resolves({
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
          });

        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

        sinon.assert.calledWith(
          readJsonStub,
          path.join(
            storagePath,
            variantAnalysis.id.toString(),
            "repo_states.json",
          ),
        );
        expect(
          await variantAnalysisManager.getRepoStates(variantAnalysis.id),
        ).to.have.same.deep.members([
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
        ]);
      });
    });
  });

  describe("when credentials are invalid", async () => {
    beforeEach(async () => {
      sandbox.stub(Credentials, "initialize").resolves(undefined);
    });

    it("should return early if credentials are wrong", async () => {
      try {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
          cancellationTokenSource.token,
        );
      } catch (error: any) {
        expect(error.message).to.equal("Error authenticating with GitHub");
      }
    });
  });

  describe("when credentials are valid", async () => {
    let getOctokitStub: sinon.SinonStub;
    let arrayBuffer: ArrayBuffer;

    beforeEach(async () => {
      const mockCredentials = {
        getOctokit: () =>
          Promise.resolve({
            request: getOctokitStub,
          }),
      } as unknown as Credentials;
      sandbox.stub(Credentials, "initialize").resolves(mockCredentials);

      const sourceFilePath = path.join(
        __dirname,
        "../../../../src/vscode-tests/cli-integration/data/variant-analysis-results.zip",
      );
      arrayBuffer = fs.readFileSync(sourceFilePath).buffer;
    });

    describe("when the artifact_url is missing", async () => {
      beforeEach(async () => {
        const dummyRepoTask = createMockVariantAnalysisRepoTask();
        delete dummyRepoTask.artifact_url;

        getVariantAnalysisRepoStub = sandbox
          .stub(ghApiClient, "getVariantAnalysisRepo")
          .resolves(dummyRepoTask);
        getVariantAnalysisRepoResultStub = sandbox
          .stub(ghApiClient, "getVariantAnalysisRepoResult")
          .resolves(arrayBuffer);
      });

      it("should not try to download the result", async () => {
        await variantAnalysisManager.autoDownloadVariantAnalysisResult(
          scannedRepos[0],
          variantAnalysis,
          cancellationTokenSource.token,
        );

        expect(getVariantAnalysisRepoResultStub.notCalled).to.be.true;
      });
    });

    describe("when the artifact_url is present", async () => {
      let dummyRepoTask: VariantAnalysisRepoTask;

      beforeEach(async () => {
        dummyRepoTask = createMockVariantAnalysisRepoTask();

        getVariantAnalysisRepoStub = sandbox
          .stub(ghApiClient, "getVariantAnalysisRepo")
          .resolves(dummyRepoTask);
        getVariantAnalysisRepoResultStub = sandbox
          .stub(ghApiClient, "getVariantAnalysisRepoResult")
          .resolves(arrayBuffer);
      });

      describe("autoDownloadVariantAnalysisResult", async () => {
        it("should return early if variant analysis is cancelled", async () => {
          cancellationTokenSource.cancel();

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(getVariantAnalysisRepoStub.notCalled).to.be.true;
        });

        it("should fetch a repo task", async () => {
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(getVariantAnalysisRepoStub.calledOnce).to.be.true;
        });

        it("should fetch a repo result", async () => {
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(getVariantAnalysisRepoResultStub.calledOnce).to.be.true;
        });

        it("should skip the download if the repository has already been downloaded", async () => {
          // First, do a download so it is downloaded. This avoids having to mock the repo states.
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          getVariantAnalysisRepoStub.resetHistory();

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          expect(getVariantAnalysisRepoStub.notCalled).to.be.true;
        });

        it("should write the repo state when the download is successful", async () => {
          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          sinon.assert.calledWith(
            outputJsonStub,
            path.join(
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
          getVariantAnalysisRepoResultStub.rejects(
            new Error("Failed to download"),
          );

          try {
            await variantAnalysisManager.autoDownloadVariantAnalysisResult(
              scannedRepos[0],
              variantAnalysis,
              cancellationTokenSource.token,
            );
            fail("Expected an error to be thrown");
          } catch (e: any) {
            // we can ignore this error, we expect this
          }

          sinon.assert.notCalled(outputJsonStub);
        });

        it("should have a failed repo state when the repo task API fails", async () => {
          getVariantAnalysisRepoStub
            .onFirstCall()
            .rejects(new Error("Failed to download"));

          try {
            await variantAnalysisManager.autoDownloadVariantAnalysisResult(
              scannedRepos[0],
              variantAnalysis,
              cancellationTokenSource.token,
            );
            fail("Expected an error to be thrown");
          } catch (e) {
            // we can ignore this error, we expect this
          }

          sinon.assert.notCalled(outputJsonStub);

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[1],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          sinon.assert.calledWith(
            outputJsonStub,
            path.join(
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
          getVariantAnalysisRepoResultStub
            .onFirstCall()
            .rejects(new Error("Failed to download"));

          try {
            await variantAnalysisManager.autoDownloadVariantAnalysisResult(
              scannedRepos[0],
              variantAnalysis,
              cancellationTokenSource.token,
            );
            fail("Expected an error to be thrown");
          } catch (e) {
            // we can ignore this error, we expect this
          }

          sinon.assert.notCalled(outputJsonStub);

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[1],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          sinon.assert.calledWith(
            outputJsonStub,
            path.join(
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

          pathExistsStub
            .withArgs(path.join(storagePath, variantAnalysis.id.toString()))
            .resolves(true);
          // This will read in the correct repo states
          readJsonStub
            .withArgs(
              path.join(
                storagePath,
                variantAnalysis.id.toString(),
                "repo_states.json",
              ),
            )
            .resolves({
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

          await variantAnalysisManager.rehydrateVariantAnalysis(
            variantAnalysis,
          );
          sinon.assert.calledWith(
            readJsonStub,
            path.join(
              storagePath,
              variantAnalysis.id.toString(),
              "repo_states.json",
            ),
          );

          await variantAnalysisManager.autoDownloadVariantAnalysisResult(
            scannedRepos[0],
            variantAnalysis,
            cancellationTokenSource.token,
          );

          sinon.assert.calledWith(
            outputJsonStub,
            path.join(
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

      describe("enqueueDownload", async () => {
        it("should pop download tasks off the queue", async () => {
          const getResultsSpy = sandbox.spy(
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

          expect(variantAnalysisManager.downloadsQueueSize()).to.equal(0);
          expect(getResultsSpy).to.have.been.calledThrice;
        });
      });

      describe("removeVariantAnalysis", async () => {
        let removeAnalysisResultsStub: sinon.SinonStub;
        let removeStorageStub: sinon.SinonStub;
        let dummyVariantAnalysis: VariantAnalysis;

        beforeEach(async () => {
          dummyVariantAnalysis = createMockVariantAnalysis({});
          removeAnalysisResultsStub = sandbox.stub(
            variantAnalysisResultsManager,
            "removeAnalysisResults",
          );
          removeStorageStub = sandbox.stub(fs, "remove");
        });

        it("should remove variant analysis", async () => {
          await variantAnalysisManager.onVariantAnalysisUpdated(
            dummyVariantAnalysis,
          );
          expect(variantAnalysisManager.variantAnalysesSize).to.eq(1);

          await variantAnalysisManager.removeVariantAnalysis(
            dummyVariantAnalysis,
          );

          expect(removeAnalysisResultsStub).to.have.been.calledOnce;
          expect(removeStorageStub).to.have.been.calledOnce;
          expect(variantAnalysisManager.variantAnalysesSize).to.equal(0);
        });
      });
    });
  });

  describe("when rehydrating a query", async () => {
    let variantAnalysis: VariantAnalysis;
    let variantAnalysisRemovedSpy: sinon.SinonSpy;
    let monitorVariantAnalysisCommandSpy: sinon.SinonSpy;

    beforeEach(() => {
      variantAnalysis = createMockVariantAnalysis({});

      variantAnalysisRemovedSpy = sinon.spy();
      variantAnalysisManager.onVariantAnalysisRemoved(
        variantAnalysisRemovedSpy,
      );

      monitorVariantAnalysisCommandSpy = sinon.spy();
      sandbox
        .stub(commands, "executeCommand")
        .callsFake(monitorVariantAnalysisCommandSpy);
    });

    describe("when variant analysis record doesn't exist", async () => {
      it("should remove the variant analysis", async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);
        sinon.assert.calledOnce(variantAnalysisRemovedSpy);
      });

      it("should not trigger a monitoring command", async () => {
        await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);
        sinon.assert.notCalled(monitorVariantAnalysisCommandSpy);
      });
    });

    describe("when variant analysis record does exist", async () => {
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

      describe("when the variant analysis is not complete", async () => {
        beforeEach(() => {
          sandbox
            .stub(VariantAnalysisModule, "isVariantAnalysisComplete")
            .resolves(false);
        });

        it("should not remove the variant analysis", async () => {
          await variantAnalysisManager.rehydrateVariantAnalysis(
            variantAnalysis,
          );
          sinon.assert.notCalled(variantAnalysisRemovedSpy);
        });

        it("should trigger a monitoring command", async () => {
          await variantAnalysisManager.rehydrateVariantAnalysis(
            variantAnalysis,
          );
          sinon.assert.calledWith(
            monitorVariantAnalysisCommandSpy,
            "codeQL.monitorVariantAnalysis",
          );
        });
      });

      describe("when the variant analysis is complete", async () => {
        beforeEach(() => {
          sandbox
            .stub(VariantAnalysisModule, "isVariantAnalysisComplete")
            .resolves(true);
        });

        it("should not remove the variant analysis", async () => {
          await variantAnalysisManager.rehydrateVariantAnalysis(
            variantAnalysis,
          );
          sinon.assert.notCalled(variantAnalysisRemovedSpy);
        });

        it("should not trigger a monitoring command", async () => {
          await variantAnalysisManager.rehydrateVariantAnalysis(
            variantAnalysis,
          );
          sinon.assert.notCalled(monitorVariantAnalysisCommandSpy);
        });
      });
    });
  });

  describe("cancelVariantAnalysis", async () => {
    let variantAnalysis: VariantAnalysis;
    let mockCancelVariantAnalysis: sinon.SinonStub;
    let getOctokitStub: sinon.SinonStub;

    let variantAnalysisStorageLocation: string;

    beforeEach(async () => {
      variantAnalysis = createMockVariantAnalysis({});

      mockCancelVariantAnalysis = sandbox.stub(
        ghActionsApiClient,
        "cancelVariantAnalysis",
      );

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
        sandbox.stub(Credentials, "initialize").resolves(undefined);
      });

      it("should return early", async () => {
        try {
          await variantAnalysisManager.cancelVariantAnalysis(
            variantAnalysis.id,
          );
        } catch (error: any) {
          expect(error.message).to.equal("Error authenticating with GitHub");
        }
      });
    });

    describe("when the credentials are valid", () => {
      let mockCredentials: Credentials;

      beforeEach(async () => {
        mockCredentials = {
          getOctokit: () =>
            Promise.resolve({
              request: getOctokitStub,
            }),
        } as unknown as Credentials;
        sandbox.stub(Credentials, "initialize").resolves(mockCredentials);
      });

      it("should return early if the variant analysis is not found", async () => {
        try {
          await variantAnalysisManager.cancelVariantAnalysis(
            variantAnalysis.id + 100,
          );
        } catch (error: any) {
          expect(error.message).to.equal(
            "No variant analysis with id: " + (variantAnalysis.id + 100),
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
          expect(error.message).to.equal(
            `No workflow run id for variant analysis with id: ${variantAnalysis.id}`,
          );
        }
      });

      it("should return cancel if valid", async () => {
        await variantAnalysisManager.cancelVariantAnalysis(variantAnalysis.id);

        expect(mockCancelVariantAnalysis).to.have.been.calledWith(
          mockCredentials,
          variantAnalysis,
        );
      });
    });
  });

  describe("copyRepoListToClipboard", async () => {
    let variantAnalysis: VariantAnalysis;
    let variantAnalysisStorageLocation: string;

    let writeTextStub: sinon.SinonStub;

    beforeEach(async () => {
      variantAnalysis = createMockVariantAnalysis({});

      variantAnalysisStorageLocation =
        variantAnalysisManager.getVariantAnalysisStorageLocation(
          variantAnalysis.id,
        );
      await createTimestampFile(variantAnalysisStorageLocation);
      await variantAnalysisManager.rehydrateVariantAnalysis(variantAnalysis);

      writeTextStub = sinon.stub();
      sinon.stub(env, "clipboard").value({
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

        expect(writeTextStub).not.to.have.been.called;
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

        expect(writeTextStub).not.to.have.been.called;
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

        expect(writeTextStub).to.have.been.calledOnce;
      });

      it("should be valid JSON when put in object", async () => {
        await variantAnalysisManager.copyRepoListToClipboard(
          variantAnalysis.id,
        );

        const text = writeTextStub.getCalls()[0].lastArg;

        const parsed = JSON.parse("{" + text + "}");

        expect(parsed).to.deep.eq({
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

        const text = writeTextStub.getCalls()[0].lastArg;

        const parsed = JSON.parse("{" + text + "}");

        expect(parsed).to.deep.eq({
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

        const text = writeTextStub.getCalls()[0].lastArg;

        const parsed = JSON.parse("{" + text + "}");

        expect(parsed).to.deep.eq({
          "new-repo-list": [scannedRepos[4].repository.fullName],
        });
      });
    });
  });
});
