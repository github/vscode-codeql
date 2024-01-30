import { join } from "path";

import {
  submitVariantAnalysis,
  getVariantAnalysisRepo,
} from "./gh-api/gh-api-client";
import type { VariantAnalysis as ApiVariantAnalysis } from "./gh-api/variant-analysis";
import type {
  AuthenticationSessionsChangeEvent,
  CancellationToken,
} from "vscode";
import {
  authentication,
  env,
  EventEmitter,
  Uri,
  ViewColumn,
  window as Window,
  workspace,
} from "vscode";
import { DisposableObject } from "../common/disposable-object";
import { VariantAnalysisMonitor } from "./variant-analysis-monitor";
import type {
  VariantAnalysis,
  VariantAnalysisQueries,
  VariantAnalysisRepositoryTask,
  VariantAnalysisScannedRepository,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
  VariantAnalysisSubmission,
} from "./shared/variant-analysis";
import {
  getActionsWorkflowRunUrl,
  isVariantAnalysisComplete,
  parseVariantAnalysisQueryLanguage,
  VariantAnalysisScannedRepositoryDownloadStatus,
} from "./shared/variant-analysis";
import { getErrorMessage } from "../common/helpers-pure";
import { VariantAnalysisView } from "./variant-analysis-view";
import type { VariantAnalysisViewManager } from "./variant-analysis-view-manager";
import type {
  LoadResultsOptions,
  VariantAnalysisResultsManager,
} from "./variant-analysis-results-manager";
import { getQueryName, prepareRemoteQueryRun } from "./run-remote-query";
import {
  mapVariantAnalysis,
  mapVariantAnalysisRepositoryTask,
} from "./variant-analysis-mapper";
import PQueue from "p-queue";
import { createTimestampFile, saveBeforeStart } from "../run-queries-shared";
import { readFile, remove, pathExists } from "fs-extra";
import { EOL } from "os";
import { cancelVariantAnalysis } from "./gh-api/gh-actions-api-client";
import type { ProgressCallback } from "../common/vscode/progress";
import {
  UserCancellationException,
  withProgress,
} from "../common/vscode/progress";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { RepositoriesFilterSortStateWithIds } from "./shared/variant-analysis-filter-sort";
import {
  defaultFilterSortState,
  filterAndSortRepositoriesWithResults,
} from "./shared/variant-analysis-filter-sort";
import { URLSearchParams } from "url";
import type { DbManager } from "../databases/db-manager";
import type { App } from "../common/app";
import { redactableError } from "../common/errors";
import type {
  AppCommandManager,
  VariantAnalysisCommands,
} from "../common/commands";
import { exportVariantAnalysisResults } from "./export-results";
import {
  readRepoStates,
  REPO_STATES_FILENAME,
  writeRepoStates,
} from "./repo-states-store";
import { GITHUB_AUTH_PROVIDER_ID } from "../common/vscode/authentication";
import { FetchError } from "node-fetch";
import {
  showAndLogExceptionWithTelemetry,
  showAndLogInformationMessage,
  showAndLogWarningMessage,
} from "../common/logging";
import type { QueryTreeViewItem } from "../queries-panel/query-tree-view-item";
import { RequestError } from "@octokit/request-error";
import { handleRequestError } from "./custom-errors";
import { createMultiSelectionCommand } from "../common/vscode/selection-commands";
import { askForLanguage, findLanguage } from "../codeql-cli/query-language";
import type { QlPackDetails } from "./ql-pack-details";
import { getQlPackFilePath } from "../common/ql";
import { tryGetQueryMetadata } from "../codeql-cli/query-metadata";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { findVariantAnalysisQlPackRoot } from "./ql";

const maxRetryCount = 3;

export class VariantAnalysisManager
  extends DisposableObject
  implements VariantAnalysisViewManager<VariantAnalysisView>
{
  private static readonly DOWNLOAD_PERCENTAGE_UPDATE_DELAY_MS = 500;

  private readonly _onVariantAnalysisAdded = this.push(
    new EventEmitter<VariantAnalysis>(),
  );
  public readonly onVariantAnalysisAdded = this._onVariantAnalysisAdded.event;
  private readonly _onVariantAnalysisStatusUpdated = this.push(
    new EventEmitter<VariantAnalysis>(),
  );
  public readonly onVariantAnalysisStatusUpdated =
    this._onVariantAnalysisStatusUpdated.event;

  private readonly _onVariantAnalysisRemoved = this.push(
    new EventEmitter<VariantAnalysis>(),
  );
  public readonly onVariantAnalysisRemoved =
    this._onVariantAnalysisRemoved.event;

  private readonly variantAnalysisMonitor: VariantAnalysisMonitor;
  private readonly variantAnalyses = new Map<number, VariantAnalysis>();
  private readonly views = new Map<number, VariantAnalysisView>();
  private static readonly maxConcurrentDownloads = 3;
  private readonly queue = new PQueue({
    concurrency: VariantAnalysisManager.maxConcurrentDownloads,
  });

  private readonly repoStates = new Map<
    number,
    Record<number, VariantAnalysisScannedRepositoryState>
  >();

  constructor(
    private readonly app: App,
    private readonly cliServer: CodeQLCliServer,
    private readonly storagePath: string,
    private readonly variantAnalysisResultsManager: VariantAnalysisResultsManager,
    private readonly dbManager: DbManager,
  ) {
    super();
    this.variantAnalysisMonitor = this.push(
      new VariantAnalysisMonitor(
        app,
        this.shouldCancelMonitorVariantAnalysis.bind(this),
      ),
    );
    this.variantAnalysisMonitor.onVariantAnalysisChange(
      this.onVariantAnalysisUpdated.bind(this),
    );

    this.variantAnalysisResultsManager = variantAnalysisResultsManager;
    this.variantAnalysisResultsManager.onResultLoaded(
      this.onRepoResultLoaded.bind(this),
    );

    this.push(
      authentication.onDidChangeSessions(this.onDidChangeSessions.bind(this)),
    );
  }

  getCommands(): VariantAnalysisCommands {
    return {
      "codeQL.autoDownloadVariantAnalysisResult":
        this.enqueueDownload.bind(this),
      "codeQL.loadVariantAnalysisRepoResults": this.loadResults.bind(this),
      "codeQL.monitorNewVariantAnalysis":
        this.monitorVariantAnalysis.bind(this),
      "codeQL.monitorRehydratedVariantAnalysis":
        this.monitorVariantAnalysis.bind(this),
      "codeQL.monitorReauthenticatedVariantAnalysis":
        this.monitorVariantAnalysis.bind(this),
      "codeQL.openVariantAnalysisLogs": this.openVariantAnalysisLogs.bind(this),
      "codeQL.openVariantAnalysisView": this.showView.bind(this),
      "codeQL.runVariantAnalysis":
        this.runVariantAnalysisFromCommandPalette.bind(this),
      "codeQL.runVariantAnalysisContextEditor":
        this.runVariantAnalysisFromContextEditor.bind(this),
      "codeQL.runVariantAnalysisContextExplorer": createMultiSelectionCommand(
        this.runVariantAnalysisFromExplorer.bind(this),
      ),
      "codeQLQueries.runVariantAnalysisContextMenu":
        this.runVariantAnalysisFromQueriesPanel.bind(this),
      "codeQL.runVariantAnalysisPublishedPack":
        this.runVariantAnalysisFromPublishedPack.bind(this),
    };
  }

  get commandManager(): AppCommandManager {
    return this.app.commands;
  }

  private async runVariantAnalysisFromCommandPalette() {
    const fileUri = Window.activeTextEditor?.document.uri;
    if (!fileUri) {
      throw new Error("Please select a .ql file to run as a variant analysis");
    }

    await this.runVariantAnalysisCommand([fileUri]);
  }

  private async runVariantAnalysisFromContextEditor(uri: Uri) {
    await this.runVariantAnalysisCommand([uri]);
  }

  private async runVariantAnalysisFromExplorer(fileURIs: Uri[]): Promise<void> {
    return this.runVariantAnalysisCommand(fileURIs);
  }

  private async runVariantAnalysisFromQueriesPanel(
    queryTreeViewItem: QueryTreeViewItem,
  ): Promise<void> {
    if (queryTreeViewItem.path !== undefined) {
      await this.runVariantAnalysisCommand([Uri.file(queryTreeViewItem.path)]);
    }
  }

  public async runVariantAnalysisFromPublishedPack(): Promise<void> {
    return withProgress(async (progress, token) => {
      progress({
        maxStep: 8,
        step: 0,
        message: "Determining query language",
      });

      const language = await askForLanguage(this.cliServer);
      if (!language) {
        return;
      }

      progress({
        maxStep: 8,
        step: 1,
        message: "Downloading query pack",
      });

      const packName = `codeql/${language}-queries`;
      const packDownloadResult = await this.cliServer.packDownload([packName]);
      const downloadedPack = packDownloadResult.packs[0];

      const packDir = join(
        packDownloadResult.packDir,
        downloadedPack.name,
        downloadedPack.version,
      );

      progress({
        maxStep: 8,
        step: 2,
        message: "Resolving queries in pack",
      });

      const suitePath = join(
        packDir,
        "codeql-suites",
        `${language}-code-scanning.qls`,
      );
      const resolvedQueries = await this.cliServer.resolveQueries(suitePath);

      const problemQueries =
        await this.filterToOnlyProblemQueries(resolvedQueries);

      if (problemQueries.length === 0) {
        void this.app.logger.showErrorMessage(
          `Unable to trigger variant analysis. No problem queries found in published query pack: ${packName}.`,
        );
        return;
      }

      const qlPackFilePath = await getQlPackFilePath(packDir);

      // Build up details to pass to the functions that run the variant analysis.
      const qlPackDetails: QlPackDetails = {
        queryFiles: problemQueries,
        qlPackRootPath: packDir,
        qlPackFilePath,
        language,
      };

      await this.runVariantAnalysis(
        qlPackDetails,
        (p) =>
          progress({
            ...p,
            maxStep: p.maxStep + 3,
            step: p.step + 3,
          }),
        token,
      );
    });
  }

  private async filterToOnlyProblemQueries(
    queries: string[],
  ): Promise<string[]> {
    const problemQueries: string[] = [];
    for (const query of queries) {
      const queryMetadata = await this.cliServer.resolveMetadata(query);
      if (
        queryMetadata.kind === "problem" ||
        queryMetadata.kind === "path-problem"
      ) {
        problemQueries.push(query);
      } else {
        void this.app.logger.log(`Skipping non-problem query ${query}`);
      }
    }
    return problemQueries;
  }

  private async runVariantAnalysisCommand(queryFiles: Uri[]): Promise<void> {
    if (queryFiles.length === 0) {
      throw new Error("Please select a .ql file to run as a variant analysis");
    }

    const qlPackRootPath = await findVariantAnalysisQlPackRoot(
      queryFiles.map((f) => f.fsPath),
      getOnDiskWorkspaceFolders(),
    );
    const qlPackFilePath = await getQlPackFilePath(qlPackRootPath);

    // Open popup to ask for language if not already hardcoded
    const language = qlPackFilePath
      ? await findLanguage(this.cliServer, queryFiles[0])
      : await askForLanguage(this.cliServer);

    if (!language) {
      throw new UserCancellationException("Could not determine query language");
    }

    const qlPackDetails: QlPackDetails = {
      queryFiles: queryFiles.map((uri) => uri.fsPath),
      qlPackRootPath,
      qlPackFilePath,
      language,
    };

    return withProgress(
      async (progress, token) => {
        await this.runVariantAnalysis(qlPackDetails, progress, token);
      },
      {
        title: "Run Variant Analysis",
        cancellable: true,
      },
    );
  }

  public async runVariantAnalysis(
    qlPackDetails: QlPackDetails,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> {
    await saveBeforeStart();

    progress({
      maxStep: 5,
      step: 0,
      message: "Getting credentials",
    });

    const {
      actionBranch,
      base64Pack,
      repoSelection,
      controllerRepo,
      queryStartTime,
    } = await prepareRemoteQueryRun(
      this.cliServer,
      this.app.credentials,
      qlPackDetails,
      progress,
      token,
      this.dbManager,
    );

    // For now we get the metadata for the first query in the pack.
    // and use that in the submission and query history. In the future
    // we'll need to consider how to handle having multiple queries.
    const firstQueryFile = qlPackDetails.queryFiles[0];
    const queryMetadata = await tryGetQueryMetadata(
      this.cliServer,
      firstQueryFile,
    );
    const queryName = getQueryName(queryMetadata, firstQueryFile);
    const variantAnalysisLanguage = parseVariantAnalysisQueryLanguage(
      qlPackDetails.language,
    );
    if (variantAnalysisLanguage === undefined) {
      throw new UserCancellationException(
        `Found unsupported language: ${qlPackDetails.language}`,
      );
    }

    const queryText = await readFile(firstQueryFile, "utf8");

    const queries: VariantAnalysisQueries | undefined =
      qlPackDetails.queryFiles.length === 1
        ? undefined
        : {
            language: qlPackDetails.language,
            count: qlPackDetails.queryFiles.length,
          };

    const variantAnalysisSubmission: VariantAnalysisSubmission = {
      startTime: queryStartTime,
      actionRepoRef: actionBranch,
      controllerRepoId: controllerRepo.id,
      language: variantAnalysisLanguage,
      pack: base64Pack,
      query: {
        name: queryName,
        filePath: firstQueryFile,
        text: queryText,
        kind: queryMetadata?.kind,
      },
      queries,
      databases: {
        repositories: repoSelection.repositories,
        repositoryLists: repoSelection.repositoryLists,
        repositoryOwners: repoSelection.owners,
      },
    };

    let variantAnalysisResponse: ApiVariantAnalysis;
    try {
      variantAnalysisResponse = await submitVariantAnalysis(
        this.app.credentials,
        variantAnalysisSubmission,
      );
    } catch (e: unknown) {
      // If the error is handled by the handleRequestError function, we don't need to throw
      if (e instanceof RequestError && handleRequestError(e, this.app.logger)) {
        return;
      }

      throw e;
    }

    const processedVariantAnalysis = mapVariantAnalysis(
      variantAnalysisSubmission,
      variantAnalysisResponse,
    );

    await this.onVariantAnalysisSubmitted(processedVariantAnalysis);

    void showAndLogInformationMessage(
      this.app.logger,
      `Variant analysis ${processedVariantAnalysis.query.name} submitted for processing`,
    );

    void this.app.commands.execute(
      "codeQL.openVariantAnalysisView",
      processedVariantAnalysis.id,
    );
    void this.app.commands.execute(
      "codeQL.monitorNewVariantAnalysis",
      processedVariantAnalysis,
    );
  }

  public async rehydrateVariantAnalysis(variantAnalysis: VariantAnalysis) {
    if (!(await this.variantAnalysisRecordExists(variantAnalysis.id))) {
      // In this case, the variant analysis was deleted from disk, most likely because
      // it was purged by another workspace.
      this._onVariantAnalysisRemoved.fire(variantAnalysis);
    } else {
      await this.setVariantAnalysis(variantAnalysis);

      const repoStatesFromDisk = await readRepoStates(
        this.getRepoStatesStoragePath(variantAnalysis.id),
      );

      this.repoStates.set(variantAnalysis.id, repoStatesFromDisk || {});

      if (
        !(await isVariantAnalysisComplete(
          variantAnalysis,
          this.makeResultDownloadChecker(variantAnalysis),
        ))
      ) {
        void this.app.commands.execute(
          "codeQL.monitorRehydratedVariantAnalysis",
          variantAnalysis,
        );
      }
    }
  }

  private makeResultDownloadChecker(
    variantAnalysis: VariantAnalysis,
  ): (repo: VariantAnalysisScannedRepository) => Promise<boolean> {
    const storageLocation = this.getVariantAnalysisStorageLocation(
      variantAnalysis.id,
    );
    return (repo) =>
      this.variantAnalysisResultsManager.isVariantAnalysisRepoDownloaded(
        storageLocation,
        repo.repository.fullName,
      );
  }

  public async removeVariantAnalysis(variantAnalysis: VariantAnalysis) {
    this.variantAnalysisResultsManager.removeAnalysisResults(variantAnalysis);
    await this.removeStorageDirectory(variantAnalysis.id);
    this.variantAnalyses.delete(variantAnalysis.id);

    // This will automatically unregister the view
    this.views.get(variantAnalysis.id)?.dispose();
  }

  private async removeStorageDirectory(variantAnalysisId: number) {
    const storageLocation =
      this.getVariantAnalysisStorageLocation(variantAnalysisId);
    await remove(storageLocation);
  }

  public async showView(variantAnalysisId: number): Promise<void> {
    if (!this.variantAnalyses.get(variantAnalysisId)) {
      void showAndLogExceptionWithTelemetry(
        this.app.logger,
        this.app.telemetry,
        redactableError`No variant analysis found with id: ${variantAnalysisId}.`,
      );
    }
    if (!this.views.has(variantAnalysisId)) {
      // The view will register itself with the manager, so we don't need to do anything here.
      this.track(new VariantAnalysisView(this.app, variantAnalysisId, this));
    }

    const variantAnalysisView = this.views.get(variantAnalysisId)!;
    await variantAnalysisView.openView();
    return;
  }

  public async openQueryText(variantAnalysisId: number): Promise<void> {
    const variantAnalysis = await this.getVariantAnalysis(variantAnalysisId);
    if (!variantAnalysis) {
      void showAndLogWarningMessage(
        this.app.logger,
        "Could not open variant analysis query text. Variant analysis not found.",
      );
      return;
    }

    const filename = variantAnalysis.query.filePath;

    try {
      const params = new URLSearchParams({
        variantAnalysisId: variantAnalysis.id.toString(),
      });
      const uri = Uri.from({
        scheme: "codeql-variant-analysis",
        path: filename,
        query: params.toString(),
      });
      const doc = await workspace.openTextDocument(uri);
      await Window.showTextDocument(doc, { preview: false });
    } catch (error) {
      void showAndLogWarningMessage(
        this.app.logger,
        "Could not open variant analysis query text. Failed to open text document.",
      );
    }
  }

  public async openQueryFile(variantAnalysisId: number): Promise<void> {
    const variantAnalysis = await this.getVariantAnalysis(variantAnalysisId);

    if (!variantAnalysis) {
      void showAndLogWarningMessage(
        this.app.logger,
        "Could not open variant analysis query file",
      );
      return;
    }

    try {
      const textDocument = await workspace.openTextDocument(
        variantAnalysis.query.filePath,
      );
      await Window.showTextDocument(textDocument, ViewColumn.One);
    } catch (error) {
      void showAndLogWarningMessage(
        this.app.logger,
        `Could not open file: ${variantAnalysis.query.filePath}`,
      );
    }
  }

  public registerView(view: VariantAnalysisView): void {
    if (this.views.has(view.variantAnalysisId)) {
      throw new Error(
        `View for variant analysis with id: ${view.variantAnalysisId} already exists`,
      );
    }

    this.views.set(view.variantAnalysisId, view);
  }

  public unregisterView(view: VariantAnalysisView): void {
    this.views.delete(view.variantAnalysisId);
    this.disposeAndStopTracking(view);
  }

  public getView(variantAnalysisId: number): VariantAnalysisView | undefined {
    return this.views.get(variantAnalysisId);
  }

  public async getVariantAnalysis(
    variantAnalysisId: number,
  ): Promise<VariantAnalysis | undefined> {
    return this.variantAnalyses.get(variantAnalysisId);
  }

  public async getRepoStates(
    variantAnalysisId: number,
  ): Promise<VariantAnalysisScannedRepositoryState[]> {
    return Object.values(this.repoStates.get(variantAnalysisId) ?? {});
  }

  public get variantAnalysesSize(): number {
    return this.variantAnalyses.size;
  }

  public async loadResults(
    variantAnalysisId: number,
    repositoryFullName: string,
    options?: LoadResultsOptions,
  ): Promise<VariantAnalysisScannedRepositoryResult> {
    const variantAnalysis = this.variantAnalyses.get(variantAnalysisId);
    if (!variantAnalysis) {
      throw new Error(`No variant analysis with id: ${variantAnalysisId}`);
    }

    return this.variantAnalysisResultsManager.loadResults(
      variantAnalysisId,
      this.getVariantAnalysisStorageLocation(variantAnalysisId),
      repositoryFullName,
      options,
    );
  }

  private async variantAnalysisRecordExists(
    variantAnalysisId: number,
  ): Promise<boolean> {
    const filePath = this.getVariantAnalysisStorageLocation(variantAnalysisId);
    return await pathExists(filePath);
  }

  private async shouldCancelMonitorVariantAnalysis(
    variantAnalysisId: number,
  ): Promise<boolean> {
    return !this.variantAnalyses.has(variantAnalysisId);
  }

  public async onVariantAnalysisUpdated(
    variantAnalysis: VariantAnalysis | undefined,
  ): Promise<void> {
    if (!variantAnalysis) {
      return;
    }

    if (!this.variantAnalyses.has(variantAnalysis.id)) {
      return;
    }

    await this.setVariantAnalysis(variantAnalysis);
    this._onVariantAnalysisStatusUpdated.fire(variantAnalysis);
  }

  private async onVariantAnalysisSubmitted(
    variantAnalysis: VariantAnalysis,
  ): Promise<void> {
    await this.setVariantAnalysis(variantAnalysis);

    await this.prepareStorageDirectory(variantAnalysis.id);

    this.repoStates.set(variantAnalysis.id, {});

    this._onVariantAnalysisAdded.fire(variantAnalysis);
  }

  private async setVariantAnalysis(
    variantAnalysis: VariantAnalysis,
  ): Promise<void> {
    this.variantAnalyses.set(variantAnalysis.id, variantAnalysis);
    await this.getView(variantAnalysis.id)?.updateView(variantAnalysis);
  }

  private async onRepoResultLoaded(
    repositoryResult: VariantAnalysisScannedRepositoryResult,
  ): Promise<void> {
    await this.getView(
      repositoryResult.variantAnalysisId,
    )?.sendRepositoryResults([repositoryResult]);
  }

  private async onRepoStateUpdated(
    variantAnalysisId: number,
    repoState: VariantAnalysisScannedRepositoryState,
  ): Promise<void> {
    await this.getView(variantAnalysisId)?.updateRepoState(repoState);

    let repoStates = this.repoStates.get(variantAnalysisId);
    if (!repoStates) {
      repoStates = {};
      this.repoStates.set(variantAnalysisId, repoStates);
    }

    repoStates[repoState.repositoryId] = repoState;
  }

  private async onDidChangeSessions(
    event: AuthenticationSessionsChangeEvent,
  ): Promise<void> {
    if (event.provider.id !== GITHUB_AUTH_PROVIDER_ID) {
      return;
    }

    for (const variantAnalysis of this.variantAnalyses.values()) {
      if (
        this.variantAnalysisMonitor.isMonitoringVariantAnalysis(
          variantAnalysis.id,
        )
      ) {
        continue;
      }

      if (
        await isVariantAnalysisComplete(
          variantAnalysis,
          this.makeResultDownloadChecker(variantAnalysis),
        )
      ) {
        continue;
      }

      void this.app.commands.execute(
        "codeQL.monitorReauthenticatedVariantAnalysis",
        variantAnalysis,
      );
    }
  }

  public async monitorVariantAnalysis(
    variantAnalysis: VariantAnalysis,
  ): Promise<void> {
    await this.variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis);
  }

  public async autoDownloadVariantAnalysisResult(
    scannedRepo: VariantAnalysisScannedRepository,
    variantAnalysis: VariantAnalysis,
  ): Promise<void> {
    if (
      this.repoStates.get(variantAnalysis.id)?.[scannedRepo.repository.id]
        ?.downloadStatus ===
      VariantAnalysisScannedRepositoryDownloadStatus.Succeeded
    ) {
      return;
    }

    const repoState = {
      repositoryId: scannedRepo.repository.id,
      downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Pending,
    };

    await this.onRepoStateUpdated(variantAnalysis.id, repoState);

    let repoTask: VariantAnalysisRepositoryTask;
    try {
      const repoTaskResponse = await getVariantAnalysisRepo(
        this.app.credentials,
        variantAnalysis.controllerRepo.id,
        variantAnalysis.id,
        scannedRepo.repository.id,
      );

      repoTask = mapVariantAnalysisRepositoryTask(repoTaskResponse);
    } catch (e) {
      repoState.downloadStatus =
        VariantAnalysisScannedRepositoryDownloadStatus.Failed;
      await this.onRepoStateUpdated(variantAnalysis.id, repoState);
      throw new Error(
        `Could not download the results for variant analysis with id: ${
          variantAnalysis.id
        }. Error: ${getErrorMessage(e)}`,
      );
    }

    if (repoTask.artifactUrl) {
      repoState.downloadStatus =
        VariantAnalysisScannedRepositoryDownloadStatus.InProgress;
      await this.onRepoStateUpdated(variantAnalysis.id, repoState);

      try {
        let lastRepoStateUpdate = 0;
        const updateRepoStateCallback = async (downloadPercentage: number) => {
          const now = new Date().getTime();
          if (
            lastRepoStateUpdate <
            now - VariantAnalysisManager.DOWNLOAD_PERCENTAGE_UPDATE_DELAY_MS
          ) {
            lastRepoStateUpdate = now;
            await this.onRepoStateUpdated(variantAnalysis.id, {
              repositoryId: scannedRepo.repository.id,
              downloadStatus:
                VariantAnalysisScannedRepositoryDownloadStatus.InProgress,
              downloadPercentage,
            });
          }
        };
        let retry = 0;
        for (;;) {
          try {
            await this.variantAnalysisResultsManager.download(
              variantAnalysis.id,
              repoTask,
              this.getVariantAnalysisStorageLocation(variantAnalysis.id),
              updateRepoStateCallback,
            );
            break;
          } catch (e) {
            if (
              retry++ < maxRetryCount &&
              e instanceof FetchError &&
              (e.code === "ETIMEDOUT" || e.code === "ECONNRESET")
            ) {
              void this.app.logger.log(
                `Timeout while trying to download variant analysis with id: ${
                  variantAnalysis.id
                }. Error: ${getErrorMessage(e)}. Retrying...`,
              );
              continue;
            }
            void this.app.logger.log(
              `Failed to download variant analysis after ${retry} attempts.`,
            );
            throw e;
          }
        }
      } catch (e) {
        repoState.downloadStatus =
          VariantAnalysisScannedRepositoryDownloadStatus.Failed;
        await this.onRepoStateUpdated(variantAnalysis.id, repoState);
        throw new Error(
          `Could not download the results for variant analysis with id: ${
            variantAnalysis.id
          }. Error: ${getErrorMessage(e)}`,
        );
      }
    }

    repoState.downloadStatus =
      VariantAnalysisScannedRepositoryDownloadStatus.Succeeded;
    await this.onRepoStateUpdated(variantAnalysis.id, repoState);

    const repoStates = this.repoStates.get(variantAnalysis.id);
    if (repoStates) {
      await writeRepoStates(
        this.getRepoStatesStoragePath(variantAnalysis.id),
        repoStates,
      );
    }
  }

  public async enqueueDownload(
    scannedRepo: VariantAnalysisScannedRepository,
    variantAnalysis: VariantAnalysis,
  ): Promise<void> {
    await this.queue.add(() =>
      this.autoDownloadVariantAnalysisResult(scannedRepo, variantAnalysis),
    );
  }

  public downloadsQueueSize(): number {
    return this.queue.pending;
  }

  public getVariantAnalysisStorageLocation(variantAnalysisId: number): string {
    return join(this.storagePath, `${variantAnalysisId}`);
  }

  public async cancelVariantAnalysis(variantAnalysisId: number) {
    const variantAnalysis = this.variantAnalyses.get(variantAnalysisId);
    if (!variantAnalysis) {
      throw new Error(`No variant analysis with id: ${variantAnalysisId}`);
    }

    if (!variantAnalysis.actionsWorkflowRunId) {
      throw new Error(
        `No workflow run id for variant analysis with id: ${variantAnalysis.id}`,
      );
    }

    void showAndLogInformationMessage(
      this.app.logger,
      "Cancelling variant analysis. This may take a while.",
    );
    await cancelVariantAnalysis(this.app.credentials, variantAnalysis);
  }

  public async openVariantAnalysisLogs(variantAnalysisId: number) {
    const variantAnalysis = this.variantAnalyses.get(variantAnalysisId);
    if (!variantAnalysis) {
      throw new Error(`No variant analysis with id: ${variantAnalysisId}`);
    }

    const actionsWorkflowRunUrl = getActionsWorkflowRunUrl(variantAnalysis);

    await this.app.commands.execute(
      "vscode.open",
      Uri.parse(actionsWorkflowRunUrl),
    );
  }

  public async copyRepoListToClipboard(
    variantAnalysisId: number,
    filterSort: RepositoriesFilterSortStateWithIds = defaultFilterSortState,
  ) {
    const variantAnalysis = this.variantAnalyses.get(variantAnalysisId);
    if (!variantAnalysis) {
      throw new Error(`No variant analysis with id: ${variantAnalysisId}`);
    }

    const filteredRepositories = filterAndSortRepositoriesWithResults(
      variantAnalysis.scannedRepos,
      filterSort,
    );

    const fullNames = filteredRepositories
      ?.filter((a) => a.resultCount && a.resultCount > 0)
      .map((a) => a.repository.fullName);
    if (!fullNames || fullNames.length === 0) {
      return;
    }

    const text = [
      "{",
      `    "name": "new-repo-list",`,
      `    "repositories": [`,
      ...fullNames.slice(0, -1).map((repo) => `        "${repo}",`),
      `        "${fullNames[fullNames.length - 1]}"`,
      `    ]`,
      "}",
    ];

    await env.clipboard.writeText(text.join(EOL));
  }

  public async exportResults(
    variantAnalysisId: number,
    filterSort?: RepositoriesFilterSortStateWithIds,
  ) {
    await exportVariantAnalysisResults(
      this,
      variantAnalysisId,
      filterSort,
      this.app.commands,
      this.app.credentials,
    );
  }

  private getRepoStatesStoragePath(variantAnalysisId: number): string {
    return join(
      this.getVariantAnalysisStorageLocation(variantAnalysisId),
      REPO_STATES_FILENAME,
    );
  }

  /**
   * Prepares a directory for storing results for a variant analysis.
   * This directory contains a timestamp file, which will be
   * used by the query history manager to determine when the directory
   * should be deleted.
   */
  private async prepareStorageDirectory(
    variantAnalysisId: number,
  ): Promise<void> {
    await createTimestampFile(
      this.getVariantAnalysisStorageLocation(variantAnalysisId),
    );
  }
}
