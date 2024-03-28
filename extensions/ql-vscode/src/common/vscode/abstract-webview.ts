import type {
  WebviewPanel,
  ViewColumn,
  WebviewPanelOptions,
  WebviewOptions,
} from "vscode";
import { window as Window, Uri } from "vscode";
import { join } from "path";

import type { App } from "../app";
import type { Disposable } from "../disposable-object";
import { tmpDir } from "../../tmp-dir";
import type { WebviewMessage, WebviewKind } from "./webview-html";
import { getHtmlForWebview } from "./webview-html";
import type { DeepReadonly } from "../readonly";
import { runWithErrorHandling } from "./error-handling";
import { telemetryListener } from "./telemetry";

export type WebviewPanelConfig = {
  viewId: string;
  title: string;
  viewColumn: ViewColumn;
  view: WebviewKind;
  preserveFocus?: boolean;
  iconPath?: Uri | { dark: Uri; light: Uri };
  additionalOptions?: WebviewPanelOptions & WebviewOptions;
  allowWasmEval?: boolean;
};

export abstract class AbstractWebview<
  ToMessage extends WebviewMessage,
  FromMessage extends WebviewMessage,
> {
  protected panel: WebviewPanel | undefined;
  protected panelLoaded = false;
  protected panelLoadedCallBacks: Array<() => void> = [];

  private panelResolves?: Array<(panel: WebviewPanel) => void>;

  private disposables: Disposable[] = [];

  constructor(protected readonly app: App) {}

  public async restoreView(panel: WebviewPanel): Promise<void> {
    this.panel = panel;
    const config = await this.getPanelConfig();
    this.setupPanel(panel, config);
  }

  protected get isShowingPanel() {
    return !!this.panel;
  }

  protected async getPanel(): Promise<WebviewPanel> {
    if (this.panel === undefined) {
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
            Uri.file(join(this.app.extensionPath, "out")),
          ],
        },
      );
      this.panel = panel;

      this.panel.iconPath = config.iconPath;

      this.setupPanel(panel, config);

      this.panelResolves.forEach((resolve) => resolve(panel));
      this.panelResolves = undefined;
    }
    return this.panel;
  }

  protected setupPanel(panel: WebviewPanel, config: WebviewPanelConfig): void {
    this.push(
      panel.onDidDispose(() => {
        this.panel = undefined;
        this.panelLoaded = false;
        this.onPanelDispose();
        this.disposeAll();
      }, null),
    );

    panel.webview.html = getHtmlForWebview(
      this.app,
      panel.webview,
      config.view,
      {
        allowInlineStyles: true,
        allowWasmEval: !!config.allowWasmEval,
      },
    );
    this.push(
      panel.webview.onDidReceiveMessage(
        async (e) =>
          runWithErrorHandling(
            () => this.onMessage(e),
            this.app.logger,
            telemetryListener,
          ),
        undefined,
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

  protected async postMessage(msg: DeepReadonly<ToMessage>): Promise<boolean> {
    const panel = await this.getPanel();
    return panel.webview.postMessage(msg);
  }

  public dispose() {
    this.panel?.dispose();
    this.disposeAll();
  }

  private disposeAll() {
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop()!;
      disposable.dispose();
    }
  }

  /**
   * Adds `obj` to a list of objects to dispose when the panel is disposed. Objects added by `push` are
   * disposed in reverse order of being added.
   * @param obj The object to take ownership of.
   */
  protected push<T extends Disposable>(obj: T): T {
    if (obj !== undefined) {
      this.disposables.push(obj);
    }
    return obj;
  }
}
