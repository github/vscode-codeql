import { ExtensionContext } from 'vscode';
import { Credentials } from '../authentication';
import { Logger } from '../logging';
import { downloadArtifactFromLink } from './gh-actions-api-client';
import { DownloadLink } from './download-link';
import * as path from 'path';
import * as fs from 'fs-extra';
import { AnalysisSummary } from './shared/remote-query-result';
import * as sarif from 'sarif';
import { AnalysisResults, QueryResult } from './shared/analysis-result';

export class AnalysesResultsManager {
  // Store for the results of various analyses for a single remote query.
  private readonly analysesResults: { [key: string]: QueryResult[] };

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly logger: Logger,
  ) {
    this.analysesResults = {};
  }

  public async downloadAnalysisResults(
    analysisSummary: AnalysisSummary,
  ): Promise<void> {
    const credentials = await Credentials.initialize(this.ctx);

    void this.logger.log(`Downloading and processing results for ${analysisSummary.nwo}`);

    const queryResults = await this.downloadSingleAnalysisResults(
      analysisSummary.downloadLink,
      credentials);

    this.analysesResults[analysisSummary.nwo] = queryResults;
  }

  public async downloadAllResults(
    analysisSummaries: AnalysisSummary[],
  ): Promise<void> {
    const credentials = await Credentials.initialize(this.ctx);

    void this.logger.log('Downloading and processing all results');

    for (const analysis of analysisSummaries) {
      const queryResults = await this.downloadSingleAnalysisResults(analysis.downloadLink, credentials);
      this.analysesResults[analysis.nwo] = queryResults;
    }
  }

  public getFlattenedAnalysesResults(): AnalysisResults[] {
    return Object.entries(this.analysesResults).map(([nwo, results]) => ({ nwo, results }));
  }

  private async downloadSingleAnalysisResults(
    downloadLink: DownloadLink,
    credentials: Credentials
  ): Promise<QueryResult[]> {
    const artifactPath = await downloadArtifactFromLink(credentials, downloadLink);

    if (path.extname(artifactPath) === '.sarif') {
      return await this.readResults(artifactPath);
    } else {
      // Non-problem or problem-path queries are not currently fully supported.
      return [];
    }
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
