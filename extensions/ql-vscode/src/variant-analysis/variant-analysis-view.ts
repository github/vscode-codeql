import { commands, ExtensionContext, ViewColumn } from "vscode";
import { AbstractWebview, WebviewPanelConfig } from "../abstract-webview";
import { extLogger } from "../common";
import {
  FromVariantAnalysisMessage,
  ToVariantAnalysisMessage,
} from "../pure/interface-types";
import { assertNever } from "../pure/helpers-pure";
import {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
} from "./shared/variant-analysis";
import {
  VariantAnalysisViewInterface,
  VariantAnalysisViewManager,
} from "./variant-analysis-view-manager";
import {
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
} from "../helpers";
import { telemetryListener } from "../telemetry";
import { redactableError } from "../pure/errors";

export class VariantAnalysisView
  extends AbstractWebview<ToVariantAnalysisMessage, FromVariantAnalysisMessage>
  implements VariantAnalysisViewInterface
{
  public static readonly viewType = "codeQL.variantAnalysis";

  public constructor(
    ctx: ExtensionContext,
    public readonly variantAnalysisId: number,
    private readonly manager: VariantAnalysisViewManager<VariantAnalysisView>,
  ) {
    super(ctx);

    manager.registerView(this);
  }

  public async openView() {
    const panel = await this.getPanel();
    panel.reveal(undefined, true);

    await this.waitForPanelLoaded();
  }

  public async updateView(variantAnalysis: VariantAnalysis): Promise<void> {
    if (!this.isShowingPanel) {
      return;
    }

    await this.postMessage({
      t: "setVariantAnalysis",
      variantAnalysis,
    });

    const panel = await this.getPanel();
    panel.title = this.getTitle(variantAnalysis);
  }

  public async updateRepoState(
    repoState: VariantAnalysisScannedRepositoryState,
  ): Promise<void> {
    if (!this.isShowingPanel) {
      return;
    }

    await this.postMessage({
      t: "setRepoStates",
      repoStates: [repoState],
    });
  }

  public async sendRepositoryResults(
    repositoryResult: VariantAnalysisScannedRepositoryResult[],
  ): Promise<void> {
    if (!this.isShowingPanel) {
      return;
    }

    await this.postMessage({
      t: "setRepoResults",
      repoResults: repositoryResult,
    });
  }

  protected async getPanelConfig(): Promise<WebviewPanelConfig> {
    const variantAnalysis = await this.manager.getVariantAnalysis(
      this.variantAnalysisId,
    );

    return {
      viewId: VariantAnalysisView.viewType,
      title: this.getTitle(variantAnalysis),
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: "variant-analysis",
    };
  }

  protected onPanelDispose(): void {
    this.manager.unregisterView(this);
  }

  protected async onMessage(msg: FromVariantAnalysisMessage): Promise<void> {
    switch (msg.t) {
      case "viewLoaded":
        await this.onWebViewLoaded();

        break;
      case "cancelVariantAnalysis":
        void commands.executeCommand(
          "codeQL.cancelVariantAnalysis",
          this.variantAnalysisId,
        );
        break;
      case "requestRepositoryResults":
        void commands.executeCommand(
          "codeQL.loadVariantAnalysisRepoResults",
          this.variantAnalysisId,
          msg.repositoryFullName,
        );
        break;
      case "openQueryFile":
        await this.manager.openQueryFile(this.variantAnalysisId);
        break;
      case "openQueryText":
        void commands.executeCommand(
          "codeQL.openVariantAnalysisQueryText",
          this.variantAnalysisId,
        );
        break;
      case "copyRepositoryList":
        void commands.executeCommand(
          "codeQL.copyVariantAnalysisRepoList",
          this.variantAnalysisId,
          msg.filterSort,
        );
        break;
      case "exportResults":
        await this.manager.exportResults(
          this.variantAnalysisId,
          msg.filterSort,
        );
        break;
      case "openLogs":
        await this.manager.commandManager.execute(
          "codeQL.openVariantAnalysisLogs",
          this.variantAnalysisId,
        );
        break;
      case "telemetry":
        telemetryListener?.sendUIInteraction(msg.action);
        break;
      case "unhandledError":
        void showAndLogExceptionWithTelemetry(
          redactableError(
            msg.error,
          )`Unhandled error in variant analysis results view: ${msg.error.message}`,
        );
        break;
      default:
        assertNever(msg);
    }
  }

  protected async onWebViewLoaded() {
    super.onWebViewLoaded();

    void extLogger.log("Variant analysis view loaded");

    const variantAnalysis = await this.manager.getVariantAnalysis(
      this.variantAnalysisId,
    );

    if (!variantAnalysis) {
      void showAndLogWarningMessage("Unable to load variant analysis");
      return;
    }

    await this.postMessage({
      t: "setVariantAnalysis",
      variantAnalysis,
    });

    const repoStates = await this.manager.getRepoStates(this.variantAnalysisId);
    if (repoStates.length === 0) {
      return;
    }

    await this.postMessage({
      t: "setRepoStates",
      repoStates,
    });
  }

  private getTitle(variantAnalysis: VariantAnalysis | undefined): string {
    return variantAnalysis
      ? `${variantAnalysis.query.name} - Variant Analysis Results`
      : `Variant Analysis ${this.variantAnalysisId} - Results`;
  }
}
