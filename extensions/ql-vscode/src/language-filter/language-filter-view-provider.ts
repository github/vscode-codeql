import * as vscode from "vscode";
import { Uri, WebviewViewProvider } from "vscode";
import { getHtmlForWebview } from "../common/vscode/webview-html";
import { FromLanguageFilterMessage } from "../common/interface-types";
import { telemetryListener } from "../common/vscode/telemetry";
import { showAndLogExceptionWithTelemetry } from "../common/logging/notifications";
import { extLogger } from "../common/logging/vscode/loggers";
import { redactableError } from "../common/errors";
import { App } from "../common/app";
import { DisposableObject } from "../common/disposable-object";
import { LanguageContextStore } from "../language-context-store";

export class LanguageFilterViewProvider
  extends DisposableObject
  implements WebviewViewProvider
{
  public static readonly viewType = "codeQLLanguageFilter";

  constructor(
    private readonly app: App,
    private languageContext: LanguageContextStore,
  ) {
    super();
  }

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
      localResourceRoots: [Uri.file(this.app.extensionPath)],
    };

    const html = getHtmlForWebview(
      this.app,
      webviewView.webview,
      "language-filter",
      {
        allowInlineStyles: true,
        allowWasmEval: false,
      },
    );

    webviewView.webview.html = html;

    webviewView.webview.onDidReceiveMessage(async (msg) => this.onMessage(msg));
  }

  private async onMessage(msg: FromLanguageFilterMessage): Promise<void> {
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
          )`Unhandled error in language filter view: ${msg.error.message}`,
        );
        break;
      case "clearLanguageFilter": {
        await this.languageContext.clearLanguageContext();
        break;
      }
      case "setLanguageFilter": {
        await this.languageContext.setLanguageContext(msg.language);
        break;
      }
    }
  }
}
