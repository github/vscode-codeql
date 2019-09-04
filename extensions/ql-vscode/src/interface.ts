import * as path from 'path';
import * as vscode from 'vscode';
import {
  window as Window, workspace, languages, Uri, Diagnostic, Range, Location, DiagnosticSeverity,
  DiagnosticRelatedInformation, Position
} from 'vscode';
import * as bqrs from 'semmle-bqrs';
import { FileReader } from 'semmle-io-node';
import {
  FivePartLocation, LocationValue, isResolvableLocation, ProblemQueryResults,
  CustomResultSets } from 'semmle-bqrs';
import { FromResultsViewMsg, IntoResultsViewMsg } from './interface-types';
import { tmpDir, EvaluationInfo } from './queries';
import { DisposableObject } from 'semmle-vscode-utils';
import { DatabaseManager, DatabaseItem } from './databases';

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
          localResourceRoots: [
            vscode.Uri.file(tmpDir.name),
            vscode.Uri.file(path.join(this.ctx.extensionPath, 'out'))
          ]
        }
      );
      this.panel.onDidDispose(() => { this.panel = undefined; }, null, ctx.subscriptions);
      const scriptPath = vscode.Uri
        .file(ctx.asAbsolutePath('out/resultsView.js'))
        .with({ scheme: 'vscode-resource' })
        .toString();
      panel.webview.html = `
<html>
  <body>
    <div id=root>
    </div>
      <script src="${scriptPath}">
    </script>
  </body>
</html>`;
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

  public showResults(info: EvaluationInfo): void {
    this.showResultsAsync(info);
  }

  private async showResultsAsync(info: EvaluationInfo): Promise<void> {
    this.postMessage({
      t: 'setState',
      resultsPath: Uri.file(info.query.resultsPath).with({ scheme: 'vscode-resource' }).toString(true),
      database: info.database
    });
    const fileReader = await FileReader.open(info.query.resultsPath);
    try {
      const resultSets = await bqrs.open(fileReader);
      try {
        const customResults = await bqrs.createCustomResultSets<ProblemQueryResults>(resultSets, ProblemQueryResults);
        await this.showProblemResultsAsDiagnostics(customResults, info.query.dbItem);
      }
      catch (e) {
        this.diagnosticCollection.clear();
      }
    }
    finally {
      fileReader.dispose();
    }
  }

  private async showProblemResultsAsDiagnostics(results: CustomResultSets<ProblemQueryResults>,
    databaseItem: DatabaseItem): Promise<void> {

    const diagnostics: [Uri, ReadonlyArray<Diagnostic>][] = [];
    for await (const problemRow of results.problems.readTuples()) {
      const codeLocation = resolveLocation(problemRow.element.location, databaseItem);
      const diagnostic = new Diagnostic(codeLocation.range, problemRow.message, DiagnosticSeverity.Warning);
      if (problemRow.references) {
        const relatedInformation: DiagnosticRelatedInformation[] = [];
        for (const reference of problemRow.references) {
          const referenceLocation = tryResolveLocation(reference.element.location, databaseItem);
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
function resolveLocation(loc: LocationValue | undefined, databaseItem: DatabaseItem): Location {
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
function tryResolveLocation(loc: LocationValue | undefined,
  databaseItem: DatabaseItem): Location | undefined {

  if (isResolvableLocation(loc)) {
    return resolveFivePartLocation(loc, databaseItem);
  }
  else {
    return undefined;
  }
}
