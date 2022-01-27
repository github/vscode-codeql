import { CancellationToken, commands, ExtensionContext, Uri, window } from 'vscode';
import { Credentials } from '../authentication';
import { CodeQLCliServer } from '../cli';
import { ProgressCallback } from '../commandRunner';
import { showAndLogErrorMessage, showInformationMessageWithAction } from '../helpers';
import { Logger } from '../logging';
import { runRemoteQuery } from './run-remote-query';
import { RemoteQueriesInterfaceManager } from './remote-queries-interface';
import { RemoteQuery } from './remote-query';
import { RemoteQueriesMonitor } from './remote-queries-monitor';
import { getRemoteQueryIndex } from './gh-actions-api-client';
import { RemoteQueryResultIndex } from './remote-query-result-index';
import { RemoteQueryResult } from './remote-query-result';
import { DownloadLink } from './download-link';
import { AnalysesResultsManager } from './analyses-results-manager';

const autoDownloadMaxSize = 300 * 1024;
const autoDownloadMaxCount = 100;

export class RemoteQueriesManager {
  private readonly remoteQueriesMonitor: RemoteQueriesMonitor;
  private readonly analysesResultsManager: AnalysesResultsManager;
  private readonly interfaceManager: RemoteQueriesInterfaceManager;

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly cliServer: CodeQLCliServer,
    logger: Logger,
  ) {
    this.analysesResultsManager = new AnalysesResultsManager(ctx, logger);
    this.interfaceManager = new RemoteQueriesInterfaceManager(ctx, logger, this.analysesResultsManager);
    this.remoteQueriesMonitor = new RemoteQueriesMonitor(ctx, logger);
  }

  public async runRemoteQuery(
    uri: Uri | undefined,
    progress: ProgressCallback,
    token: CancellationToken
  ): Promise<void> {
    const credentials = await Credentials.initialize(this.ctx);

    const querySubmission = await runRemoteQuery(
      this.cliServer,
      credentials, uri || window.activeTextEditor?.document.uri,
      false,
      progress,
      token);

    if (querySubmission && querySubmission.query) {
      void commands.executeCommand('codeQL.monitorRemoteQuery', querySubmission.query);
    }
  }

  public async monitorRemoteQuery(
    query: RemoteQuery,
    cancellationToken: CancellationToken
  ): Promise<void> {
    const credentials = await Credentials.initialize(this.ctx);

    const queryResult = await this.remoteQueriesMonitor.monitorQuery(query, cancellationToken);

    const executionEndTime = new Date();

    if (queryResult.status === 'CompletedSuccessfully') {
      const resultIndex = await getRemoteQueryIndex(credentials, query);
      if (!resultIndex) {
        void showAndLogErrorMessage(`There was an issue retrieving the result for the query ${query.queryName}`);
        return;
      }

      const queryResult = this.mapQueryResult(executionEndTime, resultIndex);

      // Kick off auto-download of results.
      void commands.executeCommand('codeQL.autoDownloadRemoteQueryResults', queryResult);

      const totalResultCount = queryResult.analysisSummaries.reduce((acc, cur) => acc + cur.resultCount, 0);
      const message = `Query "${query.queryName}" run on ${query.repositories.length} repositories and returned ${totalResultCount} results`;

      const shouldOpenView = await showInformationMessageWithAction(message, 'View');
      if (shouldOpenView) {
        await this.interfaceManager.showResults(query, queryResult);

      }
    } else if (queryResult.status === 'CompletedUnsuccessfully') {
      await showAndLogErrorMessage(`Remote query execution failed. Error: ${queryResult.error}`);
      return;
    } else if (queryResult.status === 'Cancelled') {
      await showAndLogErrorMessage('Remote query monitoring was cancelled');
    }
  }

  public async autoDownloadRemoteQueryResults(
    queryResult: RemoteQueryResult,
    token: CancellationToken
  ): Promise<void> {
    const analysesToDownload = queryResult.analysisSummaries
      .filter(a => a.fileSizeInBytes < autoDownloadMaxSize)
      .slice(0, autoDownloadMaxCount)
      .map(a => ({
        nwo: a.nwo,
        resultCount: a.resultCount,
        downloadLink: a.downloadLink,
        fileSize: String(a.fileSizeInBytes)
      }));

    await this.analysesResultsManager.downloadAnalysesResults(
      analysesToDownload,
      token,
      results => this.interfaceManager.setAnalysisResults(results));
  }

  private mapQueryResult(executionEndTime: Date, resultIndex: RemoteQueryResultIndex): RemoteQueryResult {
    const analysisSummaries = resultIndex.items.map(item => ({
      nwo: item.nwo,
      resultCount: item.resultCount,
      fileSizeInBytes: item.sarifFileSize ? item.sarifFileSize : item.bqrsFileSize,
      downloadLink: {
        id: item.artifactId.toString(),
        urlPath: `${resultIndex.artifactsUrlPath}/${item.artifactId}`,
        innerFilePath: item.sarifFileSize ? 'results.sarif' : 'results.bqrs'
      } as DownloadLink
    }));

    return {
      executionEndTime,
      analysisSummaries,
      allResultsDownloadLink: {
        id: resultIndex.allResultsArtifactId.toString(),
        urlPath: `${resultIndex.artifactsUrlPath}/${resultIndex.allResultsArtifactId}`
      }
    };
  }
}
