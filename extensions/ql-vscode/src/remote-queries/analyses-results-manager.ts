import { ExtensionContext } from 'vscode';
import { Credentials } from '../authentication';
import { Logger } from '../logging';
import { downloadArtifactFromLink } from './gh-actions-api-client';
import * as path from 'path';
import * as fs from 'fs-extra';
import { AnalysisSummary } from './shared/remote-query-result';
import * as sarif from 'sarif';
import { AnalysisResults, QueryResult } from './shared/analysis-result';

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
  ): Promise<void> {
    if (this.analysesResults.some(x => x.nwo === analysisSummary.nwo)) {
      // We already have the results for this analysis, don't download again.
      return;
    }

    const credentials = await Credentials.initialize(this.ctx);

    void this.logger.log(`Downloading and processing results for ${analysisSummary.nwo}`);

    await this.downloadSingleAnalysisResults(analysisSummary, credentials);
  }

  public async downloadAllResults(
    analysisSummaries: AnalysisSummary[],
  ): Promise<void> {
    const credentials = await Credentials.initialize(this.ctx);

    void this.logger.log('Downloading and processing all results');

    for (const analysis of analysisSummaries) {
      await this.downloadSingleAnalysisResults(analysis, credentials);
    }
  }

  public getAnalysesResults(): AnalysisResults[] {
    return [...this.analysesResults];
  }

  private async downloadSingleAnalysisResults(
    analysis: AnalysisSummary,
    credentials: Credentials
  ): Promise<void> {
    const artifactPath = await downloadArtifactFromLink(credentials, analysis.downloadLink);

    let analysisResults: AnalysisResults;

    if (path.extname(artifactPath) === '.sarif') {
      const queryResults = await this.readResults(artifactPath);
      analysisResults = { nwo: analysis.nwo, results: queryResults };
    } else {
      void this.logger.log('Non-problem or problem-path queries are not currently fully supported.');
      analysisResults = { nwo: analysis.nwo, results: [] };
    }

    this.analysesResults.push(analysisResults);
  }

  private async readResults(filePath: string): Promise<QueryResult[]> {
    const queryResults: QueryResult[] = [];

    const sarifContents = await fs.readFile(filePath, 'utf8');
    const sarifLog = JSON.parse(sarifContents) as sarif.Log;

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
