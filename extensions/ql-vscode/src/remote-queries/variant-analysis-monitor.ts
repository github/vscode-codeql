import * as vscode from 'vscode';
import { Credentials } from '../authentication';
import { Logger } from '../logging';
import * as ghApiClient from './gh-api/gh-api-client';
import * as path from 'path';

import { VariantAnalysis, VariantAnalysisStatus } from './shared/variant-analysis';
import { VariantAnalysis as VariantAnalysisApiResponse } from './gh-api/variant-analysis';
import { Repository as ApiRepository } from './gh-api/repository';
import { VariantAnalysisMonitorResult } from './shared/variant-analysis-monitor-result';
import { getErrorMessage } from '../pure/helpers-pure';
import { processFailureReason } from './variant-analysis-processor';

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
    let attemptCount = 0;
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
        variantAnalysis.status = VariantAnalysisStatus.Failed;
        variantAnalysis.failureReason = processFailureReason(variantAnalysisSummary.failure_reason);
        return {
          status: 'Failed',
          error: `Variant Analysis has failed: ${variantAnalysisSummary.failure_reason}`,
          variantAnalysis: variantAnalysis
        };
      }

      // TODO: Raise event to update the UI

      void this.logger.log('****** Retrieved variant analysis' + JSON.stringify(variantAnalysisSummary));

      // TODO: Think about batching when we download new repositories. Max 10??
      // At the moment we're batching 3 (?)

      if (variantAnalysisSummary.scanned_repositories) {
        variantAnalysisSummary.scanned_repositories.forEach(async (scannedRepo) => {
          if (!scannedReposDownloaded.includes(scannedRepo.repository.id) && scannedRepo.analysis_status === 'succeeded') {
            void this.logger.log('***** Downloading results for repo: ' + scannedRepo.repository.id);
            await this.downloadRepoResults(
              credentials,
              variantAnalysisSummary,
              scannedRepo.repository
            );
            scannedReposDownloaded.push(scannedRepo.repository.id);
          }
        });
      }

      attemptCount++;
    }

    // TODO: update UI to show how much is being downloaded: "Downloading...(0/20MB)"

    // TODO: Update UI to show finished state
    // if (variantAnalysisSummary.status == 'completed' && variantAnalysisSummary.failure_reason) {
    //   return { status: 'CompletedUnsuccessfully', error: `Variant Analysis completed unsuccessfully: ${variantAnalysis.failure_reason}` };
    // }

    // if (attemptCount == VariantAnalysisMonitor.maxAttemptCount && variantAnalysisSummary.status == 'in_progress') {
    //   void this.logger.log('Variant analysis monitoring timed out after 2 days');
    //   return { status: 'TimedOut', };
    // }

    return { status: 'CompletedSuccessfully', scannedReposDownloaded: scannedReposDownloaded };
  }

  private async downloadRepoResults(
    credentials: Credentials,
    variantAnalysisSummary: VariantAnalysisApiResponse,
    repo: ApiRepository
  ) {

    let response;
    try {
      response = await ghApiClient.getVariantAnalysisRepo(
        credentials,
        variantAnalysisSummary.controller_repo.id,
        variantAnalysisSummary.id,
        repo.id
      );
    }
    catch (e) {
      throw new Error(`Could not download the results for variant analysis with id: ${variantAnalysisSummary.id}. Error: ${getErrorMessage(e)}`);
    }

    const storagePath = path.join(
      this.extensionContext.globalStorageUri.fsPath,
      'variant-analyses',
      `${variantAnalysisSummary.actions_workflow_run_id}`,
      repo.full_name
    );

    // Download the result from Azure
    // Save it in the storagePath

    console.log(storagePath);

    return response;
  }

  private async sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
