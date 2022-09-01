import {
  WebviewPanel,
  ExtensionContext,
  window as Window,
  ViewColumn,
  Uri,
  WebviewPanelOptions,
  WebviewOptions
} from 'vscode';
import * as path from 'path';

import { DisposableObject } from './pure/disposable-object';
import { tmpDir } from './helpers';
import { getHtmlForWebview, WebviewMessage, WebviewView } from './interface-utils';

export type InterfacePanelConfig = {
  viewId: string;
  title: string;
  viewColumn: ViewColumn;
  view: WebviewView;
  preserveFocus?: boolean;
  additionalOptions?: WebviewPanelOptions & WebviewOptions;
}

export abstract class AbstractInterfaceManager<ToMessage extends WebviewMessage, FromMessage extends WebviewMessage> extends DisposableObject {
  protected panel: WebviewPanel | undefined;
  protected panelLoaded = false;
  protected panelLoadedCallBacks: (() => void)[] = [];

  constructor(
    protected readonly ctx: ExtensionContext
  ) {
    super();
  }

  protected get isShowingPanel() {
    return !!this.panel;
  }

  protected getPanel(): WebviewPanel {
    if (this.panel == undefined) {
      const { ctx } = this;

      const config = this.getPanelConfig();

      this.panel = Window.createWebviewPanel(
        config.viewId,
        config.title,
        { viewColumn: ViewColumn.Active, preserveFocus: true },
        {
          enableScripts: true,
          enableFindWidget: true,
          retainContextWhenHidden: true,
          ...config.additionalOptions,
          localResourceRoots: [
            ...(config.additionalOptions?.localResourceRoots ?? []),
            Uri.file(tmpDir.name),
            Uri.file(path.join(ctx.extensionPath, 'out'))
          ],
        }
      );
      this.push(
        this.panel.onDidDispose(
          () => {
            this.panel = undefined;
            this.panelLoaded = false;
            this.onPanelDispose();
          },
          null,
          ctx.subscriptions
        )
      );

      this.panel.webview.html = getHtmlForWebview(
        ctx,
        this.panel.webview,
        config.view,
        {
          allowInlineStyles: true,
        }
      );
      this.push(
        this.panel.webview.onDidReceiveMessage(
          async (e) => this.onMessage(e),
          undefined,
          ctx.subscriptions
        )
      );
    }
    return this.panel;
  }

  protected abstract getPanelConfig(): InterfacePanelConfig;

  protected abstract onPanelDispose(): void;

  protected abstract onMessage(msg: FromMessage): Promise<void>;

  protected waitForPanelLoaded(): Promise<void> {
    return new Promise((resolve) => {
      if (this.panelLoaded) {
        resolve();
      } else {
        this.panelLoadedCallBacks.push(resolve);
      }
    });
  }

  protected onWebViewLoaded(): void {
    this.panelLoaded = true;
    this.panelLoadedCallBacks.forEach((cb) => cb());
    this.panelLoadedCallBacks = [];
  }

  protected postMessage(msg: ToMessage): Thenable<boolean> {
    return this.getPanel().webview.postMessage(msg);
  }
}
