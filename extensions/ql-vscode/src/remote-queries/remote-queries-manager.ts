import {
  CancellationToken,
  commands,
  EventEmitter,
  ExtensionContext,
  Uri,
  env,
} from "vscode";
import { nanoid } from "nanoid";
import * as path from "path";
import * as fs from "fs-extra";
import * as os from "os";

import { Credentials } from "../authentication";
import { CodeQLCliServer } from "../cli";
import { ProgressCallback } from "../commandRunner";
import {
  createTimestampFile,
  showAndLogErrorMessage,
  showAndLogInformationMessage,
  showInformationMessageWithAction,
} from "../helpers";
import { Logger } from "../common";
import { prepareRemoteQueryRun } from "./run-remote-query";
import { RemoteQueriesView } from "./remote-queries-view";
import { buildRemoteQueryEntity, RemoteQuery } from "./remote-query";
import { RemoteQueriesMonitor } from "./remote-queries-monitor";
import {
  getRemoteQueryIndex,
  getRepositoriesMetadata,
  RepositoriesMetadata,
} from "./gh-api/gh-actions-api-client";
import { RemoteQueryResultIndex } from "./remote-query-result-index";
import {
  RemoteQueryResult,
  sumAnalysisSummariesResults,
} from "./remote-query-result";
import { DownloadLink } from "./download-link";
import { AnalysesResultsManager } from "./analyses-results-manager";
import { assertNever } from "../pure/helpers-pure";
import { QueryStatus } from "../query-status";
import { DisposableObject } from "../pure/disposable-object";
import { AnalysisResults } from "./shared/analysis-result";
import { runRemoteQueriesApiRequest } from "./remote-queries-api";

const autoDownloadMaxSize = 300 * 1024;
const autoDownloadMaxCount = 100;

const noop = () => {
  /* do nothing */
};

export interface NewQueryEvent {
  queryId: string;
  query: RemoteQuery;
}

export interface RemovedQueryEvent {
  queryId: string;
}

export interface UpdatedQueryStatusEvent {
  queryId: string;
  status: QueryStatus;
  failureReason?: string;
  repositoryCount?: number;
  resultCount?: number;
}

export class RemoteQueriesManager extends DisposableObject {
  public readonly onRemoteQueryAdded;
  public readonly onRemoteQueryRemoved;
  public readonly onRemoteQueryStatusUpdate;

  private readonly remoteQueryAddedEventEmitter;
  private readonly remoteQueryRemovedEventEmitter;
  private readonly remoteQueryStatusUpdateEventEmitter;

  private readonly remoteQueriesMonitor: RemoteQueriesMonitor;
  private readonly analysesResultsManager: AnalysesResultsManager;
  private readonly view: RemoteQueriesView;

  constructor(
    private readonly ctx: ExtensionContext,
    private readonly cliServer: CodeQLCliServer,
    private readonly storagePath: string,
    logger: Logger,
  ) {
    super();
    this.analysesResultsManager = new AnalysesResultsManager(
      ctx,
      cliServer,
      storagePath,
      logger,
    );
    this.view = new RemoteQueriesView(ctx, logger, this.analysesResultsManager);
    this.remoteQueriesMonitor = new RemoteQueriesMonitor(ctx, logger);

    this.remoteQueryAddedEventEmitter = this.push(
      new EventEmitter<NewQueryEvent>(),
    );
    this.remoteQueryRemovedEventEmitter = this.push(
      new EventEmitter<RemovedQueryEvent>(),
    );
    this.remoteQueryStatusUpdateEventEmitter = this.push(
      new EventEmitter<UpdatedQueryStatusEvent>(),
    );
    this.onRemoteQueryAdded = this.remoteQueryAddedEventEmitter.event;
    this.onRemoteQueryRemoved = this.remoteQueryRemovedEventEmitter.event;
    this.onRemoteQueryStatusUpdate =
      this.remoteQueryStatusUpdateEventEmitter.event;

    this.push(this.view);
  }

  public async rehydrateRemoteQuery(
    queryId: string,
    query: RemoteQuery,
    status: QueryStatus,
  ) {
    if (!(await this.queryRecordExists(queryId))) {
      // In this case, the query was deleted from disk, most likely because it was purged
      // by another workspace.
      this.remoteQueryRemovedEventEmitter.fire({ queryId });
    } else if (status === QueryStatus.InProgress) {
      // In this case, last time we checked, the query was still in progress.
      // We need to setup the monitor to check for completion.
      await commands.executeCommand(
        "codeQL.monitorRemoteQuery",
        queryId,
        query,
      );
    }
  }

  public async removeRemoteQuery(queryId: string) {
    this.analysesResultsManager.removeAnalysesResults(queryId);
    await this.removeStorageDirectory(queryId);
  }

  public async openRemoteQueryResults(queryId: string) {
    try {
      const remoteQuery = (await this.retrieveJsonFile(
        queryId,
        "query.json",
      )) as RemoteQuery;
      const remoteQueryResult = (await this.retrieveJsonFile(
        queryId,
        "query-result.json",
      )) as RemoteQueryResult;

      // Open results in the background
      void this.openResults(remoteQuery, remoteQueryResult).then(
        noop,
        (err) => void showAndLogErrorMessage(err),
      );
    } catch (e) {
      void showAndLogErrorMessage(`Could not open query results. ${e}`);
    }
  }

  public async runRemoteQuery(
    uri: Uri | undefined,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> {
    const credentials = await Credentials.initialize(this.ctx);

    const {
      actionBranch,
      base64Pack,
      repoSelection,
      queryFile,
      queryMetadata,
      controllerRepo,
      queryStartTime,
      language,
    } = await prepareRemoteQueryRun(
      this.cliServer,
      credentials,
      uri,
      progress,
      token,
    );

    const apiResponse = await runRemoteQueriesApiRequest(
      credentials,
      actionBranch,
      language,
      repoSelection,
      controllerRepo,
      base64Pack,
    );

    if (!apiResponse) {
      return;
    }

    const workflowRunId = apiResponse.workflow_run_id;
    const repositoryCount = apiResponse.repositories_queried.length;
    const query = await buildRemoteQueryEntity(
      queryFile,
      queryMetadata,
      controllerRepo,
      queryStartTime,
      workflowRunId,
      language,
      repositoryCount,
    );

    const queryId = this.createQueryId();

    await this.prepareStorageDirectory(queryId);
    await this.storeJsonFile(queryId, "query.json", query);

    this.remoteQueryAddedEventEmitter.fire({ queryId, query });
    void commands.executeCommand("codeQL.monitorRemoteQuery", queryId, query);
  }

  public async monitorRemoteQuery(
    queryId: string,
    remoteQuery: RemoteQuery,
    cancellationToken: CancellationToken,
  ): Promise<void> {
    const credentials = await Credentials.initialize(this.ctx);

    const queryWorkflowResult = await this.remoteQueriesMonitor.monitorQuery(
      remoteQuery,
      cancellationToken,
    );

    const executionEndTime = Date.now();

    if (queryWorkflowResult.status === "CompletedSuccessfully") {
      await this.downloadAvailableResults(
        queryId,
        remoteQuery,
        credentials,
        executionEndTime,
      );
    } else if (queryWorkflowResult.status === "CompletedUnsuccessfully") {
      if (queryWorkflowResult.error?.includes("cancelled")) {
        // Workflow was cancelled on the server
        this.remoteQueryStatusUpdateEventEmitter.fire({
          queryId,
          status: QueryStatus.Failed,
          failureReason: "Cancelled",
        });
        await this.downloadAvailableResults(
          queryId,
          remoteQuery,
          credentials,
          executionEndTime,
        );
        void showAndLogInformationMessage("Variant analysis was cancelled");
      } else {
        this.remoteQueryStatusUpdateEventEmitter.fire({
          queryId,
          status: QueryStatus.Failed,
          failureReason: queryWorkflowResult.error,
        });
        void showAndLogErrorMessage(
          `Variant analysis execution failed. Error: ${queryWorkflowResult.error}`,
        );
      }
    } else if (queryWorkflowResult.status === "Cancelled") {
      this.remoteQueryStatusUpdateEventEmitter.fire({
        queryId,
        status: QueryStatus.Failed,
        failureReason: "Cancelled",
      });
      await this.downloadAvailableResults(
        queryId,
        remoteQuery,
        credentials,
        executionEndTime,
      );
      void showAndLogInformationMessage("Variant analysis was cancelled");
    } else if (queryWorkflowResult.status === "InProgress") {
      // Should not get here. Only including this to ensure `assertNever` uses proper type checking.
      void showAndLogErrorMessage(
        `Unexpected status: ${queryWorkflowResult.status}`,
      );
    } else {
      // Ensure all cases are covered
      assertNever(queryWorkflowResult.status);
    }
  }

  public async autoDownloadRemoteQueryResults(
    queryResult: RemoteQueryResult,
    token: CancellationToken,
  ): Promise<void> {
    const analysesToDownload = queryResult.analysisSummaries
      .filter((a) => a.fileSizeInBytes < autoDownloadMaxSize)
      .slice(0, autoDownloadMaxCount)
      .map((a) => ({
        nwo: a.nwo,
        databaseSha: a.databaseSha,
        resultCount: a.resultCount,
        sourceLocationPrefix: a.sourceLocationPrefix,
        downloadLink: a.downloadLink,
        fileSize: String(a.fileSizeInBytes),
      }));

    await this.analysesResultsManager.loadAnalysesResults(
      analysesToDownload,
      token,
      (results) => this.view.setAnalysisResults(results, queryResult.queryId),
    );
  }

  public async copyRemoteQueryRepoListToClipboard(queryId: string) {
    const queryResult = await this.getRemoteQueryResult(queryId);
    const repos = queryResult.analysisSummaries
      .filter((a) => a.resultCount > 0)
      .map((a) => a.nwo);

    if (repos.length > 0) {
      const text = [
        '"new-repo-list": [',
        ...repos.slice(0, -1).map((repo) => `    "${repo}",`),
        `    "${repos[repos.length - 1]}"`,
        "]",
      ];

      await env.clipboard.writeText(text.join(os.EOL));
    }
  }

  private mapQueryResult(
    executionEndTime: number,
    resultIndex: RemoteQueryResultIndex,
    queryId: string,
    metadata: RepositoriesMetadata,
  ): RemoteQueryResult {
    const analysisSummaries = resultIndex.successes.map((item) => ({
      nwo: item.nwo,
      databaseSha: item.sha || "HEAD",
      resultCount: item.resultCount,
      sourceLocationPrefix: item.sourceLocationPrefix,
      fileSizeInBytes: item.sarifFileSize
        ? item.sarifFileSize
        : item.bqrsFileSize,
      starCount: metadata[item.nwo]?.starCount,
      lastUpdated: metadata[item.nwo]?.lastUpdated,
      downloadLink: {
        id: item.artifactId.toString(),
        urlPath: `${resultIndex.artifactsUrlPath}/${item.artifactId}`,
        innerFilePath: item.sarifFileSize ? "results.sarif" : "results.bqrs",
        queryId,
      } as DownloadLink,
    }));
    const analysisFailures = resultIndex.failures.map((item) => ({
      nwo: item.nwo,
      error: item.error,
    }));

    return {
      executionEndTime,
      analysisSummaries,
      analysisFailures,
      queryId,
    };
  }

  public async openResults(query: RemoteQuery, queryResult: RemoteQueryResult) {
    await this.view.showResults(query, queryResult);
  }

  private async askToOpenResults(
    query: RemoteQuery,
    queryResult: RemoteQueryResult,
  ): Promise<void> {
    const totalResultCount = sumAnalysisSummariesResults(
      queryResult.analysisSummaries,
    );
    const totalRepoCount = queryResult.analysisSummaries.length;
    const message = `Query "${query.queryName}" run on ${totalRepoCount} repositories and returned ${totalResultCount} results`;

    const shouldOpenView = await showInformationMessageWithAction(
      message,
      "View",
    );
    if (shouldOpenView) {
      await this.openResults(query, queryResult);
    }
  }

  /**
   * Generates a unique id for this query, suitable for determining the storage location for the downloaded query artifacts.
   * @returns A unique id for this query.
   */
  private createQueryId(): string {
    return nanoid();
  }

  /**
   * Prepares a directory for storing analysis results for a single query run.
   * This directory contains a timestamp file, which will be
   * used by the query history manager to determine when the directory
   * should be deleted.
   *
   */
  private async prepareStorageDirectory(queryId: string): Promise<void> {
    await createTimestampFile(path.join(this.storagePath, queryId));
  }

  private async getRemoteQueryResult(
    queryId: string,
  ): Promise<RemoteQueryResult> {
    return await this.retrieveJsonFile<RemoteQueryResult>(
      queryId,
      "query-result.json",
    );
  }

  private async storeJsonFile<T>(
    queryId: string,
    fileName: string,
    obj: T,
  ): Promise<void> {
    const filePath = path.join(this.storagePath, queryId, fileName);
    await fs.writeFile(filePath, JSON.stringify(obj, null, 2), "utf8");
  }

  private async retrieveJsonFile<T>(
    queryId: string,
    fileName: string,
  ): Promise<T> {
    const filePath = path.join(this.storagePath, queryId, fileName);
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  }

  private async removeStorageDirectory(queryId: string): Promise<void> {
    const filePath = path.join(this.storagePath, queryId);
    await fs.remove(filePath);
  }

  private async queryRecordExists(queryId: string): Promise<boolean> {
    const filePath = path.join(this.storagePath, queryId);
    return await fs.pathExists(filePath);
  }

  /**
   * Checks whether there's a result index artifact available for the given query.
   * If so, set the query status to `Completed` and auto-download the results.
   */
  private async downloadAvailableResults(
    queryId: string,
    remoteQuery: RemoteQuery,
    credentials: Credentials,
    executionEndTime: number,
  ): Promise<void> {
    const resultIndex = await getRemoteQueryIndex(credentials, remoteQuery);
    if (resultIndex) {
      const metadata = await this.getRepositoriesMetadata(
        resultIndex,
        credentials,
      );
      const queryResult = this.mapQueryResult(
        executionEndTime,
        resultIndex,
        queryId,
        metadata,
      );
      const resultCount = sumAnalysisSummariesResults(
        queryResult.analysisSummaries,
      );
      this.remoteQueryStatusUpdateEventEmitter.fire({
        queryId,
        status: QueryStatus.Completed,
        repositoryCount: queryResult.analysisSummaries.length,
        resultCount,
      });

      await this.storeJsonFile(queryId, "query-result.json", queryResult);

      // Kick off auto-download of results in the background.
      void commands.executeCommand(
        "codeQL.autoDownloadRemoteQueryResults",
        queryResult,
      );

      // Ask if the user wants to open the results in the background.
      void this.askToOpenResults(remoteQuery, queryResult).then(noop, (err) => {
        void showAndLogErrorMessage(err);
      });
    } else {
      const controllerRepo = `${remoteQuery.controllerRepository.owner}/${remoteQuery.controllerRepository.name}`;
      const workflowRunUrl = `https://github.com/${controllerRepo}/actions/runs/${remoteQuery.actionsWorkflowRunId}`;
      void showAndLogErrorMessage(
        `There was an issue retrieving the result for the query [${remoteQuery.queryName}](${workflowRunUrl}).`,
      );
      this.remoteQueryStatusUpdateEventEmitter.fire({
        queryId,
        status: QueryStatus.Failed,
      });
    }
  }

  private async getRepositoriesMetadata(
    resultIndex: RemoteQueryResultIndex,
    credentials: Credentials,
  ) {
    const nwos = resultIndex.successes.map((s) => s.nwo);
    return await getRepositoriesMetadata(credentials, nwos);
  }

  // Pulled from the analysis results manager, so that we can get access to
  // analyses results from the "export results" command.
  public getAnalysesResults(queryId: string): AnalysisResults[] {
    return [...this.analysesResultsManager.getAnalysesResults(queryId)];
  }
}
