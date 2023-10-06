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
import { DbModelingState, ModelingStore } from "../modeling-store";
import { AbstractWebviewViewProvider } from "../../common/vscode/abstract-webview-view-provider";
import { assertNever } from "../../common/helpers-pure";
import { ModelEditorViewTracker } from "../model-editor-view-tracker";

export class MethodModelingViewProvider extends AbstractWebviewViewProvider<
  ToMethodModelingMessage,
  FromMethodModelingMessage
> {
  public static readonly viewType = "codeQLMethodModeling";

  private method: Method | undefined = undefined;

  constructor(
    app: App,
    private readonly modelingStore: ModelingStore,
    private readonly editorViewTracker: ModelEditorViewTracker,
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
        const activeState = this.ensureActiveState();

        this.modelingStore.updateModeledMethod(
          activeState.databaseItem,
          msg.method,
        );
        break;
      }
      case "revealInModelEditor":
        await this.revealInModelEditor(msg.method);

        break;

      case "startModeling":
        await this.app.commands.execute(
          "codeQL.openModelEditorFromModelingPanel",
        );
        break;
      default:
        assertNever(msg);
    }
  }

  private async revealInModelEditor(method: Method): Promise<void> {
    const activeState = this.ensureActiveState();

    const views = this.editorViewTracker.getViews(
      activeState.databaseItem.databaseUri.toString(),
    );
    if (views.length === 0) {
      return;
    }

    await Promise.all(views.map((view) => view.revealMethod(method)));
  }

  private ensureActiveState(): DbModelingState {
    const activeState = this.modelingStore.getStateForActiveDb();
    if (!activeState) {
      throw new Error("No active state found in modeling store");
    }

    return activeState;
  }

  private registerToModelingStoreEvents(): void {
    this.push(
      this.modelingStore.onModeledMethodsChanged(async (e) => {
        if (this.webviewView && e.isActiveDb) {
          const modeledMethod = e.modeledMethods[this.method?.signature ?? ""];
          if (modeledMethod) {
            await this.postMessage({
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
          await this.postMessage({
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
          await this.postMessage({
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
