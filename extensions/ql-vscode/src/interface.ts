import * as path from 'path';
import * as Sarif from 'sarif';
import { DisposableObject } from '@github/codeql-vscode-utils';
import * as vscode from 'vscode';
import {
  Diagnostic,
  DiagnosticRelatedInformation,
  DiagnosticSeverity,
  languages,
  Uri,
  window as Window,
  env
} from 'vscode';
import * as cli from './cli';
import { CodeQLCliServer } from './cli';
import { DatabaseItem, DatabaseManager } from './databases';
import { showAndLogErrorMessage } from './helpers';
import { assertNever } from './helpers-pure';
import {
  FromResultsViewMsg,
  Interpretation,
  INTERPRETED_RESULTS_PER_RUN_LIMIT,
  IntoResultsViewMsg,
  QueryMetadata,
  ResultsPaths,
  SortedResultSetInfo,
  SortedResultsMap,
  InterpretedResultsSortState,
  SortDirection,
  RAW_RESULTS_PAGE_SIZE,
} from './interface-types';
import { Logger } from './logging';
import * as messages from './messages';
import { CompletedQuery, interpretResults } from './query-results';
import { QueryInfo, tmpDir } from './run-queries';
import { parseSarifLocation, parseSarifPlainTextMessage } from './sarif-utils';
import {
  adaptSchema,
  adaptBqrs,
  ParsedResultSets,
  RawResultSet,
} from './adapt';
import { EXPERIMENTAL_BQRS_SETTING } from './config';
import {
  WebviewReveal,
  fileUriToWebviewUri,
  tryResolveLocation,
  getHtmlForWebview,
  shownLocationDecoration,
  shownLocationLineDecoration,
  jumpToLocation,
} from './interface-utils';
import { getDefaultResultSetName } from './interface-types';

/**
 * interface.ts
 * ------------
 *
 * Displaying query results and linking back to source files when the
 * webview asks us to.
 */

function sortMultiplier(sortDirection: SortDirection): number {
  switch (sortDirection) {
    case SortDirection.asc:
      return 1;
    case SortDirection.desc:
      return -1;
  }
}

function sortInterpretedResults(
  results: Sarif.Result[],
  sortState: InterpretedResultsSortState | undefined
): void {
  if (sortState !== undefined) {
    const multiplier = sortMultiplier(sortState.sortDirection);
    switch (sortState.sortBy) {
      case 'alert-message':
        results.sort((a, b) =>
          a.message.text === undefined
            ? 0
            : b.message.text === undefined
              ? 0
              : multiplier * a.message.text?.localeCompare(b.message.text, env.language)
        );
        break;
      default:
        assertNever(sortState.sortBy);
    }
  }
}

function numPagesOfResultSet(resultSet: RawResultSet): number {
  return Math.ceil(resultSet.schema.tupleCount / RAW_RESULTS_PAGE_SIZE);
}

export class InterfaceManager extends DisposableObject {
  private _displayedQuery?: CompletedQuery;
  private _interpretation?: Interpretation;
  private _panel: vscode.WebviewPanel | undefined;
  private _panelLoaded = false;
  private _panelLoadedCallBacks: (() => void)[] = [];

  private readonly _diagnosticCollection = languages.createDiagnosticCollection(
    'codeql-query-results'
  );

  constructor(
    public ctx: vscode.ExtensionContext,
    private databaseManager: DatabaseManager,
    public cliServer: CodeQLCliServer,
    public logger: Logger
  ) {
    super();
    this.push(this._diagnosticCollection);
    this.push(
      vscode.window.onDidChangeTextEditorSelection(
        this.handleSelectionChange.bind(this)
      )
    );
    logger.log('Registering path-step navigation commands.');
    this.push(
      vscode.commands.registerCommand(
        'codeQLQueryResults.nextPathStep',
        this.navigatePathStep.bind(this, 1)
      )
    );
    this.push(
      vscode.commands.registerCommand(
        'codeQLQueryResults.previousPathStep',
        this.navigatePathStep.bind(this, -1)
      )
    );
  }

  navigatePathStep(direction: number): void {
    this.postMessage({ t: 'navigatePath', direction });
  }

  // Returns the webview panel, creating it if it doesn't already
  // exist.
  getPanel(): vscode.WebviewPanel {
    if (this._panel == undefined) {
      const { ctx } = this;
      const panel = (this._panel = Window.createWebviewPanel(
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
      ));
      this._panel.onDidDispose(
        () => {
          this._panel = undefined;
          this._displayedQuery = undefined;
        },
        null,
        ctx.subscriptions
      );
      const scriptPathOnDisk = vscode.Uri.file(
        ctx.asAbsolutePath('out/resultsView.js')
      );
      const stylesheetPathOnDisk = vscode.Uri.file(
        ctx.asAbsolutePath('out/resultsView.css')
      );
      panel.webview.html = getHtmlForWebview(
        panel.webview,
        scriptPathOnDisk,
        stylesheetPathOnDisk
      );
      panel.webview.onDidReceiveMessage(
        async (e) => this.handleMsgFromView(e),
        undefined,
        ctx.subscriptions
      );
    }
    return this._panel;
  }

  private async changeSortState(
    update: (query: CompletedQuery) => Promise<void>
  ): Promise<void> {
    if (this._displayedQuery === undefined) {
      showAndLogErrorMessage(
        'Failed to sort results since evaluation info was unknown.'
      );
      return;
    }
    // Notify the webview that it should expect new results.
    await this.postMessage({ t: 'resultsUpdating' });
    await update(this._displayedQuery);
    await this.showResults(this._displayedQuery, WebviewReveal.NotForced, true);
  }

  private async handleMsgFromView(msg: FromResultsViewMsg): Promise<void> {
    switch (msg.t) {
      case 'viewSourceFile': {
        await jumpToLocation(msg, this.databaseManager, this.logger);
        break;
      }
      case 'toggleDiagnostics': {
        if (msg.visible) {
          const databaseItem = this.databaseManager.findDatabaseItem(
            Uri.parse(msg.databaseUri)
          );
          if (databaseItem !== undefined) {
            await this.showResultsAsDiagnostics(
              msg.origResultsPaths,
              msg.metadata,
              databaseItem
            );
          }
        } else {
          // TODO: Only clear diagnostics on the same database.
          this._diagnosticCollection.clear();
        }
        break;
      }
      case 'resultViewLoaded':
        this._panelLoaded = true;
        this._panelLoadedCallBacks.forEach((cb) => cb());
        this._panelLoadedCallBacks = [];
        break;
      case 'changeSort':
        await this.changeSortState(query =>
          query.updateSortState(
            this.cliServer,
            msg.resultSetName,
            msg.sortState
          )
        );
        break;
      case 'changeInterpretedSort':
        await this.changeSortState(query =>
          query.updateInterpretedSortState(this.cliServer, msg.sortState)
        );
        break;
      case 'changePage':
        await this.showPageOfResults(msg.selectedTable, msg.pageNumber);
        break;
      default:
        assertNever(msg);
    }
  }

  postMessage(msg: IntoResultsViewMsg): Thenable<boolean> {
    return this.getPanel().webview.postMessage(msg);
  }

  private waitForPanelLoaded(): Promise<void> {
    return new Promise((resolve) => {
      if (this._panelLoaded) {
        resolve();
      } else {
        this._panelLoadedCallBacks.push(resolve);
      }
    });
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
  public async showResults(
    results: CompletedQuery,
    forceReveal: WebviewReveal,
    shouldKeepOldResultsWhileRendering = false
  ): Promise<void> {
    if (results.result.resultType !== messages.QueryResultType.SUCCESS) {
      return;
    }

    const interpretation = await this.interpretResultsInfo(
      results.query,
      results.interpretedResultsSortState
    );

    const sortedResultsMap: SortedResultsMap = {};
    results.sortedResultsInfo.forEach(
      (v, k) =>
        (sortedResultsMap[k] = this.convertPathPropertiesToWebviewUris(v))
    );

    this._displayedQuery = results;
    this._interpretation = interpretation;

    const panel = this.getPanel();
    await this.waitForPanelLoaded();
    if (forceReveal === WebviewReveal.Forced) {
      panel.reveal(undefined, true);
    } else if (!panel.visible) {
      // The results panel exists, (`.getPanel()` guarantees it) but
      // is not visible; it's in a not-currently-viewed tab. Show a
      // more asynchronous message to not so abruptly interrupt
      // user's workflow by immediately revealing the panel.
      const showButton = 'View Results';
      const queryName = results.queryName;
      const resultPromise = vscode.window.showInformationMessage(
        `Finished running query ${
        queryName.length > 0 ? ` "${queryName}"` : ''
        }.`,
        showButton
      );
      // Address this click asynchronously so we still update the
      // query history immediately.
      resultPromise.then((result) => {
        if (result === showButton) {
          panel.reveal();
        }
      });
    }

    const getParsedResultSets = async (): Promise<ParsedResultSets> => {
      if (EXPERIMENTAL_BQRS_SETTING.getValue()) {
        const schemas = await this.cliServer.bqrsInfo(
          results.query.resultsPaths.resultsPath,
          RAW_RESULTS_PAGE_SIZE
        );

        const resultSetNames = schemas['result-sets'].map(
          (resultSet) => resultSet.name
        );

        // This may not wind up being the page we actually show, if there are interpreted results,
        // but speculatively send it anyway.
        const selectedTable = getDefaultResultSetName(resultSetNames);
        const schema = schemas['result-sets'].find(
          (resultSet) => resultSet.name == selectedTable
        )!;
        if (schema === undefined) {
          return { t: 'WebviewParsed' };
        }

        const chunk = await this.cliServer.bqrsDecode(
          results.query.resultsPaths.resultsPath,
          schema.name,
          RAW_RESULTS_PAGE_SIZE,
          schema.pagination?.offsets[0]
        );
        const adaptedSchema = adaptSchema(schema);
        const resultSet = adaptBqrs(adaptedSchema, chunk);

        return {
          t: 'ExtensionParsed',
          pageNumber: 0,
          numPages: numPagesOfResultSet(resultSet),
          resultSet,
          selectedTable: undefined,
          resultSetNames,
        };
      } else {
        return { t: 'WebviewParsed' };
      }
    };

    await this.postMessage({
      t: 'setState',
      interpretation,
      origResultsPaths: results.query.resultsPaths,
      resultsPath: this.convertPathToWebviewUri(
        results.query.resultsPaths.resultsPath
      ),
      parsedResultSets: await getParsedResultSets(),
      sortedResultsMap,
      database: results.database,
      shouldKeepOldResultsWhileRendering,
      metadata: results.query.metadata,
    });
  }

  /**
   * Show a page of raw results from the chosen table.
   */
  public async showPageOfResults(
    selectedTable: string,
    pageNumber: number
  ): Promise<void> {
    const results = this._displayedQuery;
    if (results === undefined) {
      throw new Error('trying to view a page of a query that is not loaded');
    }

    const sortedResultsMap: SortedResultsMap = {};
    results.sortedResultsInfo.forEach(
      (v, k) =>
        (sortedResultsMap[k] = this.convertPathPropertiesToWebviewUris(v))
    );

    const schemas = await this.cliServer.bqrsInfo(
      results.query.resultsPaths.resultsPath,
      RAW_RESULTS_PAGE_SIZE
    );

    const resultSetNames = schemas['result-sets'].map(
      (resultSet) => resultSet.name
    );

    const schema = schemas['result-sets'].find(
      (resultSet) => resultSet.name == selectedTable
    )!;
    if (schema === undefined)
      throw new Error(`Query result set '${selectedTable}' not found.`);

    const chunk = await this.cliServer.bqrsDecode(
      results.query.resultsPaths.resultsPath,
      schema.name,
      RAW_RESULTS_PAGE_SIZE,
      schema.pagination?.offsets[pageNumber]
    );
    const adaptedSchema = adaptSchema(schema);
    const resultSet = adaptBqrs(adaptedSchema, chunk);

    const parsedResultSets: ParsedResultSets = {
      t: 'ExtensionParsed',
      pageNumber,
      resultSet,
      numPages: numPagesOfResultSet(resultSet),
      selectedTable: selectedTable,
      resultSetNames,
    };

    await this.postMessage({
      t: 'setState',
      interpretation: this._interpretation,
      origResultsPaths: results.query.resultsPaths,
      resultsPath: this.convertPathToWebviewUri(
        results.query.resultsPaths.resultsPath
      ),
      parsedResultSets,
      sortedResultsMap,
      database: results.database,
      shouldKeepOldResultsWhileRendering: false,
      metadata: results.query.metadata,
    });
  }

  private async getTruncatedResults(
    metadata: QueryMetadata | undefined,
    resultsPaths: ResultsPaths,
    sourceInfo: cli.SourceInfo | undefined,
    sourceLocationPrefix: string,
    sortState: InterpretedResultsSortState | undefined
  ): Promise<Interpretation> {
    const sarif = await interpretResults(
      this.cliServer,
      metadata,
      resultsPaths,
      sourceInfo
    );
    // For performance reasons, limit the number of results we try
    // to serialize and send to the webview. TODO: possibly also
    // limit number of paths per result, number of steps per path,
    // or throw an error if we are in aggregate trying to send
    // massively too much data, as it can make the extension
    // unresponsive.

    let numTruncatedResults = 0;
    sarif.runs.forEach((run) => {
      if (run.results !== undefined) {
        sortInterpretedResults(run.results, sortState);
        if (run.results.length > INTERPRETED_RESULTS_PER_RUN_LIMIT) {
          numTruncatedResults +=
            run.results.length - INTERPRETED_RESULTS_PER_RUN_LIMIT;
          run.results = run.results.slice(0, INTERPRETED_RESULTS_PER_RUN_LIMIT);
        }
      }
    });
    return {
      sarif,
      sourceLocationPrefix,
      numTruncatedResults,
      sortState,
    };
  }

  private async interpretResultsInfo(
    query: QueryInfo,
    sortState: InterpretedResultsSortState | undefined
  ): Promise<Interpretation | undefined> {
    let interpretation: Interpretation | undefined = undefined;
    if (
      (await query.canHaveInterpretedResults()) &&
      query.quickEvalPosition === undefined // never do results interpretation if quickEval
    ) {
      try {
        const sourceLocationPrefix = await query.dbItem.getSourceLocationPrefix(
          this.cliServer
        );
        const sourceArchiveUri = query.dbItem.sourceArchive;
        const sourceInfo =
          sourceArchiveUri === undefined
            ? undefined
            : {
              sourceArchive: sourceArchiveUri.fsPath,
              sourceLocationPrefix,
            };
        interpretation = await this.getTruncatedResults(
          query.metadata,
          query.resultsPaths,
          sourceInfo,
          sourceLocationPrefix,
          sortState
        );
      } catch (e) {
        // If interpretation fails, accept the error and continue
        // trying to render uninterpreted results anyway.
        this.logger.log(
          `Exception during results interpretation: ${e.message}. Will show raw results instead.`
        );
      }
    }
    return interpretation;
  }

  private async showResultsAsDiagnostics(
    resultsInfo: ResultsPaths,
    metadata: QueryMetadata | undefined,
    database: DatabaseItem
  ): Promise<void> {
    const sourceLocationPrefix = await database.getSourceLocationPrefix(
      this.cliServer
    );
    const sourceArchiveUri = database.sourceArchive;
    const sourceInfo =
      sourceArchiveUri === undefined
        ? undefined
        : {
          sourceArchive: sourceArchiveUri.fsPath,
          sourceLocationPrefix,
        };
    const interpretation = await this.getTruncatedResults(
      metadata,
      resultsInfo,
      sourceInfo,
      sourceLocationPrefix,
      undefined
    );

    try {
      await this.showProblemResultsAsDiagnostics(interpretation, database);
    } catch (e) {
      const msg = e instanceof Error ? e.message : e.toString();
      this.logger.log(
        `Exception while computing problem results as diagnostics: ${msg}`
      );
      this._diagnosticCollection.clear();
    }
  }

  private async showProblemResultsAsDiagnostics(
    interpretation: Interpretation,
    databaseItem: DatabaseItem
  ): Promise<void> {
    const { sarif, sourceLocationPrefix } = interpretation;

    if (!sarif.runs || !sarif.runs[0].results) {
      this.logger.log(
        'Didn\'t find a run in the sarif results. Error processing sarif?'
      );
      return;
    }

    const diagnostics: [Uri, ReadonlyArray<Diagnostic>][] = [];

    for (const result of sarif.runs[0].results) {
      const message = result.message.text;
      if (message === undefined) {
        this.logger.log('Sarif had result without plaintext message');
        continue;
      }
      if (!result.locations) {
        this.logger.log('Sarif had result without location');
        continue;
      }

      const sarifLoc = parseSarifLocation(
        result.locations[0],
        sourceLocationPrefix
      );
      if (sarifLoc.t == 'NoLocation') {
        continue;
      }
      const resultLocation = tryResolveLocation(sarifLoc, databaseItem);
      if (!resultLocation) {
        this.logger.log('Sarif location was not resolvable ' + sarifLoc);
        continue;
      }
      const parsedMessage = parseSarifPlainTextMessage(message);
      const relatedInformation: DiagnosticRelatedInformation[] = [];
      const relatedLocationsById: { [k: number]: Sarif.Location } = {};

      for (const loc of result.relatedLocations || []) {
        relatedLocationsById[loc.id!] = loc;
      }
      const resultMessageChunks: string[] = [];
      for (const section of parsedMessage) {
        if (typeof section === 'string') {
          resultMessageChunks.push(section);
        } else {
          resultMessageChunks.push(section.text);
          const sarifChunkLoc = parseSarifLocation(
            relatedLocationsById[section.dest],
            sourceLocationPrefix
          );
          if (sarifChunkLoc.t == 'NoLocation') {
            continue;
          }
          const referenceLocation = tryResolveLocation(
            sarifChunkLoc,
            databaseItem
          );

          if (referenceLocation) {
            const related = new DiagnosticRelatedInformation(
              referenceLocation,
              section.text
            );
            relatedInformation.push(related);
          }
        }
      }
      const diagnostic = new Diagnostic(
        resultLocation.range,
        resultMessageChunks.join(''),
        DiagnosticSeverity.Warning
      );
      diagnostic.relatedInformation = relatedInformation;

      diagnostics.push([resultLocation.uri, [diagnostic]]);
    }
    this._diagnosticCollection.set(diagnostics);
  }

  private convertPathToWebviewUri(path: string): string {
    return fileUriToWebviewUri(this.getPanel(), Uri.file(path));
  }

  private convertPathPropertiesToWebviewUris(
    info: SortedResultSetInfo
  ): SortedResultSetInfo {
    return {
      resultsPath: this.convertPathToWebviewUri(info.resultsPath),
      sortState: info.sortState,
    };
  }

  private handleSelectionChange(
    event: vscode.TextEditorSelectionChangeEvent
  ): void {
    if (event.kind === vscode.TextEditorSelectionChangeKind.Command) {
      return; // Ignore selection events we caused ourselves.
    }
    const editor = vscode.window.activeTextEditor;
    if (editor !== undefined) {
      editor.setDecorations(shownLocationDecoration, []);
      editor.setDecorations(shownLocationLineDecoration, []);
    }
  }
}
