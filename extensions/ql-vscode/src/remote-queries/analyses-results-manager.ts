import * as os from 'os';
import * as path from 'path';
import { CancellationToken, ExtensionContext } from 'vscode';

import { Credentials } from '../authentication';
import { Logger } from '../logging';
import { downloadArtifactFromLink } from './gh-actions-api-client';
import { AnalysisSummary } from './shared/remote-query-result';
import { AnalysisResults, AnalysisAlert } from './shared/analysis-result';
import { UserCancellationException } from '../commandRunner';
import { sarifParser } from '../sarif-parser';
import { extractAnalysisAlerts } from './sarif-processing';

export class AnalysesResultsManager {
  // Store for the results of various analyses for each remote query.
  // The key is the queryId and is also the name of the directory where results are stored.
  private readonly analysesResults: Map<string, AnalysisResults[]>;

  constructor(
    private readonly ctx: ExtensionContext,
    readonly storagePath: string,
    private readonly logger: Logger,
  ) {
    this.analysesResults = new Map();
  }

  public async downloadAnalysisResults(
    analysisSummary: AnalysisSummary,
    publishResults: (analysesResults: AnalysisResults[]) => Promise<void>
  ): Promise<void> {
    if (this.isAnalysisInMemory(analysisSummary)) {
      // We already have the results for this analysis in memory, don't download again.
      return;
    }

    const credentials = await Credentials.initialize(this.ctx);

    void this.logger.log(`Downloading and processing results for ${analysisSummary.nwo}`);

    await this.downloadSingleAnalysisResults(analysisSummary, credentials, publishResults);
  }

  public async downloadAnalysesResults(
    allAnalysesToDownload: AnalysisSummary[],
    token: CancellationToken | undefined,
    publishResults: (analysesResults: AnalysisResults[]) => Promise<void>
  ): Promise<void> {
    // Filter out analyses that we have already in memory.
    const analysesToDownload = allAnalysesToDownload.filter(x => !this.isAnalysisInMemory(x));

    const credentials = await Credentials.initialize(this.ctx);

    void this.logger.log('Downloading and processing analyses results');

    const batchSize = 3;
    const numOfBatches = Math.ceil(analysesToDownload.length / batchSize);
    const allFailures = [];

    for (let i = 0; i < analysesToDownload.length; i += batchSize) {
      if (token?.isCancellationRequested) {
        throw new UserCancellationException('Downloading of analyses results has been cancelled', true);
      }

      const batch = analysesToDownload.slice(i, i + batchSize);
      const batchTasks = batch.map(analysis => this.downloadSingleAnalysisResults(analysis, credentials, publishResults));

      const nwos = batch.map(a => a.nwo).join(', ');
      void this.logger.log(`Downloading batch ${Math.floor(i / batchSize) + 1} of ${numOfBatches} (${nwos})`);

      const taskResults = await Promise.allSettled(batchTasks);
      const failedTasks = taskResults.filter(x => x.status === 'rejected') as Array<PromiseRejectedResult>;
      if (failedTasks.length > 0) {
        const failures = failedTasks.map(t => t.reason.message);
        failures.forEach(f => void this.logger.log(f));
        allFailures.push(...failures);
      }
    }

    if (allFailures.length > 0) {
      throw Error(allFailures.join(os.EOL));
    }
  }

  public getAnalysesResults(queryId: string): AnalysisResults[] {
    return [...this.internalGetAnalysesResults(queryId)];
  }

  private internalGetAnalysesResults(queryId: string): AnalysisResults[] {
    return this.analysesResults.get(queryId) || [];
  }

  public removeAnalysesResults(queryId: string) {
    this.analysesResults.delete(queryId);
  }

  private async downloadSingleAnalysisResults(
    analysis: AnalysisSummary,
    credentials: Credentials,
    publishResults: (analysesResults: AnalysisResults[]) => Promise<void>
  ): Promise<void> {
    const analysisResults: AnalysisResults = {
      nwo: analysis.nwo,
      status: 'InProgress',
      results: []
    };
    const queryId = analysis.downloadLink.queryId;
    const resultsForQuery = this.internalGetAnalysesResults(queryId);
    resultsForQuery.push(analysisResults);
    this.analysesResults.set(queryId, resultsForQuery);
    void publishResults([...resultsForQuery]);
    const pos = resultsForQuery.length - 1;

    let artifactPath;
    try {
      artifactPath = await downloadArtifactFromLink(credentials, this.storagePath, analysis.downloadLink);
    }
    catch (e) {
      throw new Error(`Could not download the analysis results for ${analysis.nwo}: ${e.message}`);
    }

    let newAnaysisResults: AnalysisResults;
    if (path.extname(artifactPath) === '.sarif') {
      const queryResults = await this.readResults(artifactPath);
      newAnaysisResults = {
        ...analysisResults,
        results: queryResults,
        status: 'Completed'
      };
    } else {
      void this.logger.log('Cannot download results. Only alert and path queries are fully supported.');
      newAnaysisResults = {
        ...analysisResults,
        status: 'Failed'
      };
    }
    resultsForQuery[pos] = newAnaysisResults;
    void publishResults([...resultsForQuery]);
  }

  private async readResults(filePath: string): Promise<AnalysisAlert[]> {
    const sarifLog = await sarifParser(filePath);

    const processedSarif = extractAnalysisAlerts(sarifLog);
    if (processedSarif.errors) {
      void this.logger.log(`Error processing SARIF file: ${os.EOL}${processedSarif.errors.join(os.EOL)}`);
    }

    return processedSarif.alerts;
  }

  private isAnalysisInMemory(analysis: AnalysisSummary): boolean {
    return this.internalGetAnalysesResults(analysis.downloadLink.queryId).some(x => x.nwo === analysis.nwo);
  }
}
