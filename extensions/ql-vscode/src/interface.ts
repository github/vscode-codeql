import * as path from 'path';
import * as Sarif from 'sarif';
import { DisposableObject } from './pure/disposable-object';
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
import { DatabaseEventKind, DatabaseItem, DatabaseManager } from './databases';
import { showAndLogErrorMessage } from './helpers';
import { assertNever } from './pure/helpers-pure';
import {
  FromResultsViewMsg,
  Interpretation,
  IntoResultsViewMsg,
  QueryMetadata,
  ResultsPaths,
  SortedResultSetInfo,
  SortedResultsMap,
  InterpretedResultsSortState,
  SortDirection,
  ALERTS_TABLE_NAME,
  RawResultsSortState,
} from './pure/interface-types';
import { Logger } from './logging';
import * as messages from './pure/messages';
import { commandRunner } from './commandRunner';
import { CompletedQuery, interpretResults } from './query-results';
import { QueryInfo, tmpDir } from './run-queries';
import { parseSarifLocation, parseSarifPlainTextMessage } from './pure/sarif-utils';
import {
  WebviewReveal,
  fileUriToWebviewUri,
  tryResolveLocation,
  getHtmlForWebview,
  shownLocationDecoration,
  shownLocationLineDecoration,
  jumpToLocation,
} from './interface-utils';
import { getDefaultResultSetName, ParsedResultSets } from './pure/interface-types';
import { RawResultSet, transformBqrsResultSet, ResultSetSchema } from './pure/bqrs-cli-types';
import { PAGE_SIZE } from './config';

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
  return Math.ceil(resultSet.schema.rows / PAGE_SIZE.getValue<number>());
}

function numInterpretedPages(interpretation: Interpretation | undefined): number {
  return Math.ceil((interpretation?.sarif.runs[0].results?.length || 0) / PAGE_SIZE.getValue<number>());
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
    void logger.log('Registering path-step navigation commands.');
    this.push(
      commandRunner(
        'codeQLQueryResults.nextPathStep',
        this.navigatePathStep.bind(this, 1)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryResults.previousPathStep',
        this.navigatePathStep.bind(this, -1)
      )
    );

    this.push(
      this.databaseManager.onDidChangeDatabaseItem(({ kind }) => {
        if (kind === DatabaseEventKind.Remove) {
          this._diagnosticCollection.clear();
          if (this.isShowingPanel()) {
            void this.postMessage({
              t: 'untoggleShowProblems'
            });
          }
        }
      })
    );
  }

  async navigatePathStep(direction: number): Promise<void> {
    await this.postMessage({ t: 'navigatePath', direction });
  }

  private isShowingPanel() {
    return !!this._panel;
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

  private async changeInterpretedSortState(
    sortState: InterpretedResultsSortState | undefined
  ): Promise<void> {
    if (this._displayedQuery === undefined) {
      void showAndLogErrorMessage(
        'Failed to sort results since evaluation info was unknown.'
      );
      return;
    }
    // Notify the webview that it should expect new results.
    await this.postMessage({ t: 'resultsUpdating' });
    await this._displayedQuery.updateInterpretedSortState(sortState);
    await this.showResults(this._displayedQuery, WebviewReveal.NotForced, true);
  }

  private async changeRawSortState(
    resultSetName: string,
    sortState: RawResultsSortState | undefined
  ): Promise<void> {
    if (this._displayedQuery === undefined) {
      void showAndLogErrorMessage(
        'Failed to sort results since evaluation info was unknown.'
      );
      return;
    }
    // Notify the webview that it should expect new results.
    await this.postMessage({ t: 'resultsUpdating' });
    await this._displayedQuery.updateSortState(
      this.cliServer,
      resultSetName,
      sortState
    );
    // Sorting resets to first page, as there is arguably no particular
    // correlation between the results on the nth page that the user
    // was previously viewing and the contents of the nth page in a
    // new sorted order.
    await this.showPageOfRawResults(resultSetName, 0, true);
  }

  private async handleMsgFromView(msg: FromResultsViewMsg): Promise<void> {
    try {
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
          await this.changeRawSortState(msg.resultSetName, msg.sortState);
          break;
        case 'changeInterpretedSort':
          await this.changeInterpretedSortState(msg.sortState);
          break;
        case 'changePage':
          if (msg.selectedTable === ALERTS_TABLE_NAME) {
            await this.showPageOfInterpretedResults(msg.pageNumber);
          }
          else {
            await this.showPageOfRawResults(
              msg.selectedTable,
              msg.pageNumber,
              // When we are in an unsorted state, we guarantee that
              // sortedResultsInfo doesn't have an entry for the current
              // result set. Use this to determine whether or not we use
              // the sorted bqrs file.
              this._displayedQuery?.sortedResultsInfo.has(msg.selectedTable) || false
            );
          }
          break;
        case 'openFile':
          await this.openFile(msg.filePath);
          break;
        default:
          assertNever(msg);
      }
    } catch (e) {
      void showAndLogErrorMessage(e.message, {
        fullMessage: e.stack
      });
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
    if (!results.result || results.result.resultType !== messages.QueryResultType.SUCCESS) {
      return;
    }

    this._interpretation = undefined;
    const interpretationPage = await this.interpretResultsInfo(
      results.query,
      results.interpretedResultsSortState
    );

    const sortedResultsMap: SortedResultsMap = {};
    results.sortedResultsInfo.forEach(
      (v, k) =>
        (sortedResultsMap[k] = this.convertPathPropertiesToWebviewUris(v))
    );

    this._displayedQuery = results;

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
        `Finished running query ${queryName.length > 0 ? ` "${queryName}"` : ''
        }.`,
        showButton
      );
      // Address this click asynchronously so we still update the
      // query history immediately.
      void resultPromise.then((result) => {
        if (result === showButton) {
          panel.reveal();
        }
      });
    }

    // Note that the resultSetSchemas will return offsets for the default (unsorted) page,
    // which may not be correct. However, in this case, it doesn't matter since we only
    // need the first offset, which will be the same no matter which sorting we use.
    const resultSetSchemas = await this.getResultSetSchemas(results);
    const resultSetNames = resultSetSchemas.map(schema => schema.name);

    const selectedTable = getDefaultResultSetName(resultSetNames);
    const schema = resultSetSchemas.find(
      (resultSet) => resultSet.name == selectedTable
    )!;

    // Use sorted results path if it exists. This may happen if we are
    // reloading the results view after it has been sorted in the past.
    const resultsPath = results.getResultsPath(selectedTable);
    const pageSize = PAGE_SIZE.getValue<number>();
    const chunk = await this.cliServer.bqrsDecode(
      resultsPath,
      schema.name,
      {
        // Always send the first page.
        // It may not wind up being the page we actually show,
        // if there are interpreted results, but speculatively
        // send anyway.
        offset: schema.pagination?.offsets[0],
        pageSize
      }
    );
    const resultSet = transformBqrsResultSet(schema, chunk);
    results.setResultCount(interpretationPage?.numTotalResults || resultSet.schema.rows);
    const parsedResultSets: ParsedResultSets = {
      pageNumber: 0,
      pageSize,
      numPages: numPagesOfResultSet(resultSet),
      numInterpretedPages: numInterpretedPages(this._interpretation),
      resultSet: { ...resultSet, t: 'RawResultSet' },
      selectedTable: undefined,
      resultSetNames,
    };

    await this.postMessage({
      t: 'setState',
      interpretation: interpretationPage,
      origResultsPaths: results.query.resultsPaths,
      resultsPath: this.convertPathToWebviewUri(
        results.query.resultsPaths.resultsPath
      ),
      parsedResultSets,
      sortedResultsMap,
      database: results.database,
      shouldKeepOldResultsWhileRendering,
      metadata: results.query.metadata,
      queryName: results.toString(),
      queryPath: results.query.program.queryPath
    });
  }

  /**
   * Show a page of interpreted results
   */
  public async showPageOfInterpretedResults(
    pageNumber: number
  ): Promise<void> {
    if (this._displayedQuery === undefined) {
      throw new Error('Trying to show interpreted results but displayed query was undefined');
    }
    if (this._interpretation === undefined) {
      throw new Error('Trying to show interpreted results but interpretation was undefined');
    }
    if (this._interpretation.sarif.runs[0].results === undefined) {
      throw new Error('Trying to show interpreted results but results were undefined');
    }

    const resultSetSchemas = await this.getResultSetSchemas(this._displayedQuery);
    const resultSetNames = resultSetSchemas.map(schema => schema.name);

    await this.postMessage({
      t: 'showInterpretedPage',
      interpretation: this.getPageOfInterpretedResults(pageNumber),
      database: this._displayedQuery.database,
      metadata: this._displayedQuery.query.metadata,
      pageNumber,
      resultSetNames,
      pageSize: PAGE_SIZE.getValue(),
      numPages: numInterpretedPages(this._interpretation),
      queryName: this._displayedQuery.toString(),
      queryPath: this._displayedQuery.query.program.queryPath
    });
  }

  private async getResultSetSchemas(results: CompletedQuery, selectedTable = ''): Promise<ResultSetSchema[]> {
    const resultsPath = results.getResultsPath(selectedTable);
    const schemas = await this.cliServer.bqrsInfo(
      resultsPath,
      PAGE_SIZE.getValue()
    );
    return schemas['result-sets'];
  }

  public async openFile(filePath: string) {
    const textDocument = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(textDocument, vscode.ViewColumn.One);
  }

  /**
   * Show a page of raw results from the chosen table.
   */
  public async showPageOfRawResults(
    selectedTable: string,
    pageNumber: number,
    sorted = false
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

    const resultSetSchemas = await this.getResultSetSchemas(results, sorted ? selectedTable : '');

    // If there is a specific sorted table selected, a different bqrs file is loaded that doesn't have all the result set names.
    // Make sure that we load all result set names here.
    // See https://github.com/github/vscode-codeql/issues/1005
    const allResultSetSchemas = sorted ? await this.getResultSetSchemas(results, '') : resultSetSchemas;
    const resultSetNames = allResultSetSchemas.map(schema => schema.name);

    const schema = resultSetSchemas.find(
      (resultSet) => resultSet.name == selectedTable
    )!;
    if (schema === undefined)
      throw new Error(`Query result set '${selectedTable}' not found.`);

    const pageSize = PAGE_SIZE.getValue<number>();
    const chunk = await this.cliServer.bqrsDecode(
      results.getResultsPath(selectedTable, sorted),
      schema.name,
      {
        offset: schema.pagination?.offsets[pageNumber],
        pageSize
      }
    );
    const resultSet = transformBqrsResultSet(schema, chunk);

    const parsedResultSets: ParsedResultSets = {
      pageNumber,
      pageSize,
      resultSet: { t: 'RawResultSet', ...resultSet },
      numPages: numPagesOfResultSet(resultSet),
      numInterpretedPages: numInterpretedPages(this._interpretation),
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
      queryName: results.toString(),
      queryPath: results.query.program.queryPath
    });
  }

  private async _getInterpretedResults(
    metadata: QueryMetadata | undefined,
    resultsPaths: ResultsPaths,
    sourceInfo: cli.SourceInfo | undefined,
    sourceLocationPrefix: string,
    sortState: InterpretedResultsSortState | undefined
  ): Promise<Interpretation | undefined> {
    if (!resultsPaths) {
      void this.logger.log('No results path. Cannot display interpreted results.');
      return undefined;
    }

    const sarif = await interpretResults(
      this.cliServer,
      metadata,
      resultsPaths,
      sourceInfo
    );

    sarif.runs.forEach(run => {
      if (run.results !== undefined) {
        sortInterpretedResults(run.results, sortState);
      }
    });

    const numTotalResults = sarif.runs[0]?.results?.length || 0;

    const interpretation: Interpretation = {
      sarif,
      sourceLocationPrefix,
      numTruncatedResults: 0,
      numTotalResults,
      sortState,
    };
    this._interpretation = interpretation;
    return interpretation;
  }

  private getPageOfInterpretedResults(
    pageNumber: number
  ): Interpretation {

    function getPageOfRun(run: Sarif.Run): Sarif.Run {
      return {
        ...run, results: run.results?.slice(
          PAGE_SIZE.getValue<number>() * pageNumber,
          PAGE_SIZE.getValue<number>() * (pageNumber + 1)
        )
      };
    }

    if (this._interpretation === undefined) {
      throw new Error('Tried to get interpreted results before interpretation finished');
    }
    if (this._interpretation.sarif.runs.length !== 1) {
      void this.logger.log(`Warning: SARIF file had ${this._interpretation.sarif.runs.length} runs, expected 1`);
    }
    const interp = this._interpretation;
    return {
      ...interp,
      sarif: { ...interp.sarif, runs: [getPageOfRun(interp.sarif.runs[0])] },
    };
  }

  private async interpretResultsInfo(
    query: QueryInfo,
    sortState: InterpretedResultsSortState | undefined
  ): Promise<Interpretation | undefined> {
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
        await this._getInterpretedResults(
          query.metadata,
          query.resultsPaths,
          sourceInfo,
          sourceLocationPrefix,
          sortState
        );
      } catch (e) {
        // If interpretation fails, accept the error and continue
        // trying to render uninterpreted results anyway.
        void showAndLogErrorMessage(
          `Showing raw results instead of interpreted ones due to an error. ${e.message}`
        );
      }
    }
    return this._interpretation && this.getPageOfInterpretedResults(0);
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
    // TODO: Performance-testing to determine whether this truncation is necessary.
    const interpretation = await this._getInterpretedResults(
      metadata,
      resultsInfo,
      sourceInfo,
      sourceLocationPrefix,
      undefined
    );

    if (!interpretation) {
      return;
    }

    try {
      await this.showProblemResultsAsDiagnostics(interpretation, database);
    } catch (e) {
      const msg = e instanceof Error ? e.message : e.toString();
      void this.logger.log(
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
      void this.logger.log(
        'Didn\'t find a run in the sarif results. Error processing sarif?'
      );
      return;
    }

    const diagnostics: [Uri, ReadonlyArray<Diagnostic>][] = [];

    for (const result of sarif.runs[0].results) {
      const message = result.message.text;
      if (message === undefined) {
        void this.logger.log('Sarif had result without plaintext message');
        continue;
      }
      if (!result.locations) {
        void this.logger.log('Sarif had result without location');
        continue;
      }

      const sarifLoc = parseSarifLocation(
        result.locations[0],
        sourceLocationPrefix
      );
      if ('hint' in sarifLoc) {
        continue;
      }
      const resultLocation = tryResolveLocation(sarifLoc, databaseItem);
      if (!resultLocation) {
        void this.logger.log('Sarif location was not resolvable ' + sarifLoc);
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
          if ('hint' in sarifChunkLoc) {
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
