import {
  WebviewPanel,
  ExtensionContext,
  window as Window,
  ViewColumn,
  Uri,
} from 'vscode';
import * as path from 'path';

import { tmpDir } from '../run-queries';
import {
  ToRemoteQueriesMessage,
  FromRemoteQueriesMessage,
} from '../pure/interface-types';
import { Logger } from '../logging';
import { getHtmlForWebview } from '../interface-utils';
import { assertNever } from '../pure/helpers-pure';
import { AnalysisResult, RemoteQueryResult } from './remote-query-result';
import { RemoteQuery } from './remote-query';
import { RemoteQueryResult as RemoteQueryResultViewModel } from './view/remote-query-result';
import { AnalysisResult as AnalysisResultViewModel } from './view/remote-query-result';

export class RemoteQueriesInterfaceManager {
  private panel: WebviewPanel | undefined;
  private panelLoaded = false;
  private panelLoadedCallBacks: (() => void)[] = [];

  constructor(
    private ctx: ExtensionContext,
    private logger: Logger,
  ) {
    this.panelLoadedCallBacks.push(() => {
      void logger.log('Remote queries view loaded');
    });
  }

  async showResults(query: RemoteQuery, queryResult: RemoteQueryResult) {
    this.getPanel().reveal(undefined, true);

    await this.waitForPanelLoaded();
    await this.postMessage({
      t: 'setRemoteQueryResult',
      d: this.createViewModel(query, queryResult)
    });
  }

  private createViewModel(query: RemoteQuery, queryResult: RemoteQueryResult): RemoteQueryResultViewModel {
    const queryFile = path.basename(query.queryFilePath);
    const totalResultCount = queryResult.analysisResults.reduce((acc, cur) => acc + cur.resultCount, 0);
    const executionDuration = this.getDuration(queryResult.executionEndTime, query.executionStartTime);
    const analysisResults = this.mapAnalysisResults(queryResult.analysisResults);
    const affectedRepositories = queryResult.analysisResults.filter(r => r.resultCount > 0);

    return {
      queryTitle: query.queryName,
      queryFile: queryFile,
      totalRepositoryCount: query.repositories.length,
      affectedRepositoryCount: affectedRepositories.length,
      totalResultCount: totalResultCount,
      executionTimestamp: this.formatDate(query.executionStartTime),
      executionDuration: executionDuration,
      downloadLink: queryResult.allResultsDownloadUri,
      results: analysisResults
    };
  }

  getPanel(): WebviewPanel {
    if (this.panel == undefined) {
      const { ctx } = this;
      const panel = (this.panel = Window.createWebviewPanel(
        'remoteQueriesView',
        'Remote Query Results',
        { viewColumn: ViewColumn.Active, preserveFocus: true },
        {
          enableScripts: true,
          enableFindWidget: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            Uri.file(tmpDir.name),
            Uri.file(path.join(this.ctx.extensionPath, 'out')),
          ],
        }
      ));
      this.panel.onDidDispose(
        () => {
          this.panel = undefined;
        },
        null,
        ctx.subscriptions
      );

      const scriptPathOnDisk = Uri.file(
        ctx.asAbsolutePath('out/remoteQueriesView.js')
      );

      const stylesheetPathOnDisk = Uri.file(
        ctx.asAbsolutePath('out/remote-queries/view/remoteQueries.css')
      );

      panel.webview.html = getHtmlForWebview(
        panel.webview,
        scriptPathOnDisk,
        stylesheetPathOnDisk
      );
      panel.webview.onDidReceiveMessage(
        async (e) => this.handleMsgFromView(e),
        undefined,
        ctx.subscriptions
      );
    }
    return this.panel;
  }

  private waitForPanelLoaded(): Promise<void> {
    return new Promise((resolve) => {
      if (this.panelLoaded) {
        resolve();
      } else {
        this.panelLoadedCallBacks.push(resolve);
      }
    });
  }

  private async handleMsgFromView(
    msg: FromRemoteQueriesMessage
  ): Promise<void> {
    switch (msg.t) {
      case 'remoteQueryLoaded':
        this.panelLoaded = true;
        this.panelLoadedCallBacks.forEach((cb) => cb());
        this.panelLoadedCallBacks = [];
        break;
      case 'remoteQueryError':
        void this.logger.log(
          `Remote query error: ${msg.error}`
        );
        break;
      default:
        assertNever(msg);
    }
  }

  private postMessage(msg: ToRemoteQueriesMessage): Thenable<boolean> {
    return this.getPanel().webview.postMessage(msg);
  }

  private getDuration(startTime: Date, endTime: Date): string {
    const diffInMs = startTime.getTime() - endTime.getTime();
    return this.formatDuration(diffInMs);
  }

  private formatDuration(ms: number): string {
    const seconds = ms / 1000;
    const minutes = seconds / 60;
    const hours = minutes / 60;
    const days = hours / 24;
    if (days > 1) {
      return `${days.toFixed(2)} days`;
    } else if (hours > 1) {
      return `${hours.toFixed(2)} hours`;
    } else if (minutes > 1) {
      return `${minutes.toFixed(2)} minutes`;
    } else {
      return `${seconds.toFixed(2)} seconds`;
    }
  }

  private formatDate = (d: Date): string => {
    const datePart = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: 'numeric', hour12: true });
    return `${datePart} at ${timePart}`;
  };

  private formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} bytes`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} kb`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / 1024 / 1024).toFixed(2)} mb`;
    } else {
      return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} gb`;
    }
  }

  private mapAnalysisResults(analysisResults: AnalysisResult[]): AnalysisResultViewModel[] {
    const filteredAnalysisResults = analysisResults.filter(r => r.resultCount > 0);

    const sortedAnalysisResults = filteredAnalysisResults.sort((a, b) => {
      if (a.resultCount > b.resultCount) {
        return -1;
      } else if (a.resultCount < b.resultCount) {
        return 1;
      } else {
        return 0;
      }
    });

    return sortedAnalysisResults.map((analysisResult) => ({
      nwo: analysisResult.nwo,
      resultCount: analysisResult.resultCount,
      downloadLink: analysisResult.downloadUri,
      fileSize: this.formatFileSize(analysisResult.fileSizeInBytes)
    }));
  }
}

