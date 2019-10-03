import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
  ExtensionContext, window as Window, workspace, languages, Uri, Diagnostic, Range, Location,
  DiagnosticSeverity, DiagnosticRelatedInformation, Position
} from 'vscode';
import * as bqrs from './bqrs';
import { FivePartLocation, ResultSet, LocationValue, isResolvableLocation } from './bqrs-types';
import { FromResultsViewMsg, IntoResultsViewMsg } from './interface-types';
import { EvaluationInfo } from './queries';
import { ProblemResultsParser } from './result-parser';
import { zipArchiveScheme } from './archive-filesystem-provider';
import { DisposableObject } from 'semmle-vscode-utils';
import { DatabaseManager, DatabaseItem } from './databases';
import * as messages from './messages';

/**
 * interface.ts
 * ------------
 *
 * Displaying query results and linking back to source files when the
 * webview asks us to.
 */

export class InterfaceManager extends DisposableObject {
  panel: vscode.WebviewPanel | undefined;

  readonly diagnosticCollection = languages.createDiagnosticCollection(`ql-query-results`);

  constructor(public ctx: vscode.ExtensionContext, private databaseManager: DatabaseManager,
    public log: (x: string) => void) {

    super();
  }

  // Returns the webview panel, creating it if it doesn't already
  // exist.
  getPanel(): vscode.WebviewPanel {
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
      panel.webview.onDidReceiveMessage(this.handleMsgFromView, undefined, ctx.subscriptions);
    }
    return this.panel;
  }

  private handleMsgFromView = (msg: FromResultsViewMsg): void => {
    switch (msg.t) {
      case 'viewSourceFile': {
        const databaseItem = this.databaseManager.findDatabaseItem(Uri.parse(msg.snapshotUri));
        if (databaseItem !== undefined) {
          showLocation(msg.loc, databaseItem).catch(e => { throw e; });
        }
        break;
      }
    }
  }

  postMessage(msg: IntoResultsViewMsg) {
    this.getPanel().webview.postMessage(msg);
  }

  showResults(ctx: ExtensionContext, info: EvaluationInfo, k?: (rs: ResultSet[]) => void) {
    if(info.result.resultType !== messages.QueryResultType.SUCCESS) {
      return;
    }
    bqrs.parse(fs.createReadStream(info.query.resultsPath)).then(
      parsed => {
        if (k != undefined) {
          k(parsed.results);
        }
        this.postMessage({
          t: 'setState',
          results: parsed.results,
          database: info.database
        });
        const problemParser = ProblemResultsParser.tryFromResultSets(parsed);
        if (problemParser) {
          this.showProblemResultsAsDiagnostics(problemParser, info.query.dbItem);
        }
        else {
          this.diagnosticCollection.clear();
        }
      }).catch((e: Error) => {
        this.log("ERROR");
        this.log(e.toString());
        this.log(e.stack + '');
        throw e;
      });
    this.getPanel().reveal();
  }

  private showProblemResultsAsDiagnostics(parser: ProblemResultsParser, databaseItem: DatabaseItem): void {
    const diagnostics: [Uri, ReadonlyArray<Diagnostic>][] = [];
    for (const problemRow of parser.parse()) {
      const codeLocation = resolveLocation(problemRow.element.loc, databaseItem);
      const diagnostic = new Diagnostic(codeLocation.range, problemRow.message, DiagnosticSeverity.Warning);
      if (problemRow.references) {
        const relatedInformation: DiagnosticRelatedInformation[] = [];
        for (const reference of problemRow.references) {
          const referenceLocation = tryResolveLocation(reference.element.loc, databaseItem);
          if (referenceLocation) {
            const related = new DiagnosticRelatedInformation(referenceLocation,
              reference.text);
            relatedInformation.push(related);
          }
        }
        diagnostic.relatedInformation = relatedInformation;
      }
      diagnostics.push([
        codeLocation.uri,
        [diagnostic]
      ]);
    }

    this.diagnosticCollection.set(diagnostics);
  }
}

async function showLocation(loc: FivePartLocation, databaseItem: DatabaseItem): Promise<void> {
  const resolvedLocation = tryResolveLocation(loc, databaseItem);
  if (resolvedLocation) {
    const doc = await workspace.openTextDocument(resolvedLocation.uri);
    const editor = await Window.showTextDocument(doc, vscode.ViewColumn.One);
    const sel = new vscode.Selection(resolvedLocation.range.start, resolvedLocation.range.end);
    editor.selection = sel;
    editor.revealRange(sel);
  }
}

/**
 * Resolves the specified QL location to a URI into the source archive.
 * @param loc QL location to resolve. Must have a non-empty value for `loc.file`.
 * @param databaseItem Snapshot in which to resolve the file location.
 */
function resolveFivePartLocation(loc: FivePartLocation, databaseItem: DatabaseItem): Location {
  // `Range` is a half-open interval, and is zero-based. QL locations are closed intervals, and
  // are one-based. Adjust accordingly.
  const range = new Range(Math.max(0, loc.lineStart - 1),
    Math.max(0, loc.colStart - 1),
    Math.max(0, loc.lineEnd - 1),
    Math.max(0, loc.colEnd));

  return new Location(databaseItem.resolveSourceFile(loc.file), range);
}

/**
 * Resolve the specified QL location to a URI into the source archive.
 * @param loc QL location to resolve
 * @param databaseItem Snapshot in which to resolve the file location.
 */
function resolveLocation(loc: LocationValue, databaseItem: DatabaseItem): Location {
  const resolvedLocation = tryResolveLocation(loc, databaseItem);
  if (resolvedLocation) {
    return resolvedLocation;
  }
  else {
    // Return a fake position in the source archive directory itself.
    return new Location(databaseItem.resolveSourceFile(undefined), new Position(0, 0));
  }
}

/**
 * Try to resolve the specified QL location to a URI into the source archive. If no exact location
 * can be resolved, returns `undefined`.
 * @param loc QL location to resolve
 * @param databaseItem Snapshot in which to resolve the file location.
 */
function tryResolveLocation(loc: LocationValue, databaseItem: DatabaseItem): Location | undefined {
  if (isResolvableLocation(loc)) {
    return resolveFivePartLocation(loc, databaseItem);
  }
  else {
    return undefined;
  }
}
