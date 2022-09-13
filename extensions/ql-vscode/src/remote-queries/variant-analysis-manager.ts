import * as path from 'path';
import { commands, ExtensionContext } from 'vscode';
import { Credentials } from '../authentication';
import { logger } from '../logging';
import * as time from '../pure/time';
import * as ghApiClient from '../gh-api/gh-api-client';
import {
  VariantAnalysisSubmission
} from './shared/variant-analysis';
import { VariantAnalysis } from '../gh-api/variant-analysis-models';
// import { mapVariantAnalysis, updateVariantAnalysis } from './entity-mapper';

export class VariantAnalysisManager {
  // TODO: Prefix the variables or move to monitor
  // With a sleep of 5 seconds, the maximum number of attempts takes
  // us to just over 2 days worth of monitoring.
  private static readonly maxAttemptCount = 17280;
  private static readonly sleepTime = 5000;

  constructor(
    private readonly ctx: ExtensionContext
  ) {
  }

  public async submitVariantAnalysis(submissionDetails: VariantAnalysisSubmission): Promise<void> {
    const credentials = await Credentials.initialize(this.ctx);

    void logger.log('***** Submitting variant analysis');

    const response = await ghApiClient.submitVariantAnalysis(credentials, submissionDetails);
    // TODO: Deal with any failures and show notifications

    const controllerRepoId = submissionDetails.controllerRepoId;
    const variantAnalysisId = response.id;

    void logger.log('***** Variant analysis id: ' + variantAnalysisId);
    void logger.log('***** Controller repo id: ' + controllerRepoId);

    // TODO: Add to query history

    void commands.executeCommand('codeQL.monitorVariantAnalysis', response);
  }

  public async monitorVariantAnalysis(
    variantAnalysis: VariantAnalysis
  ): Promise<void> {
    const credentials = await Credentials.initialize(this.ctx);

    if (!credentials) {
      throw Error('Error authenticating with GitHub');
    }

    let attemptCount = 0;

    const scannedReposDownloaded: number[] = [];

    while (attemptCount <= VariantAnalysisManager.maxAttemptCount) {
      await time.sleep(VariantAnalysisManager.sleepTime);

      // Get summary
      const variantAnalysisSummary = await ghApiClient.getVariantAnalysis(
        credentials,
        variantAnalysis.controller_repo.id,
        variantAnalysis.id);

      // If failure, mark as failed locally and stop monitoring
      // until the user says to try again?

      // TODO: Raise event to update the UI

      void logger.log('****** Retrieved variant analysis' + JSON.stringify(variantAnalysisSummary));

      // TODO: Build storage path
      const variantAnalysisStoragePath = '/Users/charisk/Desktop/variant-analysis-test/';

      if (variantAnalysis.scanned_repositories) {
        for (const scannedRepo of variantAnalysis.scanned_repositories) {
          if (!scannedReposDownloaded.includes(scannedRepo.repository.id) &&
            scannedRepo.analysis_status === 'succeeded') {
            void logger.log('***** Downloading results for repo: ' + scannedRepo.repository.id);
            await this.downloadRepoResults(
              credentials,
              variantAnalysis,
              scannedRepo.repository.id,
              variantAnalysisStoragePath
            );
            scannedReposDownloaded.push(scannedRepo.repository.id);
          }
        }
      }

      if (variantAnalysis.status === 'completed') {
        if (variantAnalysis.failure_reason)
          break;
      }

      attemptCount++;
    }
  }

  private async downloadRepoResults(
    credentials: Credentials,
    variantAnalysis: VariantAnalysis,
    repoId: number,
    variantAnalysisStoragePath: string,
  ): Promise<void> {

    const repo = await ghApiClient.getVariantAnalysisRepo(
      credentials,
      variantAnalysis.controller_repo.id,
      variantAnalysis.id,
      repoId
    );

    if (!repo.artifact_url) {
      // TODO: Consider what we can do here.
      // Perhaps set a failure message?
      return;
    }

    const repoStoragePath = path.join(variantAnalysisStoragePath, repoId.toString());
    try {
      await ghApiClient.downloadVariantAnalysisResults(
        repo.artifact_url,
        repoStoragePath,
      );
    } catch (error: any) {
      // Mark variant analysis repo as could not download results
    }
  }
}
