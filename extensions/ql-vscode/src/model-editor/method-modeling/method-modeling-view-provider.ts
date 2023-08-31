import * as vscode from "vscode";
import { WebviewViewProvider } from "vscode";
import { getHtmlForWebview } from "../../common/vscode/webview-html";
import { FromMethodModelingMessage } from "../../common/interface-types";
import { telemetryListener } from "../../common/vscode/telemetry";
import { showAndLogExceptionWithTelemetry } from "../../common/logging/notifications";
import { extLogger } from "../../common/logging/vscode/loggers";
import { redactableError } from "../../common/errors";
import { ExternalApiUsage } from "../external-api-usage";

export class MethodModelingViewProvider implements WebviewViewProvider {
  public static readonly viewType = "codeQLMethodModeling";

  private webviewView: vscode.WebviewView | undefined = undefined;

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * This is called when a view first becomes visible. This may happen when the view is
   * first loaded or when the user hides and then shows a view again.
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri],
    };

    const html = getHtmlForWebview(
      this.context,
      webviewView.webview,
      "method-modeling",
      {
        allowInlineStyles: true,
        allowWasmEval: false,
      },
    );

    webviewView.webview.html = html;

    webviewView.webview.onDidReceiveMessage(async (msg) => this.onMessage(msg));

    this.webviewView = webviewView;
  }

  public async setMethod(method: ExternalApiUsage): Promise<void> {
    if (this.webviewView) {
      await this.webviewView.webview.postMessage({
        t: "setMethod",
        method,
      });
    }
  }

  private async onMessage(msg: FromMethodModelingMessage): Promise<void> {
    switch (msg.t) {
      case "telemetry": {
        telemetryListener?.sendUIInteraction(msg.action);
        break;
      }
      case "unhandledError":
        void showAndLogExceptionWithTelemetry(
          extLogger,
          telemetryListener,
          redactableError(
            msg.error,
          )`Unhandled error in method modeling view: ${msg.error.message}`,
        );
        break;
    }
  }
}
