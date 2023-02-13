import { CancellationToken, env, EventEmitter, ExtensionContext } from "vscode";
import { join } from "path";
import { pathExists, readFile, remove } from "fs-extra";
import { EOL } from "os";

import { CodeQLCliServer } from "../cli";
import { showAndLogExceptionWithTelemetry } from "../helpers";
import { Logger } from "../common";
import { RemoteQueriesView } from "./remote-queries-view";
import { RemoteQuery } from "./remote-query";
import { RemoteQueryResult } from "./remote-query-result";
import { AnalysesResultsManager } from "./analyses-results-manager";
import { asError, getErrorMessage } from "../pure/helpers-pure";
import { QueryStatus } from "../query-status";
import { DisposableObject } from "../pure/disposable-object";
import { AnalysisResults } from "./shared/analysis-result";
import { App } from "../common/app";
import { redactableError } from "../pure/errors";

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

  private readonly analysesResultsManager: AnalysesResultsManager;
  private readonly view: RemoteQueriesView;

  constructor(
    ctx: ExtensionContext,
    app: App,
    cliServer: CodeQLCliServer,
    private readonly storagePath: string,
    logger: Logger,
  ) {
    super();
    this.analysesResultsManager = new AnalysesResultsManager(
      app,
      cliServer,
      storagePath,
      logger,
    );
    this.view = new RemoteQueriesView(ctx, logger, this.analysesResultsManager);

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

  public async rehydrateRemoteQuery(queryId: string) {
    if (!(await this.queryRecordExists(queryId))) {
      // In this case, the query was deleted from disk, most likely because it was purged
      // by another workspace.
      this.remoteQueryRemovedEventEmitter.fire({ queryId });
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
        (e: unknown) =>
          void showAndLogExceptionWithTelemetry(
            redactableError(
              asError(e),
            )`Could not open query results. ${getErrorMessage(e)}`,
          ),
      );
    } catch (e) {
      void showAndLogExceptionWithTelemetry(
        redactableError(
          asError(e),
        )`Could not open query results. ${getErrorMessage(e)}`,
      );
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

      await env.clipboard.writeText(text.join(EOL));
    }
  }

  public async openResults(query: RemoteQuery, queryResult: RemoteQueryResult) {
    await this.view.showResults(query, queryResult);
  }

  private async getRemoteQueryResult(
    queryId: string,
  ): Promise<RemoteQueryResult> {
    return await this.retrieveJsonFile<RemoteQueryResult>(
      queryId,
      "query-result.json",
    );
  }

  private async retrieveJsonFile<T>(
    queryId: string,
    fileName: string,
  ): Promise<T> {
    const filePath = join(this.storagePath, queryId, fileName);
    return JSON.parse(await readFile(filePath, "utf8"));
  }

  private async removeStorageDirectory(queryId: string): Promise<void> {
    const filePath = join(this.storagePath, queryId);
    await remove(filePath);
  }

  private async queryRecordExists(queryId: string): Promise<boolean> {
    const filePath = join(this.storagePath, queryId);
    return await pathExists(filePath);
  }

  // Pulled from the analysis results manager, so that we can get access to
  // analyses results from the "export results" command.
  public getAnalysesResults(queryId: string): AnalysisResults[] {
    return [...this.analysesResultsManager.getAnalysesResults(queryId)];
  }
}
