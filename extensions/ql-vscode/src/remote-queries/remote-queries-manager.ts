import { CancellationToken, commands, ExtensionContext, Uri, window } from 'vscode';
import { nanoid } from 'nanoid';
import * as path from 'path';
import * as fs from 'fs-extra';

import { Credentials } from '../authentication';
import { CodeQLCliServer } from '../cli';
import { ProgressCallback } from '../commandRunner';
import { createTimestampFile, showAndLogErrorMessage, showInformationMessageWithAction } from '../helpers';
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
import { assertNever } from '../pure/helpers-pure';
import { RemoteQueryHistoryItem } from './remote-query-history-item';
import { QueryHistoryManager } from '../query-history';
import { QueryStatus } from '../query-status';
import { DisposableObject } from '../pure/disposable-object';
import { QueryHistoryInfo } from '../query-results';

const autoDownloadMaxSize = 300 * 1024;
const autoDownloadMaxCount = 100;

const noop = () => { /* do nothing */ };
export class RemoteQueriesManager extends DisposableObject {
  private readonly remoteQueriesMonitor: RemoteQueriesMonitor;
  private readonly analysesResultsManager: AnalysesResultsManager;
  private readonly interfaceManager: RemoteQueriesInterfaceManager;

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly cliServer: CodeQLCliServer,
    private readonly qhm: QueryHistoryManager,
    private readonly storagePath: string,
    logger: Logger,
  ) {
    super();
    this.analysesResultsManager = new AnalysesResultsManager(ctx, storagePath, logger);
    this.interfaceManager = new RemoteQueriesInterfaceManager(ctx, logger, this.analysesResultsManager);
    this.remoteQueriesMonitor = new RemoteQueriesMonitor(ctx, logger);

    // Handle events from the query history manager
    this.push(this.qhm.onDidAddQueryItem(this.handleAddQueryItem.bind(this)));
    this.push(this.qhm.onDidRemoveQueryItem(this.handleRemoveQueryItem.bind(this)));
    this.push(this.qhm.onWillOpenQueryItem(this.handleOpenQueryItem.bind(this)));
  }

  private async handleAddQueryItem(queryItem: QueryHistoryInfo) {
    if (queryItem?.t === 'remote') {
      if (!(await this.queryHistoryItemExists(queryItem))) {
        // In this case, the query was deleted from disk, most likely because it was purged
        // by another workspace. We should remove it from the history manager.
        await this.qhm.handleRemoveHistoryItem(queryItem);
      } else if (queryItem.status === QueryStatus.InProgress) {
        // In this case, last time we checked, the query was still in progress.
        // We need to setup the monitor to check for completion.
        await commands.executeCommand('codeQL.monitorRemoteQuery', queryItem);
      }
    }
  }

  private async handleRemoveQueryItem(queryItem: QueryHistoryInfo) {
    if (queryItem?.t === 'remote') {
      this.analysesResultsManager.removeAnalysesResults(queryItem.queryId);
      await this.removeStorageDirectory(queryItem);
    }
  }

  private async handleOpenQueryItem(queryItem: QueryHistoryInfo) {
    if (queryItem?.t === 'remote') {
      try {
        const remoteQueryResult = await this.retrieveJsonFile(queryItem, 'query-result.json') as RemoteQueryResult;
        // open results in the background
        void this.openResults(queryItem.remoteQuery, remoteQueryResult).then(
          noop,
          err => void showAndLogErrorMessage(err)
        );
      } catch (e) {
        void showAndLogErrorMessage(`Could not open query results. ${e}`);
      }
    }
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

    if (querySubmission?.query) {
      const query = querySubmission.query;
      const queryId = this.createQueryId(query.queryName);

      const queryHistoryItem: RemoteQueryHistoryItem = {
        t: 'remote',
        status: QueryStatus.InProgress,
        completed: false,
        queryId,
        label: query.queryName,
        remoteQuery: query,
      };
      await this.prepareStorageDirectory(queryHistoryItem);
      await this.storeJsonFile(queryHistoryItem, 'query.json', query);

      this.qhm.addQuery(queryHistoryItem);
      await this.qhm.refreshTreeView();
    }
  }

  public async monitorRemoteQuery(
    queryItem: RemoteQueryHistoryItem,
    cancellationToken: CancellationToken
  ): Promise<void> {
    const credentials = await Credentials.initialize(this.ctx);

    const queryWorkflowResult = await this.remoteQueriesMonitor.monitorQuery(queryItem.remoteQuery, cancellationToken);

    const executionEndTime = Date.now();

    if (queryWorkflowResult.status === 'CompletedSuccessfully') {
      const resultIndex = await getRemoteQueryIndex(credentials, queryItem.remoteQuery);
      if (!resultIndex) {
        void showAndLogErrorMessage(`There was an issue retrieving the result for the query ${queryItem.label}`);
        return;
      }
      queryItem.completed = true;
      queryItem.status = QueryStatus.Completed;
      const queryResult = this.mapQueryResult(executionEndTime, resultIndex, queryItem.queryId);

      await this.storeJsonFile(queryItem, 'query-result.json', queryResult);

      // Kick off auto-download of results in the background.
      void commands.executeCommand('codeQL.autoDownloadRemoteQueryResults', queryResult);

      // Ask if the user wants to open the results in the background.
      void this.askToOpenResults(queryItem.remoteQuery, queryResult).then(
        noop,
        err => {
          void showAndLogErrorMessage(err);
        }
      );
    } else if (queryWorkflowResult.status === 'CompletedUnsuccessfully') {
      queryItem.failureReason = queryWorkflowResult.error;
      queryItem.status = QueryStatus.Failed;
      void showAndLogErrorMessage(`Remote query execution failed. Error: ${queryWorkflowResult.error}`);
    } else if (queryWorkflowResult.status === 'Cancelled') {
      queryItem.failureReason = 'Cancelled';
      queryItem.status = QueryStatus.Failed;
      void showAndLogErrorMessage('Remote query monitoring was cancelled');
    } else if (queryWorkflowResult.status === 'InProgress') {
      // Should not get here. Only including this to ensure `assertNever` uses proper type checking.
      void showAndLogErrorMessage(`Unexpected status: ${queryWorkflowResult.status}`);
    } else {
      // Ensure all cases are covered
      assertNever(queryWorkflowResult.status);
    }
    await this.qhm.refreshTreeView();
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

  private mapQueryResult(executionEndTime: number, resultIndex: RemoteQueryResultIndex, queryId: string): RemoteQueryResult {

    const analysisSummaries = resultIndex.successes.map(item => ({
      nwo: item.nwo,
      resultCount: item.resultCount,
      fileSizeInBytes: item.sarifFileSize ? item.sarifFileSize : item.bqrsFileSize,
      downloadLink: {
        id: item.artifactId.toString(),
        urlPath: `${resultIndex.artifactsUrlPath}/${item.artifactId}`,
        innerFilePath: item.sarifFileSize ? 'results.sarif' : 'results.bqrs',
        queryId,
      } as DownloadLink
    }));
    const analysisFailures = resultIndex.failures.map(item => ({
      nwo: item.nwo,
      error: item.error
    }));

    return {
      executionEndTime,
      analysisSummaries,
      analysisFailures,
      queryId
    };
  }

  public async openResults(query: RemoteQuery, queryResult: RemoteQueryResult) {
    await this.interfaceManager.showResults(query, queryResult);
  }

  private async askToOpenResults(query: RemoteQuery, queryResult: RemoteQueryResult): Promise<void> {
    const totalResultCount = queryResult.analysisSummaries.reduce((acc, cur) => acc + cur.resultCount, 0);
    const message = `Query "${query.queryName}" run on ${query.repositories.length} repositories and returned ${totalResultCount} results`;

    const shouldOpenView = await showInformationMessageWithAction(message, 'View');
    if (shouldOpenView) {
      await this.openResults(query, queryResult);
    }
  }

  /**
   * Generates a unique id for this query, suitable for determining the storage location for the downloaded query artifacts.
   * @param queryName
   * @returns
   */
  private createQueryId(queryName: string): string {
    return `${queryName}-${nanoid()}`;

  }

  /**
   * Prepares a directory for storing analysis results for a single query run.
   * This directory contains a timestamp file, which will be
   * used by the query history manager to determine when the directory
   * should be deleted.
   *
   * @param queryName The name of the query that was run.
   */
  private async prepareStorageDirectory(queryHistoryItem: RemoteQueryHistoryItem): Promise<void> {
    await createTimestampFile(path.join(this.storagePath, queryHistoryItem.queryId));
  }

  private async storeJsonFile<T>(queryHistoryItem: RemoteQueryHistoryItem, fileName: string, obj: T): Promise<void> {
    const filePath = path.join(this.storagePath, queryHistoryItem.queryId, fileName);
    await fs.writeFile(filePath, JSON.stringify(obj, null, 2), 'utf8');
  }

  private async retrieveJsonFile<T>(queryHistoryItem: RemoteQueryHistoryItem, fileName: string): Promise<T> {
    const filePath = path.join(this.storagePath, queryHistoryItem.queryId, fileName);
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  }

  private async removeStorageDirectory(queryItem: RemoteQueryHistoryItem): Promise<void> {
    const filePath = path.join(this.storagePath, queryItem.queryId);
    await fs.remove(filePath);
  }

  private async queryHistoryItemExists(queryItem: RemoteQueryHistoryItem): Promise<boolean> {
    const filePath = path.join(this.storagePath, queryItem.queryId);
    return await fs.pathExists(filePath);
  }
}
