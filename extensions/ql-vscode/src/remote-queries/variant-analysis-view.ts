import { commands, ExtensionContext, ViewColumn, window as Window, workspace } from 'vscode';
import { AbstractWebview, WebviewPanelConfig } from '../abstract-webview';
import { logger } from '../logging';
import { FromVariantAnalysisMessage, ToVariantAnalysisMessage } from '../pure/interface-types';
import { assertNever } from '../pure/helpers-pure';
import {
  VariantAnalysis,
  VariantAnalysisScannedRepositoryResult,
  VariantAnalysisScannedRepositoryState,
} from './shared/variant-analysis';
import { VariantAnalysisViewInterface, VariantAnalysisViewManager } from './variant-analysis-view-manager';
import { showAndLogWarningMessage } from '../helpers';

export class VariantAnalysisView extends AbstractWebview<ToVariantAnalysisMessage, FromVariantAnalysisMessage> implements VariantAnalysisViewInterface {
  public static readonly viewType = 'codeQL.variantAnalysis';

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

    await this.waitForPanelLoaded();
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

  public async sendRepositoryResults(repositoryResult: VariantAnalysisScannedRepositoryResult[]): Promise<void> {
    if (!this.isShowingPanel) {
      return;
    }

    await this.postMessage({
      t: 'setRepoResults',
      repoResults: repositoryResult,
    });
  }

  protected getPanelConfig(): WebviewPanelConfig {
    return {
      viewId: VariantAnalysisView.viewType,
      title: `CodeQL Query Results for ${this.variantAnalysisId}`,
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: 'variant-analysis',
    };
  }

  protected onPanelDispose(): void {
    this.manager.unregisterView(this);
  }

  protected async onMessage(msg: FromVariantAnalysisMessage): Promise<void> {
    switch (msg.t) {
      case 'viewLoaded':
        await this.onWebViewLoaded();

        break;
      case 'stopVariantAnalysis':
        void logger.log(`Stop variant analysis: ${msg.variantAnalysisId}`);
        break;
      case 'requestRepositoryResults':
        void commands.executeCommand('codeQL.loadVariantAnalysisRepoResults', this.variantAnalysisId, msg.repositoryFullName);
        break;
      case 'openQueryFile':
        await this.openQueryFile();
        break;
      default:
        assertNever(msg);
    }
  }

  protected async onWebViewLoaded() {
    super.onWebViewLoaded();

    void logger.log('Variant analysis view loaded');

    const variantAnalysis = await this.manager.getVariantAnalysis(this.variantAnalysisId);

    if (!variantAnalysis) {
      void showAndLogWarningMessage('Unable to load variant analysis');
      return;
    }

    await this.postMessage({
      t: 'setVariantAnalysis',
      variantAnalysis,
    });
  }

  private async openQueryFile(): Promise<void> {
    const variantAnalysis = await this.manager.getVariantAnalysis(this.variantAnalysisId);

    if (!variantAnalysis) {
      void showAndLogWarningMessage('Could not open variant analysis query file');
      return;
    }

    try {
      const textDocument = await workspace.openTextDocument(variantAnalysis.query.filePath);
      await Window.showTextDocument(textDocument, ViewColumn.One);
    } catch (error) {
      void showAndLogWarningMessage(`Could not open file: ${variantAnalysis.query.filePath}`);
    }
  }
}
