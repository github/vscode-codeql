import * as vscode from "vscode";
import { Uri, WebviewViewProvider } from "vscode";
import { getHtmlForWebview } from "../../common/vscode/webview-html";
import { FromMethodModelingMessage } from "../../common/interface-types";
import { telemetryListener } from "../../common/vscode/telemetry";
import { showAndLogExceptionWithTelemetry } from "../../common/logging/notifications";
import { extLogger } from "../../common/logging/vscode/loggers";
import { App } from "../../common/app";
import { redactableError } from "../../common/errors";
import { Method } from "../method";
import { DisposableObject } from "../../common/disposable-object";
import { ModelingStore } from "../modeling-store";

export class MethodModelingViewProvider
  extends DisposableObject
  implements WebviewViewProvider
{
  public static readonly viewType = "codeQLMethodModeling";

  private webviewView: vscode.WebviewView | undefined = undefined;

  private method: Method | undefined = undefined;

  constructor(
    private readonly app: App,
    private readonly modelingStore: ModelingStore,
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
      "method-modeling",
      {
        allowInlineStyles: true,
        allowWasmEval: false,
      },
    );

    webviewView.webview.html = html;

    webviewView.webview.onDidReceiveMessage(async (msg) => this.onMessage(msg));

    this.webviewView = webviewView;

    this.setInitialState();
    this.registerToModelingStoreEvents();
  }

  public async setMethod(method: Method): Promise<void> {
    this.method = method;

    if (this.webviewView) {
      await this.webviewView.webview.postMessage({
        t: "setMethod",
        method,
      });
    }
  }

  private setInitialState(): void {
    const selectedMethod = this.modelingStore.getSelectedMethodDetails();
    if (selectedMethod) {
      void this.webviewView?.webview.postMessage({
        t: "setSelectedMethod",
        method: selectedMethod.method,
        modeledMethod: selectedMethod.modeledMethod,
        isModified: selectedMethod.isModified,
      });
    }
  }

  private async onMessage(msg: FromMethodModelingMessage): Promise<void> {
    switch (msg.t) {
      case "setModeledMethod": {
        const activeState = this.modelingStore.getStateForActiveDb();
        if (!activeState) {
          throw new Error("No active state found in modeling store");
        }
        this.modelingStore.updateModeledMethod(
          activeState.databaseItem,
          msg.method,
        );
        break;
      }

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

  private registerToModelingStoreEvents(): void {
    this.modelingStore.onModeledMethodsChanged(async (e) => {
      if (this.webviewView && e.isActiveDb) {
        const modeledMethod = e.modeledMethods[this.method?.signature ?? ""];
        if (modeledMethod) {
          await this.webviewView.webview.postMessage({
            t: "setModeledMethod",
            method: modeledMethod,
          });
        }
      }
    });

    this.modelingStore.onModifiedMethodsChanged(async (e) => {
      if (this.webviewView && e.isActiveDb && this.method) {
        const isModified = e.modifiedMethods.has(this.method.signature);
        await this.webviewView.webview.postMessage({
          t: "setMethodModified",
          isModified,
        });
      }
    });

    this.modelingStore.onSelectedMethodChanged(async (e) => {
      if (this.webviewView) {
        this.method = e.method;
        await this.webviewView.webview.postMessage({
          t: "setSelectedMethod",
          method: e.method,
          modeledMethod: e.modeledMethod,
          isModified: e.isModified,
        });
      }
    });
  }
}
