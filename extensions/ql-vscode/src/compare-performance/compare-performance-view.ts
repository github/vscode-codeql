import { statSync } from "fs";
import path from "path";
import { ViewColumn } from "vscode";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { App } from "../common/app";
import { redactableError } from "../common/errors";
import type {
  FromComparePerformanceViewMessage,
  ToComparePerformanceViewMessage,
} from "../common/interface-types";
import type { Logger } from "../common/logging";
import { showAndLogExceptionWithTelemetry } from "../common/logging";
import { extLogger } from "../common/logging/vscode";
import type { WebviewPanelConfig } from "../common/vscode/abstract-webview";
import { AbstractWebview } from "../common/vscode/abstract-webview";
import { withProgress } from "../common/vscode/progress";
import { telemetryListener } from "../common/vscode/telemetry";
import type { ResultsView } from "../local-queries";
import { scanLog } from "../log-insights/log-scanner";
import type { ComparePerformanceDescriptionData } from "../log-insights/performance-comparison";
import { PerformanceOverviewScanner } from "../log-insights/performance-comparison";
import type { HistoryItemLabelProvider } from "../query-history/history-item-label-provider";
import { RemoteLogs } from "./remote-logs";

type ComparePerformanceCommands = {
  "codeQL.compare-performance.downloadExternalLogs": () => Promise<void>;
};

export class ComparePerformanceView extends AbstractWebview<
  ToComparePerformanceViewMessage,
  FromComparePerformanceViewMessage
> {
  private workingDirectory;

  constructor(
    app: App,
    public cliServer: CodeQLCliServer, // TODO: make private
    public logger: Logger,
    public labelProvider: HistoryItemLabelProvider,
    private resultsView: ResultsView,
  ) {
    super(app);
    this.workingDirectory = path.join(
      app.globalStoragePath,
      "compare-performance",
    );
  }

  async showResults(
    fromJsonLog: string | undefined,
    toJsonLog: string,
    description: ComparePerformanceDescriptionData,
  ) {
    const panel = await this.getPanel();
    panel.reveal(undefined, false);

    // Close the results viewer as it will have opened when the user clicked the query in the history view
    // (which they must do as part of the UI interaction for opening the performance view).
    // The performance view generally needs a lot of width so it's annoying to have the result viewer open.
    this.resultsView.hidePanel();

    await this.waitForPanelLoaded();

    function scanLogWithProgress(log: string, logDescription: string) {
      const bytes = statSync(log).size;
      return withProgress(
        async (progress) =>
          scanLog(log, new PerformanceOverviewScanner(), progress),

        {
          title: `Scanning evaluator log ${logDescription} (${(bytes / 1024 / 1024).toFixed(1)} MB)`,
        },
      );
    }

    const [fromPerf, toPerf] = await Promise.all([
      fromJsonLog
        ? scanLogWithProgress(fromJsonLog, "1/2")
        : new PerformanceOverviewScanner(),
      scanLogWithProgress(toJsonLog, fromJsonLog ? "2/2" : "1/1"),
    ]);

    // TODO: filter out irrelevant common predicates before transfer?

    await this.postMessage({
      t: "setPerformanceComparison",
      description,
      from: fromPerf.getData(),
      to: toPerf.getData(),
      comparison: !!fromJsonLog,
    });
  }

  protected getPanelConfig(): WebviewPanelConfig {
    return {
      viewId: "comparePerformanceView",
      title: "Compare CodeQL Performance",
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: "compare-performance",
    };
  }

  protected onPanelDispose(): void {}

  protected async onMessage(
    msg: FromComparePerformanceViewMessage,
  ): Promise<void> {
    switch (msg.t) {
      case "viewLoaded":
        this.onWebViewLoaded();
        break;

      case "telemetry":
        telemetryListener?.sendUIInteraction(msg.action);
        break;

      case "unhandledError":
        void showAndLogExceptionWithTelemetry(
          extLogger,
          telemetryListener,
          redactableError(
            msg.error,
          )`Unhandled error in performance comparison view: ${msg.error.message}`,
        );
        break;
    }
  }

  public getCommands(): ComparePerformanceCommands {
    return {
      "codeQL.compare-performance.downloadExternalLogs":
        this.downloadExternalLogs.bind(this),
    };
  }

  async downloadExternalLogs(): Promise<void> {
    const result = await new RemoteLogs(
      this.workingDirectory,
      this.app,
      this.cliServer,
    ).downloadAndProcess();
    if (!result) {
      void extLogger.log(
        "No results to show (errors should have prevented us from getting here, so this is most likely some benign user-cancelled operation)",
      );
      return;
    }
    await this.showResults(result.before, result.after, result.description);
  }
}
