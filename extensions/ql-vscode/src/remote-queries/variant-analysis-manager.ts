import * as ghApiClient from './gh-api/gh-api-client';
import * as path from 'path';
import * as fs from 'fs-extra';
import { CancellationToken, ExtensionContext } from 'vscode';
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
  VariantAnalysis,
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisScannedRepositoryState
} from './shared/variant-analysis';
import { getErrorMessage } from '../pure/helpers-pure';
import { VariantAnalysisView } from './variant-analysis-view';
import { VariantAnalysisViewManager } from './variant-analysis-view-manager';

export class VariantAnalysisManager extends DisposableObject implements VariantAnalysisViewManager<VariantAnalysisView> {
  private readonly variantAnalysisMonitor: VariantAnalysisMonitor;
  private readonly views = new Map<number, VariantAnalysisView>();

  constructor(
    private readonly ctx: ExtensionContext,
    logger: Logger,
  ) {
    super();
    this.variantAnalysisMonitor = this.push(new VariantAnalysisMonitor(ctx, logger));
    this.variantAnalysisMonitor.onVariantAnalysisChange(this.onVariantAnalysisUpdated.bind(this));
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

  private async onVariantAnalysisUpdated(variantAnalysis: VariantAnalysis | undefined): Promise<void> {
    if (!variantAnalysis) {
      return;
    }

    await this.getView(variantAnalysis.id)?.updateView(variantAnalysis);
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

      const resultDirectory = path.join(
        this.ctx.globalStorageUri.fsPath,
        'variant-analyses',
        `${variantAnalysisSummary.id}`,
        scannedRepo.repository.full_name
      );

      const storagePath = path.join(
        resultDirectory,
        scannedRepo.repository.full_name
      );

      const result = await ghApiClient.getVariantAnalysisRepoResult(
        credentials,
        repoTask.artifact_url
      );

      fs.mkdirSync(resultDirectory, { recursive: true });
      await fs.writeFile(storagePath, JSON.stringify(result, null, 2), 'utf8');
    }

    repoState.downloadStatus = VariantAnalysisScannedRepositoryDownloadStatus.Succeeded;
    await this.onRepoStateUpdated(variantAnalysisSummary.id, repoState);
  }
}
