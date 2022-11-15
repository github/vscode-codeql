import * as path from 'path';

import * as ghApiClient from './gh-api/gh-api-client';
import { CancellationToken, commands, env, EventEmitter, ExtensionContext, Uri, window } from 'vscode';
import { DisposableObject } from '../pure/disposable-object';
import { Credentials } from '../authentication';
import { VariantAnalysisMonitor } from './variant-analysis-monitor';
import {
  isVariantAnalysisComplete, parseVariantAnalysisQueryLanguage,
  VariantAnalysis,
  VariantAnalysisQueryLanguage,
  VariantAnalysisRepositoryTask,
  VariantAnalysisScannedRepository,
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState, VariantAnalysisSubmission
} from './shared/variant-analysis';
import { getErrorMessage } from '../pure/helpers-pure';
import { VariantAnalysisView } from './variant-analysis-view';
import { VariantAnalysisViewManager } from './variant-analysis-view-manager';
import { LoadResultsOptions, VariantAnalysisResultsManager } from './variant-analysis-results-manager';
import { getControllerRepo, getQueryName, prepareRemoteQueryRun } from './run-remote-query';
import {
  processUpdatedVariantAnalysis,
  processVariantAnalysis,
  processVariantAnalysisRepositoryTask
} from './variant-analysis-processor';
import PQueue from 'p-queue';
import { createTimestampFile, showAndLogErrorMessage, showAndLogInformationMessage } from '../helpers';
import * as fs from 'fs-extra';
import * as os from 'os';
import { cancelVariantAnalysis } from './gh-api/gh-actions-api-client';
import { ProgressCallback, UserCancellationException } from '../commandRunner';
import { CodeQLCliServer } from '../cli';

export class VariantAnalysisManager extends DisposableObject implements VariantAnalysisViewManager<VariantAnalysisView> {
  private static readonly REPO_STATES_FILENAME = 'repo_states.json';

  private readonly _onVariantAnalysisAdded = this.push(new EventEmitter<VariantAnalysis>());
  public readonly onVariantAnalysisAdded = this._onVariantAnalysisAdded.event;
  private readonly _onVariantAnalysisStatusUpdated = this.push(new EventEmitter<VariantAnalysis>());
  public readonly onVariantAnalysisStatusUpdated = this._onVariantAnalysisStatusUpdated.event;

  private readonly _onVariantAnalysisRemoved = this.push(new EventEmitter<VariantAnalysis>());
  public readonly onVariantAnalysisRemoved = this._onVariantAnalysisRemoved.event;

  private readonly variantAnalysisMonitor: VariantAnalysisMonitor;
  private readonly variantAnalyses = new Map<number, VariantAnalysis>();
  private readonly views = new Map<number, VariantAnalysisView>();
  private static readonly maxConcurrentDownloads = 3;
  private readonly queue = new PQueue({ concurrency: VariantAnalysisManager.maxConcurrentDownloads });

  private readonly repoStates = new Map<number, Record<number, VariantAnalysisScannedRepositoryState>>();

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly cliServer: CodeQLCliServer,
    private readonly storagePath: string,
    private readonly variantAnalysisResultsManager: VariantAnalysisResultsManager
  ) {
    super();
    this.variantAnalysisMonitor = this.push(new VariantAnalysisMonitor(ctx));
    this.variantAnalysisMonitor.onVariantAnalysisChange(this.onVariantAnalysisUpdated.bind(this));

    this.variantAnalysisResultsManager = variantAnalysisResultsManager;
    this.variantAnalysisResultsManager.onResultLoaded(this.onRepoResultLoaded.bind(this));
  }

  public async runVariantAnalysis(
    uri: Uri | undefined,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> {
    const credentials = await Credentials.initialize(this.ctx);

    const {
      actionBranch,
      base64Pack,
      repoSelection,
      queryFile,
      queryMetadata,
      controllerRepo,
      queryStartTime,
      language,
    } = await prepareRemoteQueryRun(this.cliServer, credentials, uri, progress, token);

    const queryName = getQueryName(queryMetadata, queryFile);
    const variantAnalysisLanguage = parseVariantAnalysisQueryLanguage(language);
    if (variantAnalysisLanguage === undefined) {
      throw new UserCancellationException(`Found unsupported language: ${language}`);
    }

    const queryText = await fs.readFile(queryFile, 'utf8');

    const variantAnalysisSubmission: VariantAnalysisSubmission = {
      startTime: queryStartTime,
      actionRepoRef: actionBranch,
      controllerRepoId: controllerRepo.id,
      query: {
        name: queryName,
        filePath: queryFile,
        pack: base64Pack,
        language: variantAnalysisLanguage,
        text: queryText,
      },
      databases: {
        repositories: repoSelection.repositories,
        repositoryLists: repoSelection.repositoryLists,
        repositoryOwners: repoSelection.owners
      }
    };

    const variantAnalysisResponse = await ghApiClient.submitVariantAnalysis(
      credentials,
      variantAnalysisSubmission
    );

    const processedVariantAnalysis = processVariantAnalysis(variantAnalysisSubmission, variantAnalysisResponse);

    await this.onVariantAnalysisSubmitted(processedVariantAnalysis);

    void showAndLogInformationMessage(`Variant analysis ${processedVariantAnalysis.query.name} submitted for processing`);

    void commands.executeCommand('codeQL.openVariantAnalysisView', processedVariantAnalysis.id);
    void commands.executeCommand('codeQL.monitorVariantAnalysis', processedVariantAnalysis);
  }

  public async rehydrateVariantAnalysis(variantAnalysis: VariantAnalysis) {
    if (!(await this.variantAnalysisRecordExists(variantAnalysis.id))) {
      // In this case, the variant analysis was deleted from disk, most likely because
      // it was purged by another workspace.
      this._onVariantAnalysisRemoved.fire(variantAnalysis);
    } else {
      await this.setVariantAnalysis(variantAnalysis);

      try {
        const repoStates = await fs.readJson(this.getRepoStatesStoragePath(variantAnalysis.id));
        this.repoStates.set(variantAnalysis.id, repoStates);
      } catch (e) {
        // Ignore this error, we simply might not have downloaded anything yet
        this.repoStates.set(variantAnalysis.id, {});
      }

      if (!await isVariantAnalysisComplete(variantAnalysis, this.makeResultDownloadChecker(variantAnalysis))) {
        void commands.executeCommand('codeQL.monitorVariantAnalysis', variantAnalysis);
      }
    }
  }

  private makeResultDownloadChecker(variantAnalysis: VariantAnalysis): (repo: VariantAnalysisScannedRepository) => Promise<boolean> {
    const storageLocation = this.getVariantAnalysisStorageLocation(variantAnalysis.id);
    return (repo) => this.variantAnalysisResultsManager.isVariantAnalysisRepoDownloaded(storageLocation, repo.repository.fullName);
  }

  public async removeVariantAnalysis(variantAnalysis: VariantAnalysis) {
    this.variantAnalysisResultsManager.removeAnalysisResults(variantAnalysis);
    await this.removeStorageDirectory(variantAnalysis.id);
    this.variantAnalyses.delete(variantAnalysis.id);

    // This will automatically unregister the view
    this.views.get(variantAnalysis.id)?.dispose();
  }

  private async removeStorageDirectory(variantAnalysisId: number) {
    const storageLocation = this.getVariantAnalysisStorageLocation(variantAnalysisId);
    await fs.remove(storageLocation);
  }

  public async showView(variantAnalysisId: number): Promise<void> {
    if (!this.variantAnalyses.get(variantAnalysisId)) {
      void showAndLogErrorMessage(`No variant analysis found with id: ${variantAnalysisId}.`);
    }
    if (!this.views.has(variantAnalysisId)) {
      // The view will register itself with the manager, so we don't need to do anything here.
      this.track(new VariantAnalysisView(this.ctx, variantAnalysisId, this));
    }

    const variantAnalysisView = this.views.get(variantAnalysisId)!;
    await variantAnalysisView.openView();
    return;
  }

  public registerView(view: VariantAnalysisView): void {
    if (this.views.has(view.variantAnalysisId)) {
      throw new Error(`View for variant analysis with id: ${view.variantAnalysisId} already exists`);
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

  public async getVariantAnalysis(variantAnalysisId: number): Promise<VariantAnalysis | undefined> {
    return this.variantAnalyses.get(variantAnalysisId);
  }

  public async getRepoStates(variantAnalysisId: number): Promise<VariantAnalysisScannedRepositoryState[]> {
    return Object.values(this.repoStates.get(variantAnalysisId) ?? {});
  }

  public get variantAnalysesSize(): number {
    return this.variantAnalyses.size;
  }

  public async loadResults(variantAnalysisId: number, repositoryFullName: string, options?: LoadResultsOptions): Promise<VariantAnalysisScannedRepositoryResult> {
    const variantAnalysis = this.variantAnalyses.get(variantAnalysisId);
    if (!variantAnalysis) {
      throw new Error(`No variant analysis with id: ${variantAnalysisId}`);
    }

    return this.variantAnalysisResultsManager.loadResults(variantAnalysisId, this.getVariantAnalysisStorageLocation(variantAnalysisId), repositoryFullName, options);
  }

  private async variantAnalysisRecordExists(variantAnalysisId: number): Promise<boolean> {
    const filePath = this.getVariantAnalysisStorageLocation(variantAnalysisId);
    return await fs.pathExists(filePath);
  }

  public async onVariantAnalysisUpdated(variantAnalysis: VariantAnalysis | undefined): Promise<void> {
    if (!variantAnalysis) {
      return;
    }

    await this.setVariantAnalysis(variantAnalysis);
    this._onVariantAnalysisStatusUpdated.fire(variantAnalysis);
  }

  private async onVariantAnalysisSubmitted(variantAnalysis: VariantAnalysis): Promise<void> {
    await this.setVariantAnalysis(variantAnalysis);

    await this.prepareStorageDirectory(variantAnalysis.id);

    this.repoStates.set(variantAnalysis.id, {});

    this._onVariantAnalysisAdded.fire(variantAnalysis);
  }

  private async setVariantAnalysis(variantAnalysis: VariantAnalysis): Promise<void> {
    this.variantAnalyses.set(variantAnalysis.id, variantAnalysis);
    await this.getView(variantAnalysis.id)?.updateView(variantAnalysis);
  }

  private async onRepoResultLoaded(repositoryResult: VariantAnalysisScannedRepositoryResult): Promise<void> {
    await this.getView(repositoryResult.variantAnalysisId)?.sendRepositoryResults([repositoryResult]);
  }

  private async onRepoStateUpdated(variantAnalysisId: number, repoState: VariantAnalysisScannedRepositoryState): Promise<void> {
    await this.getView(variantAnalysisId)?.updateRepoState(repoState);

    let repoStates = this.repoStates.get(variantAnalysisId);
    if (!repoStates) {
      repoStates = {};
      this.repoStates.set(variantAnalysisId, repoStates);
    }

    repoStates[repoState.repositoryId] = repoState;
  }

  public async monitorVariantAnalysis(
    variantAnalysis: VariantAnalysis,
    cancellationToken: CancellationToken
  ): Promise<void> {
    await this.variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationToken);
  }

  public async autoDownloadVariantAnalysisResult(
    scannedRepo: VariantAnalysisScannedRepository,
    variantAnalysis: VariantAnalysis,
    cancellationToken: CancellationToken
  ): Promise<void> {
    if (this.repoStates.get(variantAnalysis.id)?.[scannedRepo.repository.id]?.downloadStatus === VariantAnalysisScannedRepositoryDownloadStatus.Succeeded) {
      return;
    }

    const repoState = {
      repositoryId: scannedRepo.repository.id,
      downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Pending,
    };

    await this.onRepoStateUpdated(variantAnalysis.id, repoState);

    const credentials = await Credentials.initialize(this.ctx);
    if (!credentials) { throw Error('Error authenticating with GitHub'); }

    if (cancellationToken && cancellationToken.isCancellationRequested) {
      repoState.downloadStatus = VariantAnalysisScannedRepositoryDownloadStatus.Failed;
      await this.onRepoStateUpdated(variantAnalysis.id, repoState);
      return;
    }

    let repoTask: VariantAnalysisRepositoryTask;
    try {
      const repoTaskResponse = await ghApiClient.getVariantAnalysisRepo(
        credentials,
        variantAnalysis.controllerRepo.id,
        variantAnalysis.id,
        scannedRepo.repository.id
      );

      repoTask = processVariantAnalysisRepositoryTask(repoTaskResponse);
    } catch (e) {
      repoState.downloadStatus = VariantAnalysisScannedRepositoryDownloadStatus.Failed;
      await this.onRepoStateUpdated(variantAnalysis.id, repoState);
      throw new Error(`Could not download the results for variant analysis with id: ${variantAnalysis.id}. Error: ${getErrorMessage(e)}`);
    }

    if (repoTask.artifactUrl) {
      repoState.downloadStatus = VariantAnalysisScannedRepositoryDownloadStatus.InProgress;
      await this.onRepoStateUpdated(variantAnalysis.id, repoState);

      try {
        await this.variantAnalysisResultsManager.download(credentials, variantAnalysis.id, repoTask, this.getVariantAnalysisStorageLocation(variantAnalysis.id));
      } catch (e) {
        repoState.downloadStatus = VariantAnalysisScannedRepositoryDownloadStatus.Failed;
        await this.onRepoStateUpdated(variantAnalysis.id, repoState);
        throw new Error(`Could not download the results for variant analysis with id: ${variantAnalysis.id}. Error: ${getErrorMessage(e)}`);
      }
    }

    repoState.downloadStatus = VariantAnalysisScannedRepositoryDownloadStatus.Succeeded;
    await this.onRepoStateUpdated(variantAnalysis.id, repoState);

    await fs.outputJson(this.getRepoStatesStoragePath(variantAnalysis.id), this.repoStates.get(variantAnalysis.id));
  }

  public async enqueueDownload(
    scannedRepo: VariantAnalysisScannedRepository,
    variantAnalysis: VariantAnalysis,
    token: CancellationToken
  ): Promise<void> {
    await this.queue.add(() => this.autoDownloadVariantAnalysisResult(scannedRepo, variantAnalysis, token));
  }

  public downloadsQueueSize(): number {
    return this.queue.pending;
  }

  public getVariantAnalysisStorageLocation(variantAnalysisId: number): string {
    return path.join(
      this.storagePath,
      `${variantAnalysisId}`
    );
  }

  public async cancelVariantAnalysis(variantAnalysisId: number) {
    const variantAnalysis = this.variantAnalyses.get(variantAnalysisId);
    if (!variantAnalysis) {
      throw new Error(`No variant analysis with id: ${variantAnalysisId}`);
    }

    if (!variantAnalysis.actionsWorkflowRunId) {
      throw new Error(`No workflow run id for variant analysis with id: ${variantAnalysis.id}`);
    }

    const credentials = await Credentials.initialize(this.ctx);
    if (!credentials) {
      throw Error('Error authenticating with GitHub');
    }

    void showAndLogInformationMessage('Cancelling variant analysis. This may take a while.');
    await cancelVariantAnalysis(credentials, variantAnalysis);
  }

  public async copyRepoListToClipboard(variantAnalysisId: number) {
    const variantAnalysis = this.variantAnalyses.get(variantAnalysisId);
    if (!variantAnalysis) {
      throw new Error(`No variant analysis with id: ${variantAnalysisId}`);
    }

    const fullNames = variantAnalysis.scannedRepos?.filter(a => a.resultCount && a.resultCount > 0).map(a => a.repository.fullName);
    if (!fullNames || fullNames.length === 0) {
      return;
    }

    const text = [
      '"new-repo-list": [',
      ...fullNames.slice(0, -1).map(repo => `    "${repo}",`),
      `    "${fullNames[fullNames.length - 1]}"`,
      ']'
    ];

    await env.clipboard.writeText(text.join(os.EOL));
  }

  private getRepoStatesStoragePath(variantAnalysisId: number): string {
    return path.join(
      this.getVariantAnalysisStorageLocation(variantAnalysisId),
      VariantAnalysisManager.REPO_STATES_FILENAME
    );
  }

  /**
   * Prepares a directory for storing results for a variant analysis.
   * This directory contains a timestamp file, which will be
   * used by the query history manager to determine when the directory
   * should be deleted.
   */
  private async prepareStorageDirectory(variantAnalysisId: number): Promise<void> {
    await createTimestampFile(this.getVariantAnalysisStorageLocation(variantAnalysisId));
  }

  public async promptOpenVariantAnalysis() {
    const credentials = await Credentials.initialize(this.ctx);
    if (!credentials) { throw Error('Error authenticating with GitHub'); }

    const controllerRepo = await getControllerRepo(credentials);

    const variantAnalysisIdString = await window.showInputBox({
      title: 'Enter the variant analysis ID',
    });
    if (!variantAnalysisIdString) {
      return;
    }
    const variantAnalysisId = parseInt(variantAnalysisIdString, 10);

    const variantAnalysisResponse = await ghApiClient.getVariantAnalysis(credentials, controllerRepo.id, variantAnalysisId);

    const processedVariantAnalysis = processUpdatedVariantAnalysis({
      // We don't really know these values, so just fill in some placeholder values
      query: {
        name: `Variant analysis ${variantAnalysisId}`,
        filePath: `variant_analysis_${variantAnalysisId}.ql`,
        language: variantAnalysisResponse.query_language as VariantAnalysisQueryLanguage,
        text: '',
      },
      databases: {},
      executionStartTime: 0,
    }, variantAnalysisResponse);

    void commands.executeCommand('codeQL.openVariantAnalysisView', processedVariantAnalysis.id);
    void commands.executeCommand('codeQL.monitorVariantAnalysis', processedVariantAnalysis);

    this._onVariantAnalysisAdded.fire(processedVariantAnalysis);
  }
}
