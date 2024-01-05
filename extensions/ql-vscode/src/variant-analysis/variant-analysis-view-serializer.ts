import type { WebviewPanel, WebviewPanelSerializer } from "vscode";
import { VariantAnalysisView } from "./variant-analysis-view";
import type { VariantAnalysisState } from "../common/interface-types";
import type { VariantAnalysisViewManager } from "./variant-analysis-view-manager";
import type { App } from "../common/app";

export class VariantAnalysisViewSerializer implements WebviewPanelSerializer {
  private resolvePromises: Array<
    (value: VariantAnalysisViewManager<VariantAnalysisView>) => void
  > = [];

  private manager?: VariantAnalysisViewManager<VariantAnalysisView>;

  public constructor(private readonly app: App) {}

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

    // Between the time the webview is deserialized and the time the extension
    // is fully activated, the user may close the webview. In this case, we
    // should not attempt to restore the view.
    let disposed = false;
    const unregisterOnDidDispose = webviewPanel.onDidDispose(() => {
      disposed = true;
    });

    const variantAnalysisState: VariantAnalysisState =
      state as VariantAnalysisState;

    const manager = await this.waitForExtensionFullyLoaded();

    const existingView = manager.getView(
      variantAnalysisState.variantAnalysisId,
    );
    if (existingView) {
      unregisterOnDidDispose.dispose();
      await existingView.openView();
      webviewPanel.dispose();
      return;
    }

    if (disposed) {
      return;
    }

    const view = new VariantAnalysisView(
      this.app,
      variantAnalysisState.variantAnalysisId,
      manager,
    );
    await view.restoreView(webviewPanel);

    unregisterOnDidDispose.dispose();
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
