import { statSync } from "fs";
import { ViewColumn } from "vscode";

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
import type { HistoryItemLabelProvider } from "../query-history/history-item-label-provider";
import { PerformanceOverviewScanner } from "../log-insights/performance-comparison";
import type { ResultsView } from "../local-queries";
import { readJsonlFile } from "../common/jsonl-reader";
import type { SummaryEvent } from "../log-insights/log-summary";

export class ComparePerformanceView extends AbstractWebview<
  ToComparePerformanceViewMessage,
  FromComparePerformanceViewMessage
> {
  constructor(
    app: App,
    public logger: Logger,
    public labelProvider: HistoryItemLabelProvider,
    private resultsView: ResultsView,
  ) {
    super(app);
  }

  async showResults(fromJsonLog: string, toJsonLog: string) {
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
        async (progress) => {
          progress?.({
            // all scans have step 1 - the backing progress tracker allows increments instead of
            // steps - but for now we are happy with a tiny UI that says what is happening
            message: `Scanning ...`,
            step: 1,
            maxStep: 2,
          });
          const scanner = new PerformanceOverviewScanner();
          await readJsonlFile<SummaryEvent>(log, async (obj) => {
            scanner.onEvent(obj);
          });
          return scanner;
        },

        {
          title: `Scanning evaluator log ${logDescription} (${(bytes / 1024 / 1024).toFixed(1)} MB)`,
        },
      );
    }

    const [fromPerf, toPerf] = await Promise.all([
      fromJsonLog === ""
        ? new PerformanceOverviewScanner()
        : scanLogWithProgress(fromJsonLog, "1/2"),
      scanLogWithProgress(toJsonLog, fromJsonLog === "" ? "1/1" : "2/2"),
    ]);

    await this.postMessage({
      t: "setPerformanceComparison",
      from: fromPerf.getData(),
      to: toPerf.getData(),
      comparison: fromJsonLog !== "",
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
}
