import type {
  FromMethodModelingMessage,
  ToMethodModelingMessage,
} from "../../common/interface-types";
import { telemetryListener } from "../../common/vscode/telemetry";
import { showAndLogExceptionWithTelemetry } from "../../common/logging/notifications";
import type { App } from "../../common/app";
import { redactableError } from "../../common/errors";
import type { Method } from "../method";
import type { ModelingStore } from "../modeling-store";
import { AbstractWebviewViewProvider } from "../../common/vscode/abstract-webview-view-provider";
import { assertNever } from "../../common/helpers-pure";
import type { ModelConfigListener } from "../../config";
import type { DatabaseItem } from "../../databases/local-databases";
import type { ModelingEvents } from "../modeling-events";
import type { QueryLanguage } from "../../common/query-language";
import { tryGetQueryLanguage } from "../../common/query-language";

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
          processedByAutoModel: selectedMethod.processedByAutoModel,
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
          true,
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
      this.modelingEvents.onModelingStateChanged(async (e) => {
        if (this.webviewView && e.isActiveDb && this.method) {
          if (e.modeledMethods !== undefined) {
            const modeledMethods = e.modeledMethods[this.method.signature];
            if (modeledMethods) {
              await this.postMessage({
                t: "setMultipleModeledMethods",
                methodSignature: this.method.signature,
                modeledMethods,
              });
            }
          }

          if (e.modifiedMethodSignatures !== undefined) {
            await this.postMessage({
              t: "setMethodModified",
              isModified: e.modifiedMethodSignatures.has(this.method.signature),
            });
          }

          if (e.inProgressMethodSignatures !== undefined) {
            const inProgress = e.inProgressMethodSignatures.has(
              this.method.signature,
            );
            await this.postMessage({
              t: "setInProgress",
              inProgress,
            });
          }

          if (e.processedByAutoModelMethodSignatures !== undefined) {
            const processedByAutoModel =
              e.processedByAutoModelMethodSignatures.has(this.method.signature);
            await this.postMessage({
              t: "setProcessedByAutoModel",
              processedByAutoModel,
            });
          }
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
            processedByAutoModel: e.processedByAutoModel,
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
  }

  private registerToModelConfigEvents(): void {
    this.push(
      this.modelConfig.onDidChangeConfiguration(() => {
        void this.setViewState();
      }),
    );
  }
}
