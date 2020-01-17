import * as crypto from 'crypto';
import * as path from 'path';
import * as bqrs from 'semmle-bqrs';
import { CustomResultSets, FivePartLocation, LocationStyle, LocationValue, PathProblemQueryResults, ProblemQueryResults, ResolvableLocationValue, tryGetResolvableLocation, WholeFileLocation } from 'semmle-bqrs';
import { FileReader } from 'semmle-io-node';
import { DisposableObject } from 'semmle-vscode-utils';
import * as vscode from 'vscode';
import { Diagnostic, DiagnosticRelatedInformation, DiagnosticSeverity, languages, Location, Position, Range, Uri, window as Window, workspace } from 'vscode';
import { CodeQLCliServer } from './cli';
import { DatabaseItem, DatabaseManager } from './databases';
import * as helpers from './helpers';
import { showAndLogErrorMessage } from './helpers';
import { assertNever } from './helpers-pure';
import { FromResultsViewMsg, Interpretation, IntoResultsViewMsg, ResultsInfo, SortedResultSetInfo, SortedResultsMap, INTERPRETED_RESULTS_PER_RUN_LIMIT } from './interface-types';
import { Logger } from './logging';
import * as messages from './messages';
import { EvaluationInfo, interpretResults, QueryInfo, tmpDir } from './queries';

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
 * Whether to force webview to reveal
 */
export enum WebviewReveal {
  Forced,
  NotForced,
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

/** Converts a filesystem URI into a webview URI string that the given panel can use to read the file. */
export function fileUriToWebviewUri(panel: vscode.WebviewPanel, fileUriOnDisk: Uri): string {
  return panel.webview.asWebviewUri(fileUriOnDisk).toString();
}

/** Converts a URI string received from a webview into a local filesystem URI for the same resource. */
export function webviewUriToFileUri(webviewUri: string): Uri {
  // Webview URIs used the vscode-resource scheme. The filesystem path of the resource can be obtained from the path component of the webview URI.
  const path = Uri.parse(webviewUri).path;
  // For this path to be interpreted on the filesystem, we need to parse it as a filesystem URI for the current platform.
  return Uri.file(path);
}

export class InterfaceManager extends DisposableObject {
  private _displayedEvaluationInfo?: EvaluationInfo;
  private _panel: vscode.WebviewPanel | undefined;
  private _panelLoaded = false;
  private _panelLoadedCallBacks: (() => void)[] = [];

  private readonly _diagnosticCollection = languages.createDiagnosticCollection(`codeql-query-results`);

  constructor(public ctx: vscode.ExtensionContext, private databaseManager: DatabaseManager,
    public cliServer: CodeQLCliServer, public logger: Logger) {

    super();
    this.push(this._diagnosticCollection);
    this.push(vscode.window.onDidChangeTextEditorSelection(this.handleSelectionChange.bind(this)));
    this.push(vscode.commands.registerCommand('codeQLQueryResults.nextPathStep', this.navigatePathStep.bind(this, 1)));
    this.push(vscode.commands.registerCommand('codeQLQueryResults.previousPathStep', this.navigatePathStep.bind(this, -1)));
  }

  navigatePathStep(direction: number) {
    this.postMessage({ t: "navigatePath", direction });
  }

  // Returns the webview panel, creating it if it doesn't already
  // exist.
  getPanel(): vscode.WebviewPanel {
    if (this._panel == undefined) {
      const { ctx } = this;
      const panel = this._panel = Window.createWebviewPanel(
        'resultsView', // internal name
        'CodeQL Query Results', // user-visible name
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        {
          enableScripts: true,
          enableFindWidget: true,
          retainContextWhenHidden: true,
          localResourceRoots: [
            vscode.Uri.file(tmpDir.name),
            vscode.Uri.file(path.join(this.ctx.extensionPath, 'out'))
          ]
        }
      );
      this._panel.onDidDispose(() => { this._panel = undefined; }, null, ctx.subscriptions);
      const scriptPathOnDisk = vscode.Uri
        .file(ctx.asAbsolutePath('out/resultsView.js'));
      const stylesheetPathOnDisk = vscode.Uri
        .file(ctx.asAbsolutePath('out/resultsView.css'));
      getHtmlForWebview(panel.webview, scriptPathOnDisk, stylesheetPathOnDisk);
      panel.webview.onDidReceiveMessage(async (e) => this.handleMsgFromView(e), undefined, ctx.subscriptions);
    }
    return this._panel;
  }

  private async handleMsgFromView(msg: FromResultsViewMsg): Promise<void> {
    switch (msg.t) {
      case 'viewSourceFile': {
        const databaseItem = this.databaseManager.findDatabaseItem(Uri.parse(msg.databaseUri));
        if (databaseItem !== undefined) {
          try {
            await showLocation(msg.loc, databaseItem);
          }
          catch (e) {
            if (e instanceof Error) {
              if (e.message.match(/File not found/)) {
                vscode.window.showErrorMessage(`Original file of this result is not in the database's source archive.`);
              }
              else {
                this.logger.log(`Unable to handleMsgFromView: ${e.message}`);
              }
            }
            else {
              this.logger.log(`Unable to handleMsgFromView: ${e}`);
            }
          }
        }
        break;
      }
      case 'toggleDiagnostics': {
        if (msg.visible) {
          const databaseItem = this.databaseManager.findDatabaseItem(Uri.parse(msg.databaseUri));
          if (databaseItem !== undefined) {
            await this.showResultsAsDiagnostics(msg.resultsPath, msg.kind, databaseItem);
          }
        } else {
          // TODO: Only clear diagnostics on the same database.
          this._diagnosticCollection.clear();
        }
        break;
      }
      case "resultViewLoaded":
        this._panelLoaded = true;
        this._panelLoadedCallBacks.forEach(cb => cb());
        this._panelLoadedCallBacks = [];
        break;
      case 'changeSort': {
        if (this._displayedEvaluationInfo === undefined) {
          showAndLogErrorMessage("Failed to sort results since evaluation info was unknown.");
          break;
        }
        // Notify the webview that it should expect new results.
        await this.postMessage({ t: 'resultsUpdating' });
        await this._displayedEvaluationInfo.query.updateSortState(this.cliServer, msg.resultSetName, msg.sortState);
        await this.showResults(this._displayedEvaluationInfo, WebviewReveal.NotForced, true);
        break;
      }
      default:
        assertNever(msg);
    }
  }

  postMessage(msg: IntoResultsViewMsg): Thenable<boolean> {
    return this.getPanel().webview.postMessage(msg);
  }

  private waitForPanelLoaded(): Promise<void> {
    return new Promise((resolve, _reject) => {
      if (this._panelLoaded) {
        resolve();
      } else {
        this._panelLoadedCallBacks.push(resolve)
      }
    })
  }

  /**
   * Show query results in webview panel.
   * @param info Evaluation info for the executed query.
   * @param shouldKeepOldResultsWhileRendering Should keep old results while rendering.
   * @param forceReveal Force the webview panel to be visible and
   * Appropriate when the user has just performed an explicit
   * UI interaction requesting results, e.g. clicking on a query
   * history entry.
   */
  public async showResults(info: EvaluationInfo, forceReveal: WebviewReveal, shouldKeepOldResultsWhileRendering: boolean = false): Promise<void> {
    if (info.result.resultType !== messages.QueryResultType.SUCCESS) {
      return;
    }

    const interpretation = await this.interpretResultsInfo(info.query, info.query.resultsInfo);

    const sortedResultsMap: SortedResultsMap = {};
    info.query.sortedResultsInfo.forEach((v, k) =>
      sortedResultsMap[k] = this.convertPathPropertiesToWebviewUris(v));

    this._displayedEvaluationInfo = info;

    const panel = this.getPanel();
    await this.waitForPanelLoaded();
    if (forceReveal === WebviewReveal.Forced) {
      panel.reveal(undefined, true);
    }
    else if (!panel.visible) {
      // The results panel exists, (`.getPanel()` guarantees it) but
      // is not visible; it's in a not-currently-viewed tab. Show a
      // more asynchronous message to not so abruptly interrupt
      // user's workflow by immediately revealing the panel.
      const showButton = 'View Results';
      const queryName = helpers.getQueryName(info);
      const resultPromise = vscode.window.showInformationMessage(
        `Finished running query ${(queryName.length > 0) ? ` “${queryName}”` : ''}.`,
        showButton
      );
      // Address this click asynchronously so we still update the
      // query history immediately.
      resultPromise.then(result => {
        if (result === showButton) {
          panel.reveal();
        }
      });
    }

    await this.postMessage({
      t: 'setState',
      interpretation,
      resultsPath: this.convertPathToWebviewUri(info.query.resultsInfo.resultsPath),
      sortedResultsMap,
      database: info.database,
      shouldKeepOldResultsWhileRendering,
      kind: info.query.metadata ? info.query.metadata.kind : undefined
    });
  }

  private async interpretResultsInfo(query: QueryInfo, resultsInfo: ResultsInfo): Promise<Interpretation | undefined> {
    let interpretation: Interpretation | undefined = undefined;
    if (query.hasInterpretedResults()
      && query.quickEvalPosition === undefined // never do results interpretation if quickEval
    ) {
      try {
        const sourceLocationPrefix = await query.dbItem.getSourceLocationPrefix(this.cliServer);
        const sourceArchiveUri = query.dbItem.sourceArchive;
        const sourceInfo = sourceArchiveUri === undefined ?
          undefined :
          { sourceArchive: sourceArchiveUri.fsPath, sourceLocationPrefix };
        const sarif = await interpretResults(this.cliServer, query, resultsInfo, sourceInfo);
        // For performance reasons, limit the number of results we try
        // to serialize and send to the webview. TODO: possibly also
        // limit number of paths per result, number of steps per path,
        // or throw an error if we are in aggregate trying to send
        // massively too much data, as it can make the extension
        // unresponsive.
        let numTruncatedResults = 0;
        sarif.runs.forEach(run => {
          if (run.results !== undefined) {
            if (run.results.length > INTERPRETED_RESULTS_PER_RUN_LIMIT) {
              numTruncatedResults += run.results.length - INTERPRETED_RESULTS_PER_RUN_LIMIT;
              run.results = run.results.slice(0, INTERPRETED_RESULTS_PER_RUN_LIMIT);
            }
          }
        });
        interpretation = { sarif, sourceLocationPrefix, numTruncatedResults };
      }
      catch (e) {
        // If interpretation fails, accept the error and continue
        // trying to render uninterpreted results anyway.
        this.logger.log(`Exception during results interpretation: ${e.message}. Will show raw results instead.`);
      }
    }

    return interpretation;
  }

  private async showResultsAsDiagnostics(resultsPath: string, kind: string | undefined,
    database: DatabaseItem) {

    // URIs from the webview have the vscode-resource scheme, so convert into a filesystem URI first.
    const resultsPathOnDisk = webviewUriToFileUri(resultsPath).fsPath;
    const fileReader = await FileReader.open(resultsPathOnDisk);
    try {
      const resultSets = await bqrs.open(fileReader);
      try {
        switch (kind || 'problem') {
          case 'problem': {
            const customResults = bqrs.createCustomResultSets<ProblemQueryResults>(resultSets, ProblemQueryResults);
            await this.showProblemResultsAsDiagnostics(customResults, database);
          }
            break;

          case 'path-problem': {
            const customResults = bqrs.createCustomResultSets<PathProblemQueryResults>(resultSets, PathProblemQueryResults);
            await this.showProblemResultsAsDiagnostics(customResults, database);
          }
            break;

          default:
            throw new Error(`Unrecognized query kind '${kind}'.`);
        }
      }
      catch (e) {
        const msg = e instanceof Error ? e.message : e.toString();
        this.logger.log(`Exception while computing problem results as diagnostics: ${msg}`);
        this._diagnosticCollection.clear();
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

    this._diagnosticCollection.set(diagnostics);
  }

  private convertPathToWebviewUri(path: string): string {
    return fileUriToWebviewUri(this.getPanel(), Uri.file(path));
  }

  private convertPathPropertiesToWebviewUris(info: SortedResultSetInfo): SortedResultSetInfo {
    return {
      resultsPath: this.convertPathToWebviewUri(info.resultsPath),
      sortState: info.sortState
    };
  }

  private handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent) {
    if (event.kind === vscode.TextEditorSelectionChangeKind.Command) {
      return; // Ignore selection events we caused ourselves.
    }
    let editor = vscode.window.activeTextEditor;
    if (editor !== undefined) {
      editor.setDecorations(shownLocationDecoration, []);
      editor.setDecorations(shownLocationLineDecoration, []);
    }
  }
}

const findMatchBackground = new vscode.ThemeColor('editor.findMatchBackground');
const findRangeHighlightBackground = new vscode.ThemeColor('editor.findRangeHighlightBackground');

const shownLocationDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: findMatchBackground,
});

const shownLocationLineDecoration = vscode.window.createTextEditorDecorationType({
  backgroundColor: findRangeHighlightBackground,
  isWholeLine: true
});

async function showLocation(loc: ResolvableLocationValue, databaseItem: DatabaseItem): Promise<void> {
  const resolvedLocation = tryResolveLocation(loc, databaseItem);
  if (resolvedLocation) {
    const doc = await workspace.openTextDocument(resolvedLocation.uri);
    const editorsWithDoc = Window.visibleTextEditors.filter(e => e.document === doc);
    const editor = editorsWithDoc.length > 0
          ? editorsWithDoc[0]
          : await Window.showTextDocument(doc, vscode.ViewColumn.One);
    let range = resolvedLocation.range;
    // When highlighting the range, vscode's occurrence-match and bracket-match highlighting will
    // trigger based on where we place the cursor/selection, and will compete for the user's attention.
    // For reference:
    // - Occurences are highlighted when the cursor is next to or inside a word or a whole word is selected.
    // - Brackets are highlighted when the cursor is next to a bracket and there is an empty selection.
    // - Multi-line selections explicitly highlight line-break characters, but multi-line decorators do not.
    //
    // For single-line ranges, select the whole range, mainly to disable bracket highlighting.
    // For multi-line ranges, place the cursor at the beginning to avoid visual artifacts from selected line-breaks.
    // Multi-line ranges are usually large enough to overshadow the noise from bracket highlighting.
    let selectionEnd = (range.start.line === range.end.line)
        ? range.end
        : range.start;
    editor.selection = new vscode.Selection(range.start, selectionEnd);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
    editor.setDecorations(shownLocationDecoration, [range]);
    editor.setDecorations(shownLocationLineDecoration, [range]);
  }
}

/**
 * Resolves the specified CodeQL location to a URI into the source archive.
 * @param loc CodeQL location to resolve. Must have a non-empty value for `loc.file`.
 * @param databaseItem Database in which to resolve the file location.
 */
function resolveFivePartLocation(loc: FivePartLocation, databaseItem: DatabaseItem): Location {
  // `Range` is a half-open interval, and is zero-based. CodeQL locations are closed intervals, and
  // are one-based. Adjust accordingly.
  const range = new Range(Math.max(0, loc.lineStart - 1),
    Math.max(0, loc.colStart - 1),
    Math.max(0, loc.lineEnd - 1),
    Math.max(0, loc.colEnd));

  return new Location(databaseItem.resolveSourceFile(loc.file), range);
}

/**
 * Resolves the specified CodeQL filesystem resource location to a URI into the source archive.
 * @param loc CodeQL location to resolve, corresponding to an entire filesystem resource. Must have a non-empty value for `loc.file`.
 * @param databaseItem Database in which to resolve the filesystem resource location.
 */
function resolveWholeFileLocation(loc: WholeFileLocation, databaseItem: DatabaseItem): Location {
  // A location corresponding to the start of the file.
  const range = new Range(0, 0, 0, 0);
  return new Location(databaseItem.resolveSourceFile(loc.file), range);
}

/**
 * Resolve the specified CodeQL location to a URI into the source archive.
 * @param loc CodeQL location to resolve
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
 * Try to resolve the specified CodeQL location to a URI into the source archive. If no exact location
 * can be resolved, returns `undefined`.
 * @param loc CodeQL location to resolve
 * @param databaseItem Database in which to resolve the file location.
 */
function tryResolveLocation(loc: LocationValue | undefined,
  databaseItem: DatabaseItem): Location | undefined {
  const resolvableLoc = tryGetResolvableLocation(loc);
  if (resolvableLoc === undefined) {
    return undefined;
  }
  switch (resolvableLoc.t) {
    case LocationStyle.FivePart:
      return resolveFivePartLocation(resolvableLoc, databaseItem);
    case LocationStyle.WholeFile:
      return resolveWholeFileLocation(resolvableLoc, databaseItem);
    default:
      return undefined;
  }
}
