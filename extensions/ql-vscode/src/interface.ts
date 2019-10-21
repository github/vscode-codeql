import * as crypto from 'crypto';
import * as path from 'path';
import * as bqrs from 'semmle-bqrs';
import { CustomResultSets, FivePartLocation, isResolvableLocation, LocationValue, ProblemQueryResults } from 'semmle-bqrs';
import { FileReader } from 'semmle-io-node';
import { DisposableObject } from 'semmle-vscode-utils';
import * as vscode from 'vscode';
import { Diagnostic, DiagnosticRelatedInformation, DiagnosticSeverity, languages, Location, Position, Range, Uri, window as Window, workspace } from 'vscode';
import { DatabaseItem, DatabaseManager } from './databases';
import { FromResultsViewMsg, Interpretation, IntoResultsViewMsg } from './interface-types';
import * as messages from './messages';
import { EvaluationInfo, tmpDir, interpretResults } from './queries';
import { Logger } from './logging';
import { QueryServerConfig } from './config';

/**
 * interface.ts
 * ------------
 *
 * Displaying query results and linking back to source files when the
 * webview asks us to.
 */

/** Gets a nonce string created with 128 bits of entropy. */
function getNonce(): string {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Returns HTML to populate the given webview.
 * Uses a content security policy that only loads the given script.
 */
function getHtmlForWebview(webview: vscode.Webview, scriptUriOnDisk: vscode.Uri, stylesheetUriOnDisk: vscode.Uri) {
  // Convert the on-disk URIs into webview URIs.
  const scriptWebviewUri = webview.asWebviewUri(scriptUriOnDisk);
  const stylesheetWebviewUri = webview.asWebviewUri(stylesheetUriOnDisk);
  // Use a nonce in the content security policy to uniquely identify the above resources.
  const nonce = getNonce();
  /*
   * Content security policy:
   * default-src: allow nothing by default.
   * script-src: allow only the given script, using the nonce.
   * style-src: allow only the given stylesheet, using the nonce.
   * connect-src: only allow fetch calls to webview resource URIs
   * (this is used to load BQRS result files).
   */
  const html = `
<html>
  <head>
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src ${webview.cspSource};">
    <link nonce="${nonce}" rel="stylesheet" href="${stylesheetWebviewUri}">
  </head>
  <body>
    <div id=root>
    </div>
      <script nonce="${nonce}" src="${scriptWebviewUri}">
    </script>
  </body>
</html>`;
  webview.html = html;
}

export class InterfaceManager extends DisposableObject {
  panel: vscode.WebviewPanel | undefined;

  readonly diagnosticCollection = languages.createDiagnosticCollection(`ql-query-results`);

  constructor(public ctx: vscode.ExtensionContext, private databaseManager: DatabaseManager,
    public config: QueryServerConfig, public logger: Logger) {

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
      const scriptPathOnDisk = vscode.Uri
        .file(ctx.asAbsolutePath('out/resultsView.js'));
      const stylesheetPathOnDisk = vscode.Uri
        .file(ctx.asAbsolutePath('out/results.css'));
      getHtmlForWebview(panel.webview, scriptPathOnDisk, stylesheetPathOnDisk);
      panel.webview.onDidReceiveMessage(this.handleMsgFromView, undefined, ctx.subscriptions);
    }
    return this.panel;
  }

  private handleMsgFromView = (msg: FromResultsViewMsg): void => {
    switch (msg.t) {
      case 'viewSourceFile': {
        const databaseItem = this.databaseManager.findDatabaseItem(Uri.parse(msg.databaseUri));
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

  public async showResults(info: EvaluationInfo): Promise<void> {
    if (info.result.resultType !== messages.QueryResultType.SUCCESS) {
      return;
    }

    let interpretation: Interpretation | undefined = undefined;
    if (info.query.hasInterpretedResults()
      && info.query.quickEvalPosition === undefined // never do results interpretation if quickEval
    ) {
      try {
        const sarif = await interpretResults(this.config, info.query, this.logger);
        const sourceLocationPrefix = await info.query.dbItem.getSourceLocationPrefix(this.config, this.logger);
        interpretation = { sarif, sourceLocationPrefix };
      }
      catch (e) {
        // If interpretation fails, accept the error and continue
        // trying to render uninterpreted results anyway.
        this.logger.log(`Exception during results interpretation: ${e.message}. Will show raw results instead.`);
      }
    }

    this.postMessage({
      t: 'setState',
      interpretation,
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
      let message: string;
      const references = problemRow.references;
      if (references) {
        let referenceIndex = 0;
        message = problemRow.message.replace(/\$\@/g, sub => {
          if (referenceIndex < references.length) {
            const replacement = references[referenceIndex].text;
            referenceIndex++;
            return replacement;
          }
          else {
            return sub;
          }
        });
      }
      else {
        message = problemRow.message;
      }
      const diagnostic = new Diagnostic(codeLocation.range, message, DiagnosticSeverity.Warning);
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
 * @param databaseItem Database in which to resolve the file location.
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
 * @param databaseItem Database in which to resolve the file location.
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
 * @param databaseItem Database in which to resolve the file location.
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
