import { CancellationToken, commands, ExtensionContext, Uri, window } from 'vscode';
import { Credentials } from '../authentication';
import { CodeQLCliServer } from '../cli';
import { ProgressCallback } from '../commandRunner';
import { showAndLogErrorMessage, showInformationMessageWithAction } from '../helpers';
import { Logger } from '../logging';
import { getResultIndex, ResultIndexItem, runRemoteQuery } from './run-remote-query';
import { RemoteQueriesInterfaceManager } from './remote-queries-interface';
import { RemoteQuery } from './remote-query';
import { RemoteQueriesMonitor } from './remote-queries-monitor';
import { RemoteQueryResult } from './remote-query-result';

export class RemoteQueriesManager {
  private readonly remoteQueriesMonitor: RemoteQueriesMonitor;

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly logger: Logger,
    private readonly cliServer: CodeQLCliServer
  ) {
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
      const resultIndexItems = await this.downloadResultIndex(credentials, query);

      const totalResultCount = resultIndexItems.reduce((acc, cur) => acc + cur.results_count, 0);
      const message = `Query "${query.queryName}" run on ${query.repositories.length} repositories and returned ${totalResultCount} results`;

      const shouldOpenView = await showInformationMessageWithAction(message, 'View');
      if (shouldOpenView) {
        const queryResult = this.mapQueryResult(executionEndTime, resultIndexItems);
        const rqim = new RemoteQueriesInterfaceManager(this.ctx, this.logger);
        await rqim.showResults(query, queryResult);
      }
    } else if (queryResult.status === 'CompletedUnsuccessfully') {
      await showAndLogErrorMessage(`Remote query execution failed. Error: ${queryResult.error}`);
      return;
    } else if (queryResult.status === 'Cancelled') {
      await showAndLogErrorMessage('Remote query monitoring was cancelled');
    }
  }

  private async downloadResultIndex(credentials: Credentials, query: RemoteQuery) {
    return await getResultIndex(
      credentials,
      query.controllerRepository.owner,
      query.controllerRepository.name,
      query.actionsWorkflowRunId);
  }

  private mapQueryResult(executionEndTime: Date, resultindexItems: ResultIndexItem[]): RemoteQueryResult {
    // Example URIs are used for now, but a solution for downloading the results will soon be implemented.
    const allResultsDownloadUri = 'www.example.com';
    const analysisDownloadUri = 'www.example.com';

    const analysisResults = resultindexItems.map(ri => ({
      nwo: ri.nwo,
      resultCount: ri.results_count,
      downloadUri: analysisDownloadUri,
      fileSizeInBytes: ri.sarif_file_size || ri.bqrs_file_size,
    })
    );

    return {
      executionEndTime,
      analysisResults,
      allResultsDownloadUri,
    };
  }
}
