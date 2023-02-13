import {
  ExtensionContext,
  Uri,
  ViewColumn,
  window as Window,
  workspace,
} from "vscode";
import { basename } from "path";

import {
  FromRemoteQueriesMessage,
  ToRemoteQueriesMessage,
} from "../pure/interface-types";
import { Logger } from "../common";
import { assertNever } from "../pure/helpers-pure";
import {
  AnalysisSummary,
  RemoteQueryResult,
  sumAnalysisSummariesResults,
} from "./remote-query-result";
import { RemoteQuery } from "./remote-query";
import {
  AnalysisSummary as AnalysisResultViewModel,
  RemoteQueryResult as RemoteQueryResultViewModel,
} from "./shared/remote-query-result";
import { showAndLogWarningMessage } from "../helpers";
import { URLSearchParams } from "url";
import { SHOW_QUERY_TEXT_MSG } from "../query-history/query-history-manager";
import { humanizeUnit } from "../pure/time";
import { AbstractWebview, WebviewPanelConfig } from "../abstract-webview";
import { telemetryListener } from "../telemetry";

export class RemoteQueriesView extends AbstractWebview<
  ToRemoteQueriesMessage,
  FromRemoteQueriesMessage
> {
  constructor(ctx: ExtensionContext, private readonly logger: Logger) {
    super(ctx);
    this.panelLoadedCallBacks.push(() => {
      void logger.log("Variant analysis results view loaded");
    });
  }

  async showResults(query: RemoteQuery, queryResult: RemoteQueryResult) {
    const panel = await this.getPanel();
    panel.reveal(undefined, true);

    await this.waitForPanelLoaded();
    const model = this.buildViewModel(query, queryResult);

    await this.postMessage({
      t: "setRemoteQueryResult",
      queryResult: model,
    });
  }

  /**
   * Builds up a model tailored to the view based on the query and result domain entities.
   * The data is cleaned up, sorted where necessary, and transformed to a format that
   * the view model can use.
   * @param query Information about the query that was run.
   * @param queryResult The result of the query.
   * @returns A fully created view model.
   */
  private buildViewModel(
    query: RemoteQuery,
    queryResult: RemoteQueryResult,
  ): RemoteQueryResultViewModel {
    const queryFileName = basename(query.queryFilePath);
    const totalResultCount = sumAnalysisSummariesResults(
      queryResult.analysisSummaries,
    );
    const executionDuration = this.getDuration(
      queryResult.executionEndTime,
      query.executionStartTime,
    );
    const analysisSummaries = this.buildAnalysisSummaries(
      queryResult.analysisSummaries,
    );
    const totalRepositoryCount = queryResult.analysisSummaries.length;
    const affectedRepositories = queryResult.analysisSummaries.filter(
      (r) => r.resultCount > 0,
    );

    return {
      queryId: queryResult.queryId,
      queryTitle: query.queryName,
      queryFileName,
      queryFilePath: query.queryFilePath,
      queryText: query.queryText,
      language: query.language,
      workflowRunUrl: `https://github.com/${query.controllerRepository.owner}/${query.controllerRepository.name}/actions/runs/${query.actionsWorkflowRunId}`,
      totalRepositoryCount,
      affectedRepositoryCount: affectedRepositories.length,
      totalResultCount,
      executionTimestamp: this.formatDate(query.executionStartTime),
      executionDuration,
      analysisSummaries,
      analysisFailures: queryResult.analysisFailures,
    };
  }

  protected getPanelConfig(): WebviewPanelConfig {
    return {
      viewId: "remoteQueriesView",
      title: "CodeQL Query Results",
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: "remote-queries",
      additionalOptions: {
        localResourceRoots: [],
      },
    };
  }

  protected onPanelDispose(): void {
    // No-op
  }

  protected async onMessage(msg: FromRemoteQueriesMessage): Promise<void> {
    switch (msg.t) {
      case "viewLoaded":
        this.onWebViewLoaded();
        break;
      case "remoteQueryError":
        void this.logger.log(`Variant analysis error: ${msg.error}`);
        break;
      case "openFile":
        await this.openFile(msg.filePath);
        break;
      case "openVirtualFile":
        await this.openVirtualFile(msg.queryText);
        break;
      case "copyRepoList":
        break;
      case "remoteQueryDownloadAnalysisResults":
        break;
      case "remoteQueryDownloadAllAnalysesResults":
        break;
      case "remoteQueryExportResults":
        break;
      case "telemetry":
        telemetryListener?.sendUIInteraction(msg.action);
        break;
      default:
        assertNever(msg);
    }
  }

  private async openFile(filePath: string) {
    try {
      const textDocument = await workspace.openTextDocument(filePath);
      await Window.showTextDocument(textDocument, ViewColumn.One);
    } catch (error) {
      void showAndLogWarningMessage(`Could not open file: ${filePath}`);
    }
  }

  private async openVirtualFile(text: string) {
    try {
      const params = new URLSearchParams({
        queryText: encodeURIComponent(SHOW_QUERY_TEXT_MSG + text),
      });
      const uri = Uri.parse(
        `remote-query:query-text.ql?${params.toString()}`,
        true,
      );
      const doc = await workspace.openTextDocument(uri);
      await Window.showTextDocument(doc, { preview: false });
    } catch (error) {
      void showAndLogWarningMessage("Could not open query text");
    }
  }

  private getDuration(startTime: number, endTime: number): string {
    const diffInMs = startTime - endTime;
    return humanizeUnit(diffInMs);
  }

  private formatDate = (millis: number): string => {
    const d = new Date(millis);
    const datePart = d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
    const timePart = d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });
    return `${datePart} at ${timePart}`;
  };

  private formatFileSize(bytes: number): string {
    const kb = bytes / 1024;
    const mb = kb / 1024;
    const gb = mb / 1024;

    if (bytes < 1024) {
      return `${bytes} bytes`;
    } else if (kb < 1024) {
      return `${kb.toFixed(2)} KB`;
    } else if (mb < 1024) {
      return `${mb.toFixed(2)} MB`;
    } else {
      return `${gb.toFixed(2)} GB`;
    }
  }

  /**
   * Builds up a list of analysis summaries, in a data structure tailored to the view.
   * @param analysisSummaries The summaries of a specific analyses.
   * @returns A fully created view model.
   */
  private buildAnalysisSummaries(
    analysisSummaries: AnalysisSummary[],
  ): AnalysisResultViewModel[] {
    const filteredAnalysisSummaries = analysisSummaries.filter(
      (r) => r.resultCount > 0,
    );

    const sortedAnalysisSummaries = filteredAnalysisSummaries.sort(
      (a, b) => b.resultCount - a.resultCount,
    );

    return sortedAnalysisSummaries.map((analysisResult) => ({
      nwo: analysisResult.nwo,
      databaseSha: analysisResult.databaseSha || "HEAD",
      resultCount: analysisResult.resultCount,
      downloadLink: analysisResult.downloadLink,
      sourceLocationPrefix: analysisResult.sourceLocationPrefix,
      fileSize: this.formatFileSize(analysisResult.fileSizeInBytes),
      starCount: analysisResult.starCount,
      lastUpdated: analysisResult.lastUpdated,
    }));
  }
}
