import { ExtensionContext, WebviewPanel, WebviewPanelSerializer } from 'vscode';
import { VariantAnalysisView } from './variant-analysis-view';
import { VariantAnalysisState } from '../pure/interface-types';

export class VariantAnalysisViewSerializer implements WebviewPanelSerializer {
  private extensionLoaded = false;
  private readonly resolvePromises: (() => void)[] = [];

  public constructor(
    private readonly ctx: ExtensionContext
  ) { }

  onExtensionLoaded(): void {
    this.extensionLoaded = true;
    this.resolvePromises.forEach((resolve) => resolve());
  }

  async deserializeWebviewPanel(webviewPanel: WebviewPanel, state: unknown): Promise<void> {
    if (!state || typeof state !== 'object') {
      return;
    }

    if (!('variantAnalysisId' in state)) {
      return;
    }

    const variantAnalysisState: VariantAnalysisState = state as VariantAnalysisState;

    await this.waitForExtensionFullyLoaded();

    const view = new VariantAnalysisView(this.ctx, variantAnalysisState.variantAnalysisId);
    await view.restoreView(webviewPanel);
  }

  private waitForExtensionFullyLoaded(): Promise<void> {
    if (this.extensionLoaded) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.resolvePromises.push(resolve);
    });
  }
}
