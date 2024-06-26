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
import { telemetryListener } from "../common/vscode/telemetry";
import type { HistoryItemLabelProvider } from "../query-history/history-item-label-provider";
import { PerformanceOverviewScanner } from "../log-insights/performance-comparison";
import { scanLog } from "../log-insights/log-scanner";
import type { ResultsView } from "../local-queries";

export class ComparePerformanceView extends AbstractWebview<
  ToComparePerformanceViewMessage,
  FromComparePerformanceViewMessage
> {
  constructor(
    app: App,
    public cliServer: CodeQLCliServer, // TODO: make private
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

    // TODO: try processing in (async) parallel once readJsonl is streaming
    const fromPerf = await scanLog(
      fromJsonLog,
      new PerformanceOverviewScanner(),
    );
    const toPerf = await scanLog(toJsonLog, new PerformanceOverviewScanner());

    // TODO: filter out irrelevant common predicates before transfer?

    await this.postMessage({
      t: "setPerformanceComparison",
      from: fromPerf.getData(),
      to: toPerf.getData(),
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
