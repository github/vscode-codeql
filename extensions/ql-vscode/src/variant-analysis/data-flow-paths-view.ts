import { ExtensionContext, ViewColumn } from "vscode";
import {
  AbstractWebview,
  WebviewPanelConfig,
} from "../common/vscode/abstract-webview";
import { assertNever } from "../pure/helpers-pure";
import { telemetryListener } from "../telemetry";
import {
  FromDataFlowPathsMessage,
  ToDataFlowPathsMessage,
} from "../pure/interface-types";
import { DataFlowPaths } from "./shared/data-flow-paths";
import { redactableError } from "../pure/errors";
import { extLogger } from "../common";
import { showAndLogExceptionWithTelemetry } from "../common/vscode/logging";

export class DataFlowPathsView extends AbstractWebview<
  ToDataFlowPathsMessage,
  FromDataFlowPathsMessage
> {
  public static readonly viewType = "codeQL.dataFlowPaths";

  public constructor(ctx: ExtensionContext) {
    super(ctx);
  }

  public async showDataFlows(dataFlowPaths: DataFlowPaths) {
    const panel = await this.getPanel();
    panel.reveal(undefined, true);

    await this.waitForPanelLoaded();

    await this.postMessage({
      t: "setDataFlowPaths",
      dataFlowPaths,
    });
  }

  protected async getPanelConfig(): Promise<WebviewPanelConfig> {
    return {
      viewId: DataFlowPathsView.viewType,
      title: "Data Flow Paths",
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: "data-flow-paths",
    };
  }

  protected onPanelDispose(): void {
    // Nothing to dispose
  }

  protected async onMessage(msg: FromDataFlowPathsMessage): Promise<void> {
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
          redactableError(
            msg.error,
          )`Unhandled error in data flow paths view: ${msg.error.message}`,
        );
        break;
      default:
        assertNever(msg);
    }
  }
}
