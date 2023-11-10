import {
  FromMethodModelingMessage,
  ToMethodModelingMessage,
} from "../../common/interface-types";
import { telemetryListener } from "../../common/vscode/telemetry";
import { showAndLogExceptionWithTelemetry } from "../../common/logging/notifications";
import { App } from "../../common/app";
import { redactableError } from "../../common/errors";
import { Method } from "../method";
import { ModelingStore } from "../modeling-store";
import { AbstractWebviewViewProvider } from "../../common/vscode/abstract-webview-view-provider";
import { assertNever } from "../../common/helpers-pure";
import { ModelConfigListener } from "../../config";
import { DatabaseItem } from "../../databases/local-databases";
import { ModelingEvents } from "../modeling-events";
import {
  QueryLanguage,
  tryGetQueryLanguage,
} from "../../common/query-language";

export class MethodModelingViewProvider extends AbstractWebviewViewProvider<
  ToMethodModelingMessage,
  FromMethodModelingMessage
> {
  public static readonly viewType = "codeQLMethodModeling";

  private method: Method | undefined = undefined;
  private databaseItem: DatabaseItem | undefined = undefined;
  private language: QueryLanguage | undefined = undefined;

  constructor(
    app: App,
    private readonly modelingStore: ModelingStore,
    private readonly modelingEvents: ModelingEvents,
    private readonly modelConfig: ModelConfigListener,
  ) {
    super(app, "method-modeling");
  }

  protected override async onWebViewLoaded(): Promise<void> {
    await Promise.all([this.setViewState(), this.setInitialState()]);
    this.registerToModelingEvents();
    this.registerToModelConfigEvents();
  }

  private async setViewState(): Promise<void> {
    await this.postMessage({
      t: "setMethodModelingPanelViewState",
      viewState: {
        language: this.language,
        showMultipleModels: this.modelConfig.showMultipleModels,
      },
    });
  }

  public async setMethod(
    databaseItem: DatabaseItem | undefined,
    method: Method | undefined,
  ): Promise<void> {
    this.method = method;
    this.databaseItem = databaseItem;
    this.language = databaseItem && tryGetQueryLanguage(databaseItem.language);

    if (this.isShowingView) {
      await this.postMessage({
        t: "setMethod",
        method,
      });
    }
  }

  private async setInitialState(): Promise<void> {
    if (this.modelingStore.hasStateForActiveDb()) {
      const selectedMethod = this.modelingStore.getSelectedMethodDetails();
      if (selectedMethod) {
        this.databaseItem = selectedMethod.databaseItem;
        this.language = tryGetQueryLanguage(
          selectedMethod.databaseItem.language,
        );
        this.method = selectedMethod.method;

        await this.postMessage({
          t: "setSelectedMethod",
          method: selectedMethod.method,
          modeledMethods: selectedMethod.modeledMethods,
          isModified: selectedMethod.isModified,
          isInProgress: selectedMethod.isInProgress,
        });
      }

      await this.postMessage({
        t: "setInModelingMode",
        inModelingMode: true,
      });
    }
  }

  protected override async onMessage(
    msg: FromMethodModelingMessage,
  ): Promise<void> {
    switch (msg.t) {
      case "viewLoaded":
        await this.onWebViewLoaded();
        break;

      case "telemetry":
        telemetryListener?.sendUIInteraction(msg.action);
        break;

      case "unhandledError":
        void showAndLogExceptionWithTelemetry(
          this.app.logger,
          telemetryListener,
          redactableError(
            msg.error,
          )`Unhandled error in method modeling view: ${msg.error.message}`,
        );
        break;

      case "setMultipleModeledMethods": {
        if (!this.databaseItem) {
          return;
        }

        this.modelingStore.updateModeledMethods(
          this.databaseItem,
          msg.methodSignature,
          msg.modeledMethods,
        );
        this.modelingStore.addModifiedMethod(
          this.databaseItem,
          msg.methodSignature,
        );
        break;
      }
      case "revealInModelEditor":
        await this.revealInModelEditor(msg.method);
        void telemetryListener?.sendUIInteraction(
          "method-modeling-reveal-in-model-editor",
        );

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
    if (!this.databaseItem) {
      return;
    }

    this.modelingEvents.fireRevealInModelEditorEvent(
      this.databaseItem.databaseUri.toString(),
      method,
    );
  }

  private registerToModelingEvents(): void {
    this.push(
      this.modelingEvents.onModeledMethodsChanged(async (e) => {
        if (this.webviewView && e.isActiveDb && this.method) {
          const modeledMethods = e.modeledMethods[this.method.signature];
          if (modeledMethods) {
            await this.postMessage({
              t: "setMultipleModeledMethods",
              methodSignature: this.method.signature,
              modeledMethods,
            });
          }
        }
      }),
    );

    this.push(
      this.modelingEvents.onModifiedMethodsChanged(async (e) => {
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
      this.modelingEvents.onSelectedMethodChanged(async (e) => {
        if (this.webviewView) {
          this.method = e.method;
          this.databaseItem = e.databaseItem;
          this.language = tryGetQueryLanguage(e.databaseItem.language);

          await this.postMessage({
            t: "setSelectedMethod",
            method: e.method,
            modeledMethods: e.modeledMethods,
            isModified: e.isModified,
            isInProgress: e.isInProgress,
          });
        }
      }),
    );

    this.push(
      this.modelingEvents.onDbOpened(async (databaseItem) => {
        this.databaseItem = databaseItem;

        await this.postMessage({
          t: "setInModelingMode",
          inModelingMode: true,
        });

        this.language = tryGetQueryLanguage(databaseItem.language);
        await this.setViewState();
      }),
    );

    this.push(
      this.modelingEvents.onDbClosed(async (dbUri) => {
        if (!this.modelingStore.anyDbsBeingModeled()) {
          await this.postMessage({
            t: "setInModelingMode",
            inModelingMode: false,
          });
        }

        if (dbUri === this.databaseItem?.databaseUri.toString()) {
          await this.setMethod(undefined, undefined);
        }
      }),
    );

    this.push(
      this.modelingEvents.onInProgressMethodsChanged(async (e) => {
        if (this.method && this.databaseItem) {
          const dbUri = this.databaseItem.databaseUri.toString();
          if (e.dbUri === dbUri) {
            const inProgress = e.methods.has(this.method.signature);
            await this.postMessage({
              t: "setInProgress",
              inProgress,
            });
          }
        }
      }),
    );
  }

  private registerToModelConfigEvents(): void {
    this.push(
      this.modelConfig.onDidChangeConfiguration(() => {
        void this.setViewState();
      }),
    );
  }
}
