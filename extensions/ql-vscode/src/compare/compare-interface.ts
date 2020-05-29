import { DisposableObject } from "semmle-vscode-utils";
import { WebviewPanel, ExtensionContext, window as Window, ViewColumn, Uri } from "vscode";
import * as path from 'path';

import { tmpDir } from "../run-queries";
import { CompletedQuery } from "../query-results";
import { CompareViewMessage } from "../interface-types";
import { Logger } from "../logging";
import { CodeQLCliServer } from "../cli";
import { DatabaseManager } from "../databases";
import { getHtmlForWebview, WebviewReveal } from "../webview-utils";
import { showAndLogErrorMessage } from "../helpers";

interface ComparePair {
  from: CompletedQuery;
  to: CompletedQuery;
}

export class CompareInterfaceManager extends DisposableObject {
  private comparePair: ComparePair | undefined;
  private panel: WebviewPanel | undefined;

  constructor(
    public ctx: ExtensionContext,
    public databaseManager: DatabaseManager,
    public cliServer: CodeQLCliServer,
    public logger: Logger
  ) {
    super();
  }

  showResults(from: CompletedQuery, to: CompletedQuery, forceReveal = WebviewReveal.NotForced) {
    this.comparePair = { from, to };
    if (forceReveal === WebviewReveal.Forced) {
      this.getPanel().reveal(undefined, true);
    }
  }

  getPanel(): WebviewPanel {
    if (this.panel == undefined) {
      const { ctx } = this;
      const panel = (this.panel = Window.createWebviewPanel(
        "compareView", // internal name
        "Compare CodeQL Query Results", // user-visible name
        { viewColumn: ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          enableFindWidget: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            Uri.file(tmpDir.name),
            Uri.file(path.join(this.ctx.extensionPath, "out")),
          ],
        }
      ));
      this.panel.onDidDispose(
        () => this.panel = undefined,
        null,
        ctx.subscriptions
      );

      const scriptPathOnDisk = Uri.file(
        ctx.asAbsolutePath("out/compareView.js")
      );

      const stylesheetPathOnDisk = Uri.file(
        ctx.asAbsolutePath("out/compareView.css")
      );

      panel.webview.html = getHtmlForWebview(panel.webview, scriptPathOnDisk, stylesheetPathOnDisk);
      panel.webview.onDidReceiveMessage(
        async (e) => this.handleMsgFromView(e),
        undefined,
        ctx.subscriptions
      );
    }
    return this.panel;
  }

  private async handleMsgFromView(msg: CompareViewMessage): Promise<void> {
    /** TODO */
    showAndLogErrorMessage(JSON.stringify(msg));
    showAndLogErrorMessage(JSON.stringify(this.comparePair));
  }
}
