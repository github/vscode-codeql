import { ExtensionContext, CancellationToken, commands, EventEmitter } from 'vscode';
import { Credentials } from '../authentication';
import * as ghApiClient from './gh-api/gh-api-client';

import { isFinalVariantAnalysisStatus, VariantAnalysis } from './shared/variant-analysis';
import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisScannedRepository
} from './gh-api/variant-analysis';
import { VariantAnalysisMonitorResult } from './shared/variant-analysis-monitor-result';
import { processUpdatedVariantAnalysis } from './variant-analysis-processor';
import { DisposableObject } from '../pure/disposable-object';

export class VariantAnalysisMonitor extends DisposableObject {
  // With a sleep of 5 seconds, the maximum number of attempts takes
  // us to just over 2 days worth of monitoring.
  public static maxAttemptCount = 17280;
  public static sleepTime = 5000;

  private readonly _onVariantAnalysisChange = this.push(new EventEmitter<VariantAnalysis | undefined>());
  readonly onVariantAnalysisChange = this._onVariantAnalysisChange.event;

  constructor(
    private readonly extensionContext: ExtensionContext,
  ) {
    super();
  }

  public async monitorVariantAnalysis(
    variantAnalysis: VariantAnalysis,
    cancellationToken: CancellationToken
  ): Promise<VariantAnalysisMonitorResult> {

    const credentials = await Credentials.initialize(this.extensionContext);
    if (!credentials) {
      throw Error('Error authenticating with GitHub');
    }

    let attemptCount = 0;
    const scannedReposDownloaded: number[] = [];

    while (attemptCount <= VariantAnalysisMonitor.maxAttemptCount) {
      await this.sleep(VariantAnalysisMonitor.sleepTime);

      if (cancellationToken && cancellationToken.isCancellationRequested) {
        return { status: 'Canceled' };
      }

      const variantAnalysisSummary = await ghApiClient.getVariantAnalysis(
        credentials,
        variantAnalysis.controllerRepo.id,
        variantAnalysis.id
      );

      variantAnalysis = processUpdatedVariantAnalysis(variantAnalysis, variantAnalysisSummary);

      this._onVariantAnalysisChange.fire(variantAnalysis);

      const downloadedRepos = this.downloadVariantAnalysisResults(variantAnalysisSummary, scannedReposDownloaded);
      scannedReposDownloaded.push(...downloadedRepos);

      if (isFinalVariantAnalysisStatus(variantAnalysis.status) || variantAnalysis.failureReason) {
        break;
      }

      attemptCount++;
    }

    return { status: 'Completed', scannedReposDownloaded, variantAnalysis };
  }

  private scheduleForDownload(
    scannedRepo: VariantAnalysisScannedRepository,
    variantAnalysisSummary: VariantAnalysisApiResponse
  ) {
    void commands.executeCommand('codeQL.autoDownloadVariantAnalysisResult', scannedRepo, variantAnalysisSummary);
  }

  private shouldDownload(
    scannedRepo: VariantAnalysisScannedRepository,
    alreadyDownloaded: number[]
  ): boolean {
    return !alreadyDownloaded.includes(scannedRepo.repository.id) && scannedRepo.analysis_status === 'succeeded';
  }

  private getReposToDownload(
    variantAnalysisSummary: VariantAnalysisApiResponse,
    alreadyDownloaded: number[]
  ): VariantAnalysisScannedRepository[] {
    if (variantAnalysisSummary.scanned_repositories) {
      return variantAnalysisSummary.scanned_repositories.filter(scannedRepo => this.shouldDownload(scannedRepo, alreadyDownloaded));
    } else {
      return [];
    }
  }

  private downloadVariantAnalysisResults(
    variantAnalysisSummary: VariantAnalysisApiResponse,
    scannedReposDownloaded: number[]
  ): number[] {
    const repoResultsToDownload = this.getReposToDownload(variantAnalysisSummary, scannedReposDownloaded);
    const downloadedRepos: number[] = [];

    repoResultsToDownload.forEach(scannedRepo => {
      downloadedRepos.push(scannedRepo.repository.id);
      this.scheduleForDownload(scannedRepo, variantAnalysisSummary);
    });

    return downloadedRepos;
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
