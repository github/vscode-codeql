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
import { VariantAnalysis } from './shared/variant-analysis';
import { getErrorMessage } from '../pure/helpers-pure';

export class VariantAnalysisManager extends DisposableObject {
  private readonly variantAnalysisMonitor: VariantAnalysisMonitor;

  constructor(
    private readonly ctx: ExtensionContext,
    logger: Logger,
  ) {
    super();
    this.variantAnalysisMonitor = new VariantAnalysisMonitor(ctx, logger);
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

    const credentials = await Credentials.initialize(this.ctx);
    if (!credentials) { throw Error('Error authenticating with GitHub'); }

    if (cancellationToken && cancellationToken.isCancellationRequested) {
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
    }
    catch (e) { throw new Error(`Could not download the results for variant analysis with id: ${variantAnalysisSummary.id}. Error: ${getErrorMessage(e)}`); }

    if (repoTask.artifact_url) {
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
  }
}
