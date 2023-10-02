import * as vscode from "vscode";
import { Uri, WebviewViewProvider } from "vscode";
import { WebviewKind, WebviewMessage, getHtmlForWebview } from "./webview-html";
import { Disposable } from "../disposable-object";
import { App } from "../app";

export abstract class AbstractWebviewViewProvider<
  ToMessage extends WebviewMessage,
  FromMessage extends WebviewMessage,
> implements WebviewViewProvider
{
  protected webviewView: vscode.WebviewView | undefined = undefined;
  private disposables: Disposable[] = [];

  constructor(
    private readonly app: App,
    private readonly webviewKind: WebviewKind,
  ) {}

  /**
   * This is called when a view first becomes visible. This may happen when the view is
   * first loaded or when the user hides and then shows a view again.
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
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

    this.onWebViewLoaded();
  }

  protected get isShowingView() {
    return this.webviewView?.visible ?? false;
  }

  protected async postMessage(msg: ToMessage): Promise<void> {
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
