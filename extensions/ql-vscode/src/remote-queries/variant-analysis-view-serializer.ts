import { ExtensionContext, WebviewPanel, WebviewPanelSerializer } from "vscode";
import { VariantAnalysisView } from "./variant-analysis-view";
import { VariantAnalysisState } from "../pure/interface-types";
import { VariantAnalysisViewManager } from "./variant-analysis-view-manager";

export class VariantAnalysisViewSerializer implements WebviewPanelSerializer {
  private resolvePromises: ((
    value: VariantAnalysisViewManager<VariantAnalysisView>,
  ) => void)[] = [];

  private manager?: VariantAnalysisViewManager<VariantAnalysisView>;

  public constructor(private readonly ctx: ExtensionContext) {}

  onExtensionLoaded(
    manager: VariantAnalysisViewManager<VariantAnalysisView>,
  ): void {
    this.manager = manager;

    this.resolvePromises.forEach((resolve) => resolve(manager));
    this.resolvePromises = [];
  }

  async deserializeWebviewPanel(
    webviewPanel: WebviewPanel,
    state: unknown,
  ): Promise<void> {
    if (!state || typeof state !== "object") {
      return;
    }

    if (!("variantAnalysisId" in state)) {
      return;
    }

    const variantAnalysisState: VariantAnalysisState =
      state as VariantAnalysisState;

    const manager = await this.waitForExtensionFullyLoaded();

    const view = new VariantAnalysisView(
      this.ctx,
      variantAnalysisState.variantAnalysisId,
      manager,
    );
    await view.restoreView(webviewPanel);
  }

  private waitForExtensionFullyLoaded(): Promise<
    VariantAnalysisViewManager<VariantAnalysisView>
  > {
    if (this.manager) {
      return Promise.resolve(this.manager);
    }

    return new Promise<VariantAnalysisViewManager<VariantAnalysisView>>(
      (resolve) => {
        this.resolvePromises.push(resolve);
      },
    );
  }
}
