import { ViewColumn } from "vscode";
import type { WebviewPanelConfig } from "../common/vscode/abstract-webview";
import { AbstractWebview } from "../common/vscode/abstract-webview";
import {
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
} from "../common/logging";
import type {
  FromVariantAnalysisMessage,
  ToVariantAnalysisMessage,
} from "../common/interface-types";
import { assertNever } from "../common/helpers-pure";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
} from "./shared/variant-analysis";
import type {
  VariantAnalysisViewInterface,
  VariantAnalysisViewManager,
} from "./variant-analysis-view-manager";
import { telemetryListener } from "../common/vscode/telemetry";
import { redactableError } from "../common/errors";
import { DataFlowPathsView } from "./data-flow-paths-view";
import type { DataFlowPaths } from "./shared/data-flow-paths";
import type { App } from "../common/app";
import {
  getVariantAnalysisDefaultResultsFilter,
  getVariantAnalysisDefaultResultsSort,
} from "../config";

export class VariantAnalysisView
  extends AbstractWebview<ToVariantAnalysisMessage, FromVariantAnalysisMessage>
  implements VariantAnalysisViewInterface
{
  public static readonly viewType = "codeQL.variantAnalysis";
  private readonly dataFlowPathsView: DataFlowPathsView;

  public constructor(
    protected readonly app: App,
    public readonly variantAnalysisId: number,
    private readonly manager: VariantAnalysisViewManager<VariantAnalysisView>,
  ) {
    super(app);

    manager.registerView(this);

    this.dataFlowPathsView = new DataFlowPathsView(app);
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
    const variantAnalysis = this.manager.tryGetVariantAnalysis(
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
        await this.manager.cancelVariantAnalysis(this.variantAnalysisId);
        break;
      case "requestRepositoryResults":
        void this.app.commands.execute(
          "codeQL.loadVariantAnalysisRepoResults",
          this.variantAnalysisId,
          msg.repositoryFullName,
        );
        break;
      case "openQueryFile":
        await this.manager.openQueryFile(this.variantAnalysisId);
        break;
      case "openQueryText":
        await this.manager.openQueryText(this.variantAnalysisId);
        break;
      case "copyRepositoryList":
        await this.manager.copyRepoListToClipboard(
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
      case "showDataFlowPaths":
        await this.showDataFlows(msg.dataFlowPaths);
        break;
      case "telemetry":
        telemetryListener?.sendUIInteraction(msg.action);
        break;
      case "unhandledError":
        void showAndLogExceptionWithTelemetry(
          this.app.logger,
          this.app.telemetry,
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

    void this.app.logger.log("Variant analysis view loaded");

    const variantAnalysis = this.manager.tryGetVariantAnalysis(
      this.variantAnalysisId,
    );

    if (!variantAnalysis) {
      void showAndLogWarningMessage(
        this.app.logger,
        "Unable to load variant analysis",
      );
      return;
    }

    const filterSortState = {
      searchValue: "",
      filterKey: getVariantAnalysisDefaultResultsFilter(),
      sortKey: getVariantAnalysisDefaultResultsSort(),
    };

    await this.postMessage({
      t: "setVariantAnalysis",
      variantAnalysis,
    });

    await this.postMessage({
      t: "setFilterSortState",
      filterSortState,
    });

    const repoStates = this.manager.getRepoStates(this.variantAnalysisId);
    if (repoStates.length === 0) {
      return;
    }

    await this.postMessage({
      t: "setRepoStates",
      repoStates,
    });
  }

  private getTitle(variantAnalysis: VariantAnalysis | undefined): string {
    if (!variantAnalysis) {
      return `Variant Analysis ${this.variantAnalysisId} - Results`;
    }

    if (variantAnalysis.queries) {
      return `Variant Analysis using multiple queries - Results`;
    } else {
      return `${variantAnalysis.query.name} - Variant Analysis Results`;
    }
  }

  private async showDataFlows(dataFlows: DataFlowPaths): Promise<void> {
    await this.dataFlowPathsView.showDataFlows(dataFlows);
  }
}
