import { ExtensionContext, ViewColumn } from 'vscode';
import { AbstractWebview, WebviewPanelConfig } from '../abstract-webview';
import { WebviewMessage } from '../interface-utils';
import { logger } from '../logging';
import { VariantAnalysisViewInterface, VariantAnalysisViewManager } from './variant-analysis-view-manager';
import { VariantAnalysis, VariantAnalysisScannedRepositoryState } from './shared/variant-analysis';
import { FromVariantAnalysisMessage, ToVariantAnalysisMessage } from '../pure/interface-types';

export class VariantAnalysisView extends AbstractWebview<ToVariantAnalysisMessage, FromVariantAnalysisMessage> implements VariantAnalysisViewInterface {
  public constructor(
    ctx: ExtensionContext,
    public readonly variantAnalysisId: number,
    private readonly manager: VariantAnalysisViewManager<VariantAnalysisView>,
  ) {
    super(ctx);

    manager.registerView(this);
  }

  public async openView() {
    this.getPanel().reveal(undefined, true);
  }

  public async updateView(variantAnalysis: VariantAnalysis): Promise<void> {
    if (!this.isShowingPanel) {
      return;
    }

    await this.postMessage({
      t: 'setVariantAnalysis',
      variantAnalysis,
    });
  }

  public async updateRepoState(repoState: VariantAnalysisScannedRepositoryState): Promise<void> {
    if (!this.isShowingPanel) {
      return;
    }

    await this.postMessage({
      t: 'setRepoStates',
      repoStates: [repoState],
    });
  }

  protected getPanelConfig(): WebviewPanelConfig {
    return {
      viewId: 'variantAnalysisView',
      title: `CodeQL Query Results for ${this.variantAnalysisId}`,
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: 'variant-analysis'
    };
  }

  protected onPanelDispose(): void {
    this.manager.unregisterView(this);
  }

  protected async onMessage(msg: WebviewMessage): Promise<void> {
    void logger.log('Received message on variant analysis view: ' + msg.t);
  }
}
