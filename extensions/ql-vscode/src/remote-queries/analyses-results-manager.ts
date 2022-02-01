import { CancellationToken, ExtensionContext } from 'vscode';
import { Credentials } from '../authentication';
import { Logger } from '../logging';
import { downloadArtifactFromLink } from './gh-actions-api-client';
import * as path from 'path';
import { AnalysisSummary } from './shared/remote-query-result';
import { AnalysisResults, QueryResult } from './shared/analysis-result';
import { UserCancellationException } from '../commandRunner';
import * as os from 'os';
import { sarifParser } from '../sarif-parser';

export class AnalysesResultsManager {
  // Store for the results of various analyses for a single remote query.
  private readonly analysesResults: AnalysisResults[];

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly logger: Logger,
  ) {
    this.analysesResults = [];
  }

  public async downloadAnalysisResults(
    analysisSummary: AnalysisSummary,
    publishResults: (analysesResults: AnalysisResults[]) => Promise<void>
  ): Promise<void> {
    if (this.analysesResults.some(x => x.nwo === analysisSummary.nwo)) {
      // We already have the results for this analysis, don't download again.
      return;
    }

    const credentials = await Credentials.initialize(this.ctx);

    void this.logger.log(`Downloading and processing results for ${analysisSummary.nwo}`);

    await this.downloadSingleAnalysisResults(analysisSummary, credentials, publishResults);
  }

  public async downloadAnalysesResults(
    analysesToDownload: AnalysisSummary[],
    token: CancellationToken | undefined,
    publishResults: (analysesResults: AnalysisResults[]) => Promise<void>
  ): Promise<void> {
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

  public getAnalysesResults(): AnalysisResults[] {
    return [...this.analysesResults];
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

    this.analysesResults.push(analysisResults);
    void publishResults(this.analysesResults);

    let artifactPath;
    try {
      artifactPath = await downloadArtifactFromLink(credentials, analysis.downloadLink);
    }
    catch (e) {
      throw new Error(`Could not download the analysis results for ${analysis.nwo}: ${e.message}`);
    }

    if (path.extname(artifactPath) === '.sarif') {
      const queryResults = await this.readResults(artifactPath);
      analysisResults.results = queryResults;
      analysisResults.status = 'Completed';
    } else {
      void this.logger.log('Cannot download results. Only alert and path queries are fully supported.');
      analysisResults.status = 'Failed';
    }

    void publishResults(this.analysesResults);
  }

  private async readResults(filePath: string): Promise<QueryResult[]> {
    const queryResults: QueryResult[] = [];

    const sarifLog = await sarifParser(filePath);

    // Read the sarif file and extract information that we want to display
    // in the UI. For now we're only getting the message texts but we'll gradually
    // extract more information based on the UX we want to build. 

    sarifLog.runs?.forEach(run => {
      run?.results?.forEach(result => {
        if (result?.message?.text) {
          queryResults.push({
            message: result.message.text
          });
        }
      });
    });

    return queryResults;
  }
}
