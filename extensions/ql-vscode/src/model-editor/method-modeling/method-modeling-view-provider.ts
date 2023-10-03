import {
  FromMethodModelingMessage,
  ToMethodModelingMessage,
} from "../../common/interface-types";
import { telemetryListener } from "../../common/vscode/telemetry";
import { showAndLogExceptionWithTelemetry } from "../../common/logging/notifications";
import { extLogger } from "../../common/logging/vscode/loggers";
import { App } from "../../common/app";
import { redactableError } from "../../common/errors";
import { Method } from "../method";
import { ModelingStore } from "../modeling-store";
import { AbstractWebviewViewProvider } from "../../common/vscode/abstract-webview-view-provider";

export class MethodModelingViewProvider extends AbstractWebviewViewProvider<
  ToMethodModelingMessage,
  FromMethodModelingMessage
> {
  public static readonly viewType = "codeQLMethodModeling";

  private method: Method | undefined = undefined;

  constructor(
    app: App,
    private readonly modelingStore: ModelingStore,
  ) {
    super(app, "method-modeling");
  }

  protected override onWebViewLoaded(): void {
    this.setInitialState();
    this.registerToModelingStoreEvents();
  }

  public async setMethod(method: Method): Promise<void> {
    this.method = method;

    if (this.isShowingView) {
      await this.postMessage({
        t: "setMethod",
        method,
      });
    }
  }

  private setInitialState(): void {
    const selectedMethod = this.modelingStore.getSelectedMethodDetails();
    if (selectedMethod) {
      void this.postMessage({
        t: "setSelectedMethod",
        method: selectedMethod.method,
        modeledMethod: selectedMethod.modeledMethod,
        isModified: selectedMethod.isModified,
      });
    }
  }

  protected override async onMessage(
    msg: FromMethodModelingMessage,
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
          )`Unhandled error in method modeling view: ${msg.error.message}`,
        );
        break;

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
    }
  }

  private registerToModelingStoreEvents(): void {
    this.push(
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
      }),
    );

    this.push(
      this.modelingStore.onModifiedMethodsChanged(async (e) => {
        if (this.webviewView && e.isActiveDb && this.method) {
          const isModified = e.modifiedMethods.has(this.method.signature);
          await this.webviewView.webview.postMessage({
            t: "setMethodModified",
            isModified,
          });
        }
      }),
    );

    this.push(
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
      }),
    );
  }
}
