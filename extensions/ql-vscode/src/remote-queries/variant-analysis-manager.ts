import * as ghApiClient from './gh-api/gh-api-client';
import { CancellationToken, commands, EventEmitter, ExtensionContext, window } from 'vscode';
import { DisposableObject } from '../pure/disposable-object';
import { Logger } from '../logging';
import { Credentials } from '../authentication';
import { VariantAnalysisMonitor } from './variant-analysis-monitor';
import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisRepoTask,
  VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository
} from './gh-api/variant-analysis';
import {
  VariantAnalysis, VariantAnalysisQueryLanguage,
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState
} from './shared/variant-analysis';
import { getErrorMessage } from '../pure/helpers-pure';
import { VariantAnalysisView } from './variant-analysis-view';
import { VariantAnalysisViewManager } from './variant-analysis-view-manager';
import { VariantAnalysisResultsManager } from './variant-analysis-results-manager';
import { CodeQLCliServer } from '../cli';
import { getControllerRepo } from './run-remote-query';
import { processUpdatedVariantAnalysis } from './variant-analysis-processor';
import PQueue from 'p-queue';

export class VariantAnalysisManager extends DisposableObject implements VariantAnalysisViewManager<VariantAnalysisView> {
  private readonly _onVariantAnalysisAdded = this.push(new EventEmitter<VariantAnalysis>());
  public readonly onVariantAnalysisAdded = this._onVariantAnalysisAdded.event;

  private readonly variantAnalysisMonitor: VariantAnalysisMonitor;
  private readonly variantAnalysisResultsManager: VariantAnalysisResultsManager;
  private readonly variantAnalyses = new Map<number, VariantAnalysis>();
  private readonly views = new Map<number, VariantAnalysisView>();
  private static readonly maxConcurrentTasks = 3;
  public queue: PQueue;

  constructor(
    private readonly ctx: ExtensionContext,
    cliServer: CodeQLCliServer,
    storagePath: string,
    logger: Logger,
  ) {
    super();
    this.variantAnalysisMonitor = this.push(new VariantAnalysisMonitor(ctx, logger));
    this.variantAnalysisMonitor.onVariantAnalysisChange(this.onVariantAnalysisUpdated.bind(this));

    this.variantAnalysisResultsManager = this.push(new VariantAnalysisResultsManager(cliServer, storagePath, logger));
    this.variantAnalysisResultsManager.onResultLoaded(this.onRepoResultLoaded.bind(this));

    this.queue = new PQueue({ concurrency: VariantAnalysisManager.maxConcurrentTasks });
  }

  public async showView(variantAnalysisId: number): Promise<void> {
    if (!this.views.has(variantAnalysisId)) {
      // The view will register itself with the manager, so we don't need to do anything here.
      this.push(new VariantAnalysisView(this.ctx, variantAnalysisId, this));
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
  }

  public getView(variantAnalysisId: number): VariantAnalysisView | undefined {
    return this.views.get(variantAnalysisId);
  }

  public async getVariantAnalysis(variantAnalysisId: number): Promise<VariantAnalysis | undefined> {
    return this.variantAnalyses.get(variantAnalysisId);
  }

  public async loadResults(variantAnalysisId: number, repositoryFullName: string): Promise<void> {
    const variantAnalysis = this.variantAnalyses.get(variantAnalysisId);
    if (!variantAnalysis) {
      throw new Error(`No variant analysis with id: ${variantAnalysisId}`);
    }

    await this.variantAnalysisResultsManager.loadResults(variantAnalysisId, repositoryFullName);
  }

  private async onVariantAnalysisUpdated(variantAnalysis: VariantAnalysis | undefined): Promise<void> {
    if (!variantAnalysis) {
      return;
    }

    this.variantAnalyses.set(variantAnalysis.id, variantAnalysis);

    await this.getView(variantAnalysis.id)?.updateView(variantAnalysis);
  }

  public onVariantAnalysisSubmitted(variantAnalysis: VariantAnalysis): void {
    this._onVariantAnalysisAdded.fire(variantAnalysis);
  }

  private async onRepoResultLoaded(repositoryResult: VariantAnalysisScannedRepositoryResult): Promise<void> {
    await this.getView(repositoryResult.variantAnalysisId)?.sendRepositoryResults([repositoryResult]);
  }

  private async onRepoStateUpdated(variantAnalysisId: number, repoState: VariantAnalysisScannedRepositoryState): Promise<void> {
    await this.getView(variantAnalysisId)?.updateRepoState(repoState);
  }

  public async monitorVariantAnalysis(
    variantAnalysis: VariantAnalysis,
    cancellationToken: CancellationToken
  ): Promise<void> {
    await this.variantAnalysisMonitor.monitorVariantAnalysis(variantAnalysis, cancellationToken);
  }

  public async autoDownloadVariantAnalysisResult(
    scannedRepo: ApiVariantAnalysisScannedRepository,
    variantAnalysisSummary: VariantAnalysisApiResponse,
    cancellationToken: CancellationToken
  ): Promise<void> {
    const repoState = {
      repositoryId: scannedRepo.repository.id,
      downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus.Pending,
    };

    await this.onRepoStateUpdated(variantAnalysisSummary.id, repoState);

    const credentials = await Credentials.initialize(this.ctx);
    if (!credentials) { throw Error('Error authenticating with GitHub'); }

    if (cancellationToken && cancellationToken.isCancellationRequested) {
      repoState.downloadStatus = VariantAnalysisScannedRepositoryDownloadStatus.Failed;
      await this.onRepoStateUpdated(variantAnalysisSummary.id, repoState);
      return;
    }

    let repoTask: VariantAnalysisRepoTask;
    try {
      repoTask = await ghApiClient.getVariantAnalysisRepo(
        credentials,
        variantAnalysisSummary.controller_repo.id,
        variantAnalysisSummary.id,
        scannedRepo.repository.id
      );
    } catch (e) {
      repoState.downloadStatus = VariantAnalysisScannedRepositoryDownloadStatus.Failed;
      await this.onRepoStateUpdated(variantAnalysisSummary.id, repoState);
      throw new Error(`Could not download the results for variant analysis with id: ${variantAnalysisSummary.id}. Error: ${getErrorMessage(e)}`);
    }

    if (repoTask.artifact_url) {
      repoState.downloadStatus = VariantAnalysisScannedRepositoryDownloadStatus.InProgress;
      await this.onRepoStateUpdated(variantAnalysisSummary.id, repoState);

      await this.variantAnalysisResultsManager.download(credentials, variantAnalysisSummary.id, repoTask);
    }

    repoState.downloadStatus = VariantAnalysisScannedRepositoryDownloadStatus.Succeeded;
    await this.onRepoStateUpdated(variantAnalysisSummary.id, repoState);
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
