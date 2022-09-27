import * as vscode from 'vscode';
import { Credentials } from '../authentication';
import { Logger } from '../logging';
import * as ghApiClient from './gh-api/gh-api-client';
import * as path from 'path';

import { VariantAnalysis } from './shared/variant-analysis';
import { VariantAnalysis as VariantAnalysisApiResponse } from './gh-api/variant-analysis';
import { VariantAnalysisMonitorResult } from './shared/variant-analysis-monitor-result';

export class VariantAnalysisMonitor {
  // With a sleep of 5 seconds, the maximum number of attempts takes
  // us to just over 2 days worth of monitoring.
  public static maxAttemptCount = 17280;
  public static sleepTime = 5000;

  constructor(
    private readonly extensionContext: vscode.ExtensionContext,
    private readonly logger: Logger
  ) {
  }

  public async monitorVariantAnalysis(
    variantAnalysis: VariantAnalysis,
    cancellationToken: vscode.CancellationToken
  ): Promise<VariantAnalysisMonitorResult> {

    const credentials = await Credentials.initialize(this.extensionContext);
    if (!credentials) {
      throw Error('Error authenticating with GitHub');
    }

    let variantAnalysisSummary: VariantAnalysisApiResponse;
    let attemptCount = 1;
    const scannedReposDownloaded: number[] = [];

    while (attemptCount <= VariantAnalysisMonitor.maxAttemptCount) {
      await this.sleep(VariantAnalysisMonitor.sleepTime);

      if (cancellationToken && cancellationToken.isCancellationRequested) {
        return { status: 'Cancelled', error: 'Variant Analysis was canceled.' };
      }

      variantAnalysisSummary = await ghApiClient.getVariantAnalysis(
        credentials,
        variantAnalysis.controllerRepoId,
        variantAnalysis.id
      );

      // If a failure has occurred, mark as failed locally and stop monitoring until the user says to try again
      if (variantAnalysisSummary.status == 'in_progress' && variantAnalysisSummary.failure_reason) {
        return { status: 'Failed', error: `Variant Analysis has failed: ${variantAnalysisSummary.failure_reason}` };
      }

      // TODO: Raise event to update the UI

      void this.logger.log('****** Retrieved variant analysis' + JSON.stringify(variantAnalysisSummary));

      const storagePath = path.join(this.extensionContext.globalStorageUri.fsPath, 'variant-analyses');

      // TODO: Think about batching when we download new repositories. Max 10??
      // At the moment we're batching 3 (?)

      if (variantAnalysisSummary.scanned_repositories) {
        variantAnalysisSummary.scanned_repositories.forEach(async (scannedRepo) => {
          if (!scannedReposDownloaded.includes(scannedRepo.repository.id) && scannedRepo.analysis_status === 'succeeded') {
            void this.logger.log('***** Downloading results for repo: ' + scannedRepo.repository.id);
            await this.downloadRepoResults(
              credentials,
              variantAnalysisSummary,
              scannedRepo.repository.id,
              storagePath
            );
            scannedReposDownloaded.push(scannedRepo.repository.id);
          }
        });
      }

      attemptCount++;
    }

    // TODO: set "Downloading...(0/20MB)" - see screenshot

    // TODO: Decide if we want to finish and update UI
    // if (variantAnalysisSummary.status == 'completed' && variantAnalysisSummary.failure_reason) {
    //   return { status: 'CompletedUnsuccessfully', error: `Variant Analysis completed unsuccessfully: ${variantAnalysis.failure_reason}` };
    // }

    if (attemptCount == VariantAnalysisMonitor.maxAttemptCount && variantAnalysisSummary.status == 'in_progress') {
      void this.logger.log('Variant analysis monitoring timed out after 2 days');
      return { status: 'TimedOut', };
    }

    return { status: 'CompletedSuccessfully', scannedReposDownloaded: scannedReposDownloaded };
  }

  private async downloadRepoResults(
    credentials: Credentials,
    variantAnalysisSummary: VariantAnalysisApiResponse,
    repositoryId: number,
    storagePath: string
  ) {
    // let resultFilePath;
    // try {
    //   resultFilePath = await downloadResultFromLink(credentials, storagePath, variantAnalysisSummary.query_pack_url);
    // }
    // catch (e) {
    //   throw new Error(`Could not download the variant analysis results for ${variantAnalysisSummary.id}: ${getErrorMessage(e)}`);
    // }
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
