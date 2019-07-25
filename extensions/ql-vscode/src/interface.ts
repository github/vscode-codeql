import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionContext, window as Window, workspace } from 'vscode';
import * as evaluation from '../gen/evaluation_server_protocol_pb';
import * as bqrs from './bqrs';
import { FivePartLocation, ResultSet } from './bqrs-types';
import { ResultsViewState, FromResultsViewMsg, IntoResultsViewMsg } from './interface-types';
import { EvaluationInfo } from './queries';
import * as qsClient from './queryserver-client';

/**
 * interface.ts
 * ------------
 *
 * Displaying query results and linking back to source files when the
 * webview asks us to.
 */

export class InterfaceManager {
  ctx: vscode.ExtensionContext;
  panel: vscode.WebviewPanel | undefined;
  state: ResultsViewState;
  log: (x: string) => void;

  constructor(ctx: vscode.ExtensionContext, log: (x: string) => void) {
    this.ctx = ctx;
    this.state = { results: [] };
    this.log = log;
  }

  getPanel() {
    if (this.panel == undefined) {
      const { ctx } = this;
      const panel = this.panel = Window.createWebviewPanel(
        'resultsView', // internal name
        'QL Query Results', // user-visible name
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
          localResourceRoots: [vscode.Uri.file(path.join(this.ctx.extensionPath, 'out'))]
        }
      );
      this.panel.onDidDispose(() => { this.panel = undefined; }, null, ctx.subscriptions);
      const scriptPath = vscode.Uri
        .file(ctx.asAbsolutePath('out/resultsView.js'))
        .with({ scheme: 'vscode-resource' })
        .toString();
      panel.webview.html = `<html><body><div id=root></div><script src="${scriptPath}"></script></body></html>`;
      panel.webview.onDidReceiveMessage(handleMsgFromView, undefined, ctx.subscriptions);
    }
    return this.panel;
  }

  postMessage(msg: IntoResultsViewMsg) {
    this.getPanel().webview.postMessage(msg);
  }

  showResults(ctx: ExtensionContext, info: EvaluationInfo, k?: (rs: ResultSet[]) => void) {
    bqrs.parse(fs.createReadStream(info.query.resultsPath)).then(
      parsed => {
        this.state.results = parsed.results;
        if (k != undefined)
          k(parsed.results);
        this.postMessage({ t: 'setState', s: this.state });
      }).catch((e: Error) => {
        this.log("ERROR");
        this.log(e.toString());
        this.log(e.stack + '');
        throw e;
      });
    this.getPanel().reveal();
  }

}

async function showLocation(loc: FivePartLocation): Promise<void> {
  const doc = await workspace.openTextDocument(vscode.Uri.file(loc.file));
  const editor = await Window.showTextDocument(doc, vscode.ViewColumn.One);
  const start = new vscode.Position(loc.lineStart - 1, loc.colStart - 1);
  const end = new vscode.Position(loc.lineEnd - 1, loc.colEnd);
  const sel = new vscode.Selection(start, end);
  editor.selection = sel;
  editor.revealRange(sel);
}

function handleMsgFromView(msg: FromResultsViewMsg): void {
  switch (msg.t) {
    case 'viewSourceFile':
      showLocation(msg.loc).catch(e => { throw e; });
      break;
  }
}
