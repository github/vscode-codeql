import * as crypto from 'crypto';
import * as path from 'path';
import * as Sarif from 'sarif';
import { FivePartLocation, LocationStyle, LocationValue, ResolvableLocationValue, tryGetResolvableLocation, WholeFileLocation } from 'semmle-bqrs';
import { DisposableObject } from 'semmle-vscode-utils';
import * as vscode from 'vscode';
import { Diagnostic, DiagnosticRelatedInformation, DiagnosticSeverity, languages, Location, Range, Uri, window as Window, workspace } from 'vscode';
import * as cli from './cli';
import { CodeQLCliServer } from './cli';
import { DatabaseItem, DatabaseManager } from './databases';
import { showAndLogErrorMessage } from './helpers';
import { assertNever } from './helpers-pure';
import { FromResultsViewMsg, Interpretation, INTERPRETED_RESULTS_PER_RUN_LIMIT, IntoResultsViewMsg, QueryMetadata, ResultsPaths, SortedResultSetInfo, SortedResultsMap } from './interface-types';
import { Logger } from './logging';
import * as messages from './messages';
import { CompletedQuery, interpretResults } from './query-results';
import { QueryInfo, tmpDir } from './run-queries';
import { parseSarifLocation, parseSarifPlainTextMessage } from './sarif-utils';

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
  private _displayedQuery?: CompletedQuery;
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
            await this.showResultsAsDiagnostics(msg.origResultsPaths, msg.metadata, databaseItem);
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
        if (this._displayedQuery === undefined) {
          showAndLogErrorMessage("Failed to sort results since evaluation info was unknown.");
          break;
        }
        // Notify the webview that it should expect new results.
        await this.postMessage({ t: 'resultsUpdating' });
        await this._displayedQuery.updateSortState(this.cliServer, msg.resultSetName, msg.sortState);
        await this.showResults(this._displayedQuery, WebviewReveal.NotForced, true);
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
   * @param results Evaluation info for the executed query.
   * @param shouldKeepOldResultsWhileRendering Should keep old results while rendering.
   * @param forceReveal Force the webview panel to be visible and
   * Appropriate when the user has just performed an explicit
   * UI interaction requesting results, e.g. clicking on a query
   * history entry.
   */
  public async showResults(results: CompletedQuery, forceReveal: WebviewReveal, shouldKeepOldResultsWhileRendering: boolean = false): Promise<void> {
    if (results.result.resultType !== messages.QueryResultType.SUCCESS) {
      return;
    }

    const interpretation = await this.interpretResultsInfo(results.query);

    const sortedResultsMap: SortedResultsMap = {};
    results.sortedResultsInfo.forEach((v, k) =>
      sortedResultsMap[k] = this.convertPathPropertiesToWebviewUris(v));

    this._displayedQuery = results;

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
      const queryName = results.queryName;
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
      origResultsPaths: results.query.resultsPaths,
      resultsPath: this.convertPathToWebviewUri(results.query.resultsPaths.resultsPath),
      sortedResultsMap,
      database: results.database,
      shouldKeepOldResultsWhileRendering,
      metadata: results.query.metadata
    });
  }

  private async getTruncatedResults(metadata: QueryMetadata | undefined, resultsPaths: ResultsPaths, sourceInfo: cli.SourceInfo | undefined, sourceLocationPrefix: string): Promise<Interpretation> {
    const sarif = await interpretResults(this.cliServer, metadata, resultsPaths.interpretedResultsPath, sourceInfo);
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
    return { sarif, sourceLocationPrefix, numTruncatedResults };
    ;
  }

  private async interpretResultsInfo(query: QueryInfo): Promise<Interpretation | undefined> {
    let interpretation: Interpretation | undefined = undefined;
    if (await query.hasInterpretedResults()
      && query.quickEvalPosition === undefined // never do results interpretation if quickEval
    ) {
      try {
        const sourceLocationPrefix = await query.dbItem.getSourceLocationPrefix(this.cliServer);
        const sourceArchiveUri = query.dbItem.sourceArchive;
        const sourceInfo = sourceArchiveUri === undefined ?
          undefined :
          { sourceArchive: sourceArchiveUri.fsPath, sourceLocationPrefix };
        interpretation = await this.getTruncatedResults(query.metadata, query.resultsPaths, sourceInfo, sourceLocationPrefix);
      }
      catch (e) {
        // If interpretation fails, accept the error and continue
        // trying to render uninterpreted results anyway.
        this.logger.log(`Exception during results interpretation: ${e.message}. Will show raw results instead.`);
      }
    }
    return interpretation;
  }


  private async showResultsAsDiagnostics(resultsInfo: ResultsPaths, metadata: QueryMetadata | undefined, database: DatabaseItem) {
    const sourceLocationPrefix = await database.getSourceLocationPrefix(this.cliServer);
    const sourceArchiveUri = database.sourceArchive;
    const sourceInfo = sourceArchiveUri === undefined ?
      undefined :
      { sourceArchive: sourceArchiveUri.fsPath, sourceLocationPrefix };
    const interpretation = await this.getTruncatedResults(metadata, resultsInfo, sourceInfo, sourceLocationPrefix);

    try {
      await this.showProblemResultsAsDiagnostics(interpretation, database);
    }
    catch (e) {
      const msg = e instanceof Error ? e.message : e.toString();
      this.logger.log(`Exception while computing problem results as diagnostics: ${msg}`);
      this._diagnosticCollection.clear();
    }

  }

  private async showProblemResultsAsDiagnostics(interpretation: Interpretation, databaseItem: DatabaseItem): Promise<void> {
    const { sarif, sourceLocationPrefix } = interpretation;


    if (!sarif.runs || !sarif.runs[0].results) {
      this.logger.log("Didn't find a run in the sarif results. Error processing sarif?")
      return;
    }

    const diagnostics: [Uri, ReadonlyArray<Diagnostic>][] = [];

    for (const result of sarif.runs[0].results) {
      const message = result.message.text;
      if (message === undefined) {
        this.logger.log("Sarif had result without plaintext message")
        continue;
      }
      if (!result.locations) {
        this.logger.log("Sarif had result without location")
        continue;
      }

      const sarifLoc = parseSarifLocation(result.locations[0], sourceLocationPrefix);
      if (sarifLoc.t == "NoLocation") {
        continue;
      }
      const resultLocation = tryResolveLocation(sarifLoc, databaseItem)
      if (!resultLocation) {
        this.logger.log("Sarif location was not resolvable " + sarifLoc)
        continue;
      }
      const parsedMessage = parseSarifPlainTextMessage(message);
      const relatedInformation: DiagnosticRelatedInformation[] = [];
      const relatedLocationsById: { [k: number]: Sarif.Location } = {};


      for (let loc of result.relatedLocations || []) {
        relatedLocationsById[loc.id!] = loc;
      }
      let resultMessageChunks: string[] = [];
      for (const section of parsedMessage) {
        if (typeof section === "string") {
          resultMessageChunks.push(section);
        } else {
          resultMessageChunks.push(section.text);
          const sarifChunkLoc = parseSarifLocation(relatedLocationsById[section.dest], sourceLocationPrefix);
          if (sarifChunkLoc.t == "NoLocation") {
            continue;
          }
          const referenceLocation = tryResolveLocation(sarifChunkLoc, databaseItem);


          if (referenceLocation) {
            const related = new DiagnosticRelatedInformation(referenceLocation,
              section.text);
            relatedInformation.push(related);
          }
        }
      }
      const diagnostic = new Diagnostic(resultLocation.range, resultMessageChunks.join(""), DiagnosticSeverity.Warning);
      diagnostic.relatedInformation = relatedInformation;

      diagnostics.push([
        resultLocation.uri,
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
