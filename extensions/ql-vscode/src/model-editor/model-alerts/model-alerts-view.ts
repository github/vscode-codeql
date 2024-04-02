import { Uri, ViewColumn } from "vscode";
import type { WebviewPanelConfig } from "../../common/vscode/abstract-webview";
import { AbstractWebview } from "../../common/vscode/abstract-webview";
import { assertNever } from "../../common/helpers-pure";
import { telemetryListener } from "../../common/vscode/telemetry";
import type {
  FromModelAlertsMessage,
  ToModelAlertsMessage,
} from "../../common/interface-types";
import type { App } from "../../common/app";
import { redactableError } from "../../common/errors";
import { extLogger } from "../../common/logging/vscode";
import { showAndLogExceptionWithTelemetry } from "../../common/logging";
import type { ModelingEvents } from "../modeling-events";
import type { ModelingStore } from "../modeling-store";
import type { DatabaseItem } from "../../databases/local-databases";
import type { ExtensionPack } from "../shared/extension-pack";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryResult,
} from "../../variant-analysis/shared/variant-analysis";
import type { AppEvent, AppEventEmitter } from "../../common/events";
import type { ModeledMethod } from "../modeled-method";
import type { MethodSignature } from "../method";

export class ModelAlertsView extends AbstractWebview<
  ToModelAlertsMessage,
  FromModelAlertsMessage
> {
  public static readonly viewType = "codeQL.modelAlerts";

  public readonly onEvaluationRunStopClicked: AppEvent<void>;
  private readonly onEvaluationRunStopClickedEventEmitter: AppEventEmitter<void>;

  public constructor(
    app: App,
    private readonly modelingEvents: ModelingEvents,
    private readonly modelingStore: ModelingStore,
    private readonly dbItem: DatabaseItem,
    private readonly extensionPack: ExtensionPack,
  ) {
    super(app);

    this.registerToModelingEvents();

    this.onEvaluationRunStopClickedEventEmitter = this.push(
      app.createEventEmitter<void>(),
    );
    this.onEvaluationRunStopClicked =
      this.onEvaluationRunStopClickedEventEmitter.event;
  }

  public async showView(
    reposResults: VariantAnalysisScannedRepositoryResult[],
  ) {
    const panel = await this.getPanel();
    panel.reveal(undefined, true);

    await this.waitForPanelLoaded();
    await this.setViewState();
    await this.setReposResults(reposResults);
  }

  protected async getPanelConfig(): Promise<WebviewPanelConfig> {
    return {
      viewId: ModelAlertsView.viewType,
      title: "Model Alerts",
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: "model-alerts",
    };
  }

  protected onPanelDispose(): void {
    this.modelingStore.updateIsModelAlertsViewOpen(this.dbItem, false);
  }

  protected async onMessage(msg: FromModelAlertsMessage): Promise<void> {
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
          )`Unhandled error in model alerts view: ${msg.error.message}`,
        );
        break;
      case "openModelPack":
        await this.app.commands.execute("revealInExplorer", Uri.file(msg.path));
        break;
      case "openActionsLogs":
        await this.app.commands.execute(
          "codeQLModelAlerts.openVariantAnalysisLogs",
          msg.variantAnalysisId,
        );
        break;
      case "stopEvaluationRun":
        await this.stopEvaluationRun();
        break;
      case "revealInModelEditor":
        await this.revealInModelEditor(msg.method);
        break;
      default:
        assertNever(msg);
    }
  }

  private async setViewState(): Promise<void> {
    await this.postMessage({
      t: "setModelAlertsViewState",
      viewState: {
        title: this.extensionPack.name,
      },
    });
  }

  public async setVariantAnalysis(
    variantAnalysis: VariantAnalysis,
  ): Promise<void> {
    if (!this.isShowingPanel) {
      return;
    }

    await this.postMessage({
      t: "setVariantAnalysis",
      variantAnalysis,
    });
  }

  public async setReposResults(
    repoResults: VariantAnalysisScannedRepositoryResult[],
  ): Promise<void> {
    if (!this.isShowingPanel) {
      return;
    }

    await this.postMessage({
      t: "setRepoResults",
      repoResults,
    });
  }

  public async focusView(): Promise<void> {
    this.panel?.reveal();
  }

  private registerToModelingEvents() {
    this.push(
      this.modelingEvents.onFocusModelAlertsView(async (event) => {
        if (event.dbUri === this.dbItem.databaseUri.toString()) {
          await this.focusView();
        }
      }),
    );

    this.push(
      this.modelingEvents.onDbClosed(async (event) => {
        if (event === this.dbItem.databaseUri.toString()) {
          this.dispose();
        }
      }),
    );

    this.push(
      this.modelingEvents.onRevealInModelAlertsView(async (event) => {
        if (event.dbUri === this.dbItem.databaseUri.toString()) {
          await this.revealMethod(event.modeledMethod);
        }
      }),
    );
  }

  private async stopEvaluationRun() {
    this.onEvaluationRunStopClickedEventEmitter.fire();
  }

  private async revealInModelEditor(method: MethodSignature): Promise<void> {
    if (!this.dbItem) {
      return;
    }

    this.modelingEvents.fireRevealInModelEditorEvent(
      this.dbItem.databaseUri.toString(),
      method,
    );
  }

  private async revealMethod(method: ModeledMethod): Promise<void> {
    const panel = await this.getPanel();

    panel?.reveal();

    await this.postMessage({
      t: "revealModel",
      modeledMethod: method,
    });
  }
}
