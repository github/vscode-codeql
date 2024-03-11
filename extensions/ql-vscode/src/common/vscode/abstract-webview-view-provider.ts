import type { WebviewView, WebviewViewProvider } from "vscode";
import { Uri } from "vscode";
import type { WebviewKind, WebviewMessage } from "./webview-html";
import { getHtmlForWebview } from "./webview-html";
import type { Disposable } from "../disposable-object";
import type { App } from "../app";
import type { DeepReadonly } from "../readonly";

export abstract class AbstractWebviewViewProvider<
  ToMessage extends WebviewMessage,
  FromMessage extends WebviewMessage,
> implements WebviewViewProvider
{
  protected webviewView: WebviewView | undefined = undefined;
  private disposables: Disposable[] = [];

  constructor(
    protected readonly app: App,
    private readonly webviewKind: WebviewKind,
  ) {}

  /**
   * This is called when a view first becomes visible. This may happen when the view is
   * first loaded or when the user hides and then shows a view again.
   */
  public resolveWebviewView(webviewView: WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.file(this.app.extensionPath)],
    };

    const html = getHtmlForWebview(
      this.app,
      webviewView.webview,
      this.webviewKind,
      {
        allowInlineStyles: true,
        allowWasmEval: false,
      },
    );

    webviewView.webview.html = html;

    this.webviewView = webviewView;

    webviewView.webview.onDidReceiveMessage(async (msg) => this.onMessage(msg));
    webviewView.onDidDispose(() => this.dispose());
  }

  protected get isShowingView() {
    return this.webviewView?.visible ?? false;
  }

  protected async postMessage(msg: DeepReadonly<ToMessage>): Promise<void> {
    await this.webviewView?.webview.postMessage(msg);
  }

  protected dispose() {
    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop()!;
      disposable.dispose();
    }

    this.webviewView = undefined;
  }

  protected push<T extends Disposable>(obj: T): T {
    if (obj !== undefined) {
      this.disposables.push(obj);
    }
    return obj;
  }

  protected abstract onMessage(msg: FromMessage): Promise<void>;

  /**
   * This is called when a view first becomes visible. This may happen when the view is
   * first loaded or when the user hides and then shows a view again.
   */
  protected onWebViewLoaded(): void {
    // Do nothing by default.
  }
}
