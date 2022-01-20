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

export class RemoteQueriesManager {
  private readonly remoteQueriesMonitor: RemoteQueriesMonitor;
  private readonly analysesResultsManager: AnalysesResultsManager;

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly logger: Logger,
    private readonly cliServer: CodeQLCliServer
  ) {
    this.analysesResultsManager = new AnalysesResultsManager(ctx, logger);
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

      const totalResultCount = queryResult.analysisSummaries.reduce((acc, cur) => acc + cur.resultCount, 0);
      const message = `Query "${query.queryName}" run on ${query.repositories.length} repositories and returned ${totalResultCount} results`;

      const shouldOpenView = await showInformationMessageWithAction(message, 'View');
      if (shouldOpenView) {
        const rqim = new RemoteQueriesInterfaceManager(this.ctx, this.logger, this.analysesResultsManager);
        await rqim.showResults(query, queryResult);
      }
    } else if (queryResult.status === 'CompletedUnsuccessfully') {
      await showAndLogErrorMessage(`Remote query execution failed. Error: ${queryResult.error}`);
      return;
    } else if (queryResult.status === 'Cancelled') {
      await showAndLogErrorMessage('Remote query monitoring was cancelled');
    }
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
