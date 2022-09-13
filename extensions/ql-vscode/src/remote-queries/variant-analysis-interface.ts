import { ViewColumn } from 'vscode';
import { AbstractInterfaceManager, InterfacePanelConfig } from '../abstract-interface-manager';
import { WebviewMessage } from '../interface-utils';
import { logger } from '../logging';

export class VariantAnalysisInterfaceManager extends AbstractInterfaceManager<WebviewMessage, WebviewMessage> {
  public openView() {
    this.getPanel().reveal(undefined, true);
  }

  protected getPanelConfig(): InterfacePanelConfig {
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
