import type {
  FromMethodModelingMessage,
  ToMethodModelingMessage,
} from "../../common/interface-types";
import { telemetryListener } from "../../common/vscode/telemetry";
import { showAndLogExceptionWithTelemetry } from "../../common/logging/notifications";
import type { App } from "../../common/app";
import { redactableError } from "../../common/errors";
import type { Method, MethodSignature } from "../method";
import type { ModelingStore } from "../modeling-store";
import { AbstractWebviewViewProvider } from "../../common/vscode/abstract-webview-view-provider";
import { assertNever } from "../../common/helpers-pure";
import type { ModelConfigListener } from "../../config";
import type { DatabaseItem } from "../../databases/local-databases";
import type { ModelingEvents } from "../modeling-events";
import type { QueryLanguage } from "../../common/query-language";
import { tryGetQueryLanguage } from "../../common/query-language";
import { createModelConfig } from "../languages";
import type { ModeledMethod } from "../modeled-method";

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
    await this.setInitialState();
    this.registerToModelingEvents();
    this.registerToModelConfigEvents();
  }

  private async setViewState(): Promise<void> {
    await this.postMessage({
      t: "setMethodModelingPanelViewState",
      viewState: {
        language: this.language,
        modelConfig: createModelConfig(this.modelConfig),
      },
    });
  }

  private async setDatabaseItem(databaseItem: DatabaseItem): Promise<void> {
    this.databaseItem = databaseItem;

    await this.postMessage({
      t: "setInModelingMode",
      inModelingMode: true,
    });

    this.language = tryGetQueryLanguage(databaseItem.language);
    await this.setViewState();
  }

  private async setSelectedMethod(
    databaseItem: DatabaseItem,
    method: Method,
    modeledMethods: readonly ModeledMethod[],
    isModified: boolean,
  ): Promise<void> {
    this.method = method;
    this.databaseItem = databaseItem;
    this.language = tryGetQueryLanguage(databaseItem.language);

    await this.postMessage({
      t: "setSelectedMethod",
      method,
      modeledMethods,
      isModified,
    });
  }

  private async setInitialState(): Promise<void> {
    await this.setViewState();

    const stateForActiveDb = this.modelingStore.getStateForActiveDb();
    if (!stateForActiveDb) {
      return;
    }

    await this.setDatabaseItem(stateForActiveDb.databaseItem);

    const selectedMethod = this.modelingStore.getSelectedMethodDetails();
    if (selectedMethod) {
      await this.setSelectedMethod(
        stateForActiveDb.databaseItem,
        selectedMethod.method,
        selectedMethod.modeledMethods,
        selectedMethod.isModified,
      );
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

  private async revealInModelEditor(method: MethodSignature): Promise<void> {
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
      this.modelingEvents.onModeledAndModifiedMethodsChanged(async (e) => {
        if (this.webviewView && e.isActiveDb && this.method) {
          const modeledMethods = e.modeledMethods[this.method.signature];
          if (modeledMethods) {
            await this.postMessage({
              t: "setMultipleModeledMethods",
              methodSignature: this.method.signature,
              modeledMethods,
            });
          }

          await this.postMessage({
            t: "setMethodModified",
            isModified: e.modifiedMethodSignatures.has(this.method.signature),
          });
        }
      }),
    );

    this.push(
      this.modelingEvents.onSelectedMethodChanged(async (e) => {
        if (this.webviewView) {
          await this.setSelectedMethod(
            e.databaseItem,
            e.method,
            e.modeledMethods,
            e.isModified,
          );
        }
      }),
    );

    this.push(
      this.modelingEvents.onDbOpened(async (databaseItem) => {
        await this.setDatabaseItem(databaseItem);
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
          await this.postMessage({
            t: "setNoMethodSelected",
          });
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
