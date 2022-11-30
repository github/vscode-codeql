import {
  WebviewPanel,
  ExtensionContext,
  window as Window,
  ViewColumn,
  Uri,
  WebviewPanelOptions,
  WebviewOptions,
} from "vscode";
import * as path from "path";

import { DisposableObject, DisposeHandler } from "./pure/disposable-object";
import { tmpDir } from "./helpers";
import {
  getHtmlForWebview,
  WebviewMessage,
  WebviewView,
} from "./interface-utils";

export type WebviewPanelConfig = {
  viewId: string;
  title: string;
  viewColumn: ViewColumn;
  view: WebviewView;
  preserveFocus?: boolean;
  additionalOptions?: WebviewPanelOptions & WebviewOptions;
};

export abstract class AbstractWebview<
  ToMessage extends WebviewMessage,
  FromMessage extends WebviewMessage,
> extends DisposableObject {
  protected panel: WebviewPanel | undefined;
  protected panelLoaded = false;
  protected panelLoadedCallBacks: Array<() => void> = [];

  private panelResolves?: Array<(panel: WebviewPanel) => void>;

  constructor(protected readonly ctx: ExtensionContext) {
    super();
  }

  public async restoreView(panel: WebviewPanel): Promise<void> {
    this.panel = panel;
    const config = await this.getPanelConfig();
    this.setupPanel(panel, config);
  }

  protected get isShowingPanel() {
    return !!this.panel;
  }

  protected async getPanel(): Promise<WebviewPanel> {
    if (this.panel == undefined) {
      const { ctx } = this;

      // This is an async method, so in theory this method can be called concurrently. To ensure that we don't
      // create two panels, we use a promise that resolves when the panel is created. This way, if the panel is
      // being created, the promise will resolve when it is done.
      if (this.panelResolves !== undefined) {
        return new Promise((resolve) => {
          if (this.panel !== undefined) {
            resolve(this.panel);
            return;
          }

          this.panelResolves?.push(resolve);
        });
      }
      this.panelResolves = [];

      const config = await this.getPanelConfig();

      const panel = Window.createWebviewPanel(
        config.viewId,
        config.title,
        { viewColumn: config.viewColumn, preserveFocus: config.preserveFocus },
        {
          enableScripts: true,
          enableFindWidget: true,
          retainContextWhenHidden: true,
          ...config.additionalOptions,
          localResourceRoots: [
            ...(config.additionalOptions?.localResourceRoots ?? []),
            Uri.file(tmpDir.name),
            Uri.file(path.join(ctx.extensionPath, "out")),
          ],
        },
      );
      this.panel = panel;

      this.setupPanel(panel, config);

      this.panelResolves.forEach((resolve) => resolve(panel));
      this.panelResolves = undefined;
    }
    return this.panel;
  }

  protected setupPanel(panel: WebviewPanel, config: WebviewPanelConfig): void {
    this.push(
      panel.onDidDispose(
        () => {
          this.panel = undefined;
          this.panelLoaded = false;
          this.onPanelDispose();
        },
        null,
        this.ctx.subscriptions,
      ),
    );

    panel.webview.html = getHtmlForWebview(
      this.ctx,
      panel.webview,
      config.view,
      {
        allowInlineStyles: true,
      },
    );
    this.push(
      panel.webview.onDidReceiveMessage(
        async (e) => this.onMessage(e),
        undefined,
        this.ctx.subscriptions,
      ),
    );
  }

  protected abstract getPanelConfig():
    | WebviewPanelConfig
    | Promise<WebviewPanelConfig>;

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

  protected async postMessage(msg: ToMessage): Promise<boolean> {
    const panel = await this.getPanel();
    return panel.webview.postMessage(msg);
  }

  public dispose(disposeHandler?: DisposeHandler) {
    this.panel?.dispose();
    super.dispose(disposeHandler);
  }
}
