import { ViewColumn } from 'vscode';
import { AbstractWebview, WebviewPanelConfig } from '../abstract-webview';
import { WebviewMessage } from '../interface-utils';
import { logger } from '../logging';

export class VariantAnalysisView extends AbstractWebview<WebviewMessage, WebviewMessage> {
  public openView() {
    this.getPanel().reveal(undefined, true);
  }

  protected getPanelConfig(): WebviewPanelConfig {
    return {
      viewId: 'variantAnalysisView',
      title: 'CodeQL Query Results',
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: 'variant-analysis'
    };
  }

  protected onPanelDispose(): void {
    // Nothing to dispose currently.
  }

  protected async onMessage(msg: WebviewMessage): Promise<void> {
    void logger.log('Received message on variant analysis view: ' + msg.t);
  }
}
