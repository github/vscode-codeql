import {
  commands,
  ExtensionContext,
  Uri,
  ViewColumn,
  window as Window,
  workspace,
} from "vscode";
import { URLSearchParams } from "url";
import { AbstractWebview, WebviewPanelConfig } from "../abstract-webview";
import { logger } from "../logging";
import {
  FromVariantAnalysisMessage,
  ToVariantAnalysisMessage,
} from "../pure/interface-types";
import { assertNever } from "../pure/helpers-pure";
import {
  getActionsWorkflowRunUrl,
  VariantAnalysis,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
} from "./shared/variant-analysis";
import {
  VariantAnalysisViewInterface,
  VariantAnalysisViewManager,
} from "./variant-analysis-view-manager";
import { showAndLogWarningMessage } from "../helpers";

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
    panel.title = `${variantAnalysis.query.name} - CodeQL Query Results`;
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
      title: variantAnalysis
        ? `${variantAnalysis.query.name} - CodeQL Query Results`
        : `Variant analysis ${this.variantAnalysisId} - CodeQL Query Results`,
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
        await this.openQueryFile();
        break;
      case "openQueryText":
        await this.openQueryText();
        break;
      case "copyRepositoryList":
        void commands.executeCommand(
          "codeQL.copyVariantAnalysisRepoList",
          this.variantAnalysisId,
          msg.filterSort,
        );
        break;
      case "exportResults":
        void commands.executeCommand(
          "codeQL.exportVariantAnalysisResults",
          this.variantAnalysisId,
          msg.filterSort,
        );
        break;
      case "openLogs":
        await this.openLogs();
        break;
      default:
        assertNever(msg);
    }
  }

  protected async onWebViewLoaded() {
    super.onWebViewLoaded();

    void logger.log("Variant analysis view loaded");

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

  private async openQueryFile(): Promise<void> {
    const variantAnalysis = await this.manager.getVariantAnalysis(
      this.variantAnalysisId,
    );

    if (!variantAnalysis) {
      void showAndLogWarningMessage(
        "Could not open variant analysis query file",
      );
      return;
    }

    try {
      const textDocument = await workspace.openTextDocument(
        variantAnalysis.query.filePath,
      );
      await Window.showTextDocument(textDocument, ViewColumn.One);
    } catch (error) {
      void showAndLogWarningMessage(
        `Could not open file: ${variantAnalysis.query.filePath}`,
      );
    }
  }

  private async openQueryText(): Promise<void> {
    const variantAnalysis = await this.manager.getVariantAnalysis(
      this.variantAnalysisId,
    );
    if (!variantAnalysis) {
      void showAndLogWarningMessage(
        "Could not open variant analysis query text. Variant analysis not found.",
      );
      return;
    }

    const filename = variantAnalysis.query.filePath;

    try {
      const params = new URLSearchParams({
        variantAnalysisId: variantAnalysis.id.toString(),
      });
      const uri = Uri.from({
        scheme: "codeql-variant-analysis",
        path: filename,
        query: params.toString(),
      });
      const doc = await workspace.openTextDocument(uri);
      await Window.showTextDocument(doc, { preview: false });
    } catch (error) {
      void showAndLogWarningMessage(
        "Could not open variant analysis query text. Failed to open text document.",
      );
    }
  }

  private async openLogs(): Promise<void> {
    const variantAnalysis = await this.manager.getVariantAnalysis(
      this.variantAnalysisId,
    );
    if (!variantAnalysis) {
      void showAndLogWarningMessage(
        "Could not open variant analysis logs. Variant analysis not found.",
      );
      return;
    }

    const actionsWorkflowRunUrl = getActionsWorkflowRunUrl(variantAnalysis);

    await commands.executeCommand(
      "vscode.open",
      Uri.parse(actionsWorkflowRunUrl),
    );
  }
}
