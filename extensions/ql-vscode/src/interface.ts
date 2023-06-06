import * as Sarif from "sarif";
import * as vscode from "vscode";
import {
  Diagnostic,
  DiagnosticRelatedInformation,
  DiagnosticSeverity,
  languages,
  Uri,
  window as Window,
  env,
  WebviewPanel,
} from "vscode";
import * as cli from "./codeql-cli/cli";
import { CodeQLCliServer } from "./codeql-cli/cli";
import {
  DatabaseEventKind,
  DatabaseItem,
  DatabaseManager,
} from "./databases/local-databases";
import { showAndLogExceptionWithTelemetry } from "./helpers";
import {
  asError,
  assertNever,
  getErrorMessage,
  getErrorStack,
} from "./pure/helpers-pure";
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
  GRAPH_TABLE_NAME,
  RawResultsSortState,
  NavigationDirection,
  getDefaultResultSetName,
  ParsedResultSets,
} from "./pure/interface-types";
import { Logger } from "./common";
import {
  CompletedQueryInfo,
  interpretResultsSarif,
  interpretGraphResults,
  CompletedLocalQueryInfo,
} from "./query-results";
import { QueryEvaluationInfo } from "./run-queries-shared";
import {
  parseSarifLocation,
  parseSarifPlainTextMessage,
} from "./pure/sarif-utils";
import { WebviewReveal, fileUriToWebviewUri } from "./interface-utils";
import {
  tryResolveLocation,
  shownLocationDecoration,
  shownLocationLineDecoration,
  jumpToLocation,
} from "./databases/local-databases/locations";
import {
  RawResultSet,
  transformBqrsResultSet,
  ResultSetSchema,
} from "./pure/bqrs-cli-types";
import {
  AbstractWebview,
  WebviewPanelConfig,
} from "./common/vscode/abstract-webview";
import { isCanary, PAGE_SIZE } from "./config";
import { HistoryItemLabelProvider } from "./query-history/history-item-label-provider";
import { telemetryListener } from "./telemetry";
import { redactableError } from "./pure/errors";
import { ResultsViewCommands } from "./common/commands";

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
  sortState: InterpretedResultsSortState | undefined,
): void {
  if (sortState !== undefined) {
    const multiplier = sortMultiplier(sortState.sortDirection);
    switch (sortState.sortBy) {
      case "alert-message":
        results.sort((a, b) =>
          a.message.text === undefined
            ? 0
            : b.message.text === undefined
            ? 0
            : multiplier *
              a.message.text?.localeCompare(b.message.text, env.language),
        );
        break;
      default:
        assertNever(sortState.sortBy);
    }
  }
}

function interpretedPageSize(
  interpretation: Interpretation | undefined,
): number {
  if (interpretation?.data.t === "GraphInterpretationData") {
    // Graph views always have one result per page.
    return 1;
  }
  return PAGE_SIZE.getValue<number>();
}

function numPagesOfResultSet(
  resultSet: RawResultSet,
  interpretation?: Interpretation,
): number {
  const pageSize = interpretedPageSize(interpretation);

  const n =
    interpretation?.data.t === "GraphInterpretationData"
      ? interpretation.data.dot.length
      : resultSet.schema.rows;

  return Math.ceil(n / pageSize);
}

function numInterpretedPages(
  interpretation: Interpretation | undefined,
): number {
  if (!interpretation) {
    return 0;
  }

  const pageSize = interpretedPageSize(interpretation);

  const n =
    interpretation.data.t === "GraphInterpretationData"
      ? interpretation.data.dot.length
      : interpretation.data.runs[0].results?.length || 0;

  return Math.ceil(n / pageSize);
}

export class ResultsView extends AbstractWebview<
  IntoResultsViewMsg,
  FromResultsViewMsg
> {
  private _displayedQuery?: CompletedLocalQueryInfo;
  private _interpretation?: Interpretation;

  private readonly _diagnosticCollection = languages.createDiagnosticCollection(
    "codeql-query-results",
  );

  constructor(
    public ctx: vscode.ExtensionContext,
    private databaseManager: DatabaseManager,
    public cliServer: CodeQLCliServer,
    public logger: Logger,
    private labelProvider: HistoryItemLabelProvider,
  ) {
    super(ctx);
    this.push(this._diagnosticCollection);
    this.push(
      vscode.window.onDidChangeTextEditorSelection(
        this.handleSelectionChange.bind(this),
      ),
    );

    this.push(
      this.databaseManager.onDidChangeDatabaseItem(({ kind }) => {
        if (kind === DatabaseEventKind.Remove) {
          this._diagnosticCollection.clear();
          if (this.isShowingPanel) {
            void this.postMessage({
              t: "untoggleShowProblems",
            });
          }
        }
      }),
    );
  }

  public getCommands(): ResultsViewCommands {
    return {
      "codeQLQueryResults.up": this.navigateResultView.bind(
        this,
        NavigationDirection.up,
      ),
      "codeQLQueryResults.down": this.navigateResultView.bind(
        this,
        NavigationDirection.down,
      ),
      "codeQLQueryResults.left": this.navigateResultView.bind(
        this,
        NavigationDirection.left,
      ),
      "codeQLQueryResults.right": this.navigateResultView.bind(
        this,
        NavigationDirection.right,
      ),
      // For backwards compatibility with keybindings set using an earlier version of the extension.
      "codeQLQueryResults.nextPathStep": this.navigateResultView.bind(
        this,
        NavigationDirection.down,
      ),
      "codeQLQueryResults.previousPathStep": this.navigateResultView.bind(
        this,
        NavigationDirection.up,
      ),
    };
  }

  async navigateResultView(direction: NavigationDirection): Promise<void> {
    if (!this.panel?.visible) {
      return;
    }
    // Reveal the panel now as the subsequent call to 'Window.showTextEditor' in 'showLocation' may destroy the webview otherwise.
    this.panel.reveal();
    await this.postMessage({ t: "navigate", direction });
  }

  protected getPanelConfig(): WebviewPanelConfig {
    return {
      viewId: "resultsView",
      title: "CodeQL Query Results",
      viewColumn: this.chooseColumnForWebview(),
      preserveFocus: true,
      view: "results",
      // Required for the graph viewer which is using d3-graphviz WASM module. Only supported in canary mode.
      allowWasmEval: isCanary(),
    };
  }

  protected onPanelDispose(): void {
    this._displayedQuery = undefined;
  }

  protected async onMessage(msg: FromResultsViewMsg): Promise<void> {
    try {
      switch (msg.t) {
        case "viewLoaded":
          this.onWebViewLoaded();
          break;
        case "viewSourceFile": {
          await jumpToLocation(msg, this.databaseManager, this.logger);
          break;
        }
        case "toggleDiagnostics": {
          if (msg.visible) {
            const databaseItem = this.databaseManager.findDatabaseItem(
              Uri.parse(msg.databaseUri),
            );
            if (databaseItem !== undefined) {
              await this.showResultsAsDiagnostics(
                msg.origResultsPaths,
                msg.metadata,
                databaseItem,
              );
            }
          } else {
            // TODO: Only clear diagnostics on the same database.
            this._diagnosticCollection.clear();
          }
          break;
        }
        case "changeSort":
          await this.changeRawSortState(msg.resultSetName, msg.sortState);
          telemetryListener?.sendUIInteraction("local-results-column-sorting");
          break;
        case "changeInterpretedSort":
          await this.changeInterpretedSortState(msg.sortState);
          break;
        case "changePage":
          if (
            msg.selectedTable === ALERTS_TABLE_NAME ||
            msg.selectedTable === GRAPH_TABLE_NAME
          ) {
            await this.showPageOfInterpretedResults(msg.pageNumber);
          } else {
            await this.showPageOfRawResults(
              msg.selectedTable,
              msg.pageNumber,
              // When we are in an unsorted state, we guarantee that
              // sortedResultsInfo doesn't have an entry for the current
              // result set. Use this to determine whether or not we use
              // the sorted bqrs file.
              !!this._displayedQuery?.completedQuery.sortedResultsInfo[
                msg.selectedTable
              ],
            );
          }
          break;
        case "openFile":
          await this.openFile(msg.filePath);
          break;
        case "telemetry":
          telemetryListener?.sendUIInteraction(msg.action);
          break;
        case "unhandledError":
          void showAndLogExceptionWithTelemetry(
            redactableError(
              msg.error,
            )`Unhandled error in results view: ${msg.error.message}`,
          );
          break;
        default:
          assertNever(msg);
      }
    } catch (e) {
      void showAndLogExceptionWithTelemetry(
        redactableError(
          asError(e),
        )`Error handling message from results view: ${getErrorMessage(e)}`,
        {
          fullMessage: getErrorStack(e),
        },
      );
    }
  }

  /**
   * Choose where to open the webview.
   *
   * If there is a single view column, then open beside it.
   * If there are multiple view columns, then open beside the active column,
   * unless the active editor is the last column. In this case, open in the first column.
   *
   * The goal is to avoid opening new columns when there already are two columns open.
   */
  private chooseColumnForWebview(): vscode.ViewColumn {
    // This is not a great way to determine the number of view columns, but I
    // can't find a vscode API that does it any better.
    // Here, iterate through all the visible editors and determine the max view column.
    // This won't work if the largest view column is empty.
    const colCount = Window.visibleTextEditors.reduce(
      (maxVal, editor) =>
        Math.max(
          maxVal,
          Number.parseInt(editor.viewColumn?.toFixed() || "0", 10),
        ),
      0,
    );
    if (colCount <= 1) {
      return vscode.ViewColumn.Beside;
    }
    const activeViewColumnNum = Number.parseInt(
      Window.activeTextEditor?.viewColumn?.toFixed() || "0",
      10,
    );
    return activeViewColumnNum === colCount
      ? vscode.ViewColumn.One
      : vscode.ViewColumn.Beside;
  }

  private async changeInterpretedSortState(
    sortState: InterpretedResultsSortState | undefined,
  ): Promise<void> {
    if (this._displayedQuery === undefined) {
      void showAndLogExceptionWithTelemetry(
        redactableError`Failed to sort results since evaluation info was unknown.`,
      );
      return;
    }
    // Notify the webview that it should expect new results.
    await this.postMessage({ t: "resultsUpdating" });
    await this._displayedQuery.completedQuery.updateInterpretedSortState(
      sortState,
    );
    await this.showResults(this._displayedQuery, WebviewReveal.NotForced, true);
  }

  private async changeRawSortState(
    resultSetName: string,
    sortState: RawResultsSortState | undefined,
  ): Promise<void> {
    if (this._displayedQuery === undefined) {
      void showAndLogExceptionWithTelemetry(
        redactableError`Failed to sort results since evaluation info was unknown.`,
      );
      return;
    }
    // Notify the webview that it should expect new results.
    await this.postMessage({ t: "resultsUpdating" });
    await this._displayedQuery.completedQuery.updateSortState(
      this.cliServer,
      resultSetName,
      sortState,
    );
    // Sorting resets to first page, as there is arguably no particular
    // correlation between the results on the nth page that the user
    // was previously viewing and the contents of the nth page in a
    // new sorted order.
    await this.showPageOfRawResults(resultSetName, 0, true);
  }

  /**
   * Show query results in webview panel.
   * @param fullQuery Evaluation info for the executed query.
   * @param shouldKeepOldResultsWhileRendering Should keep old results while rendering.
   * @param forceReveal Force the webview panel to be visible and
   * Appropriate when the user has just performed an explicit
   * UI interaction requesting results, e.g. clicking on a query
   * history entry.
   */
  public async showResults(
    fullQuery: CompletedLocalQueryInfo,
    forceReveal: WebviewReveal,
    shouldKeepOldResultsWhileRendering = false,
  ): Promise<void> {
    if (!fullQuery.completedQuery?.successful) {
      return;
    }

    const panel = await this.getPanel();

    this._interpretation = undefined;
    const interpretationPage = await this.interpretResultsInfo(
      fullQuery.completedQuery.query,
      fullQuery.completedQuery.interpretedResultsSortState,
    );

    const sortedResultsMap: SortedResultsMap = {};
    Object.entries(fullQuery.completedQuery.sortedResultsInfo).forEach(
      ([k, v]) =>
        (sortedResultsMap[k] = this.convertPathPropertiesToWebviewUris(
          panel,
          v,
        )),
    );

    this._displayedQuery = fullQuery;

    await this.waitForPanelLoaded();
    if (!panel.visible) {
      if (forceReveal === WebviewReveal.Forced) {
        panel.reveal(undefined, true);
      } else {
        // The results panel exists, (`.getPanel()` guarantees it) but
        // is not visible; it's in a not-currently-viewed tab. Show a
        // more asynchronous message to not so abruptly interrupt
        // user's workflow by immediately revealing the panel.
        const showButton = "View Results";
        const queryName = this.labelProvider.getShortLabel(fullQuery);
        const resultPromise = vscode.window.showInformationMessage(
          `Finished running query ${
            queryName.length > 0 ? ` "${queryName}"` : ""
          }.`,
          showButton,
        );
        // Address this click asynchronously so we still update the
        // query history immediately.
        void resultPromise.then((result) => {
          if (result === showButton) {
            panel.reveal();
          }
        });
      }
    }

    // Note that the resultSetSchemas will return offsets for the default (unsorted) page,
    // which may not be correct. However, in this case, it doesn't matter since we only
    // need the first offset, which will be the same no matter which sorting we use.
    const resultSetSchemas = await this.getResultSetSchemas(
      fullQuery.completedQuery,
    );
    const resultSetNames = resultSetSchemas.map((schema) => schema.name);

    const selectedTable = getDefaultResultSetName(resultSetNames);
    const schema = resultSetSchemas.find(
      (resultSet) => resultSet.name === selectedTable,
    )!;

    // Use sorted results path if it exists. This may happen if we are
    // reloading the results view after it has been sorted in the past.
    const resultsPath = fullQuery.completedQuery.getResultsPath(selectedTable);
    const pageSize = PAGE_SIZE.getValue<number>();
    const chunk = await this.cliServer.bqrsDecode(resultsPath, schema.name, {
      // Always send the first page.
      // It may not wind up being the page we actually show,
      // if there are interpreted results, but speculatively
      // send anyway.
      offset: schema.pagination?.offsets[0],
      pageSize,
    });
    const resultSet = transformBqrsResultSet(schema, chunk);
    fullQuery.completedQuery.setResultCount(
      interpretationPage?.numTotalResults || resultSet.schema.rows,
    );
    const parsedResultSets: ParsedResultSets = {
      pageNumber: 0,
      pageSize,
      numPages: numPagesOfResultSet(resultSet, this._interpretation),
      numInterpretedPages: numInterpretedPages(this._interpretation),
      resultSet: { ...resultSet, t: "RawResultSet" },
      selectedTable: undefined,
      resultSetNames,
    };

    await this.postMessage({
      t: "setState",
      interpretation: interpretationPage,
      origResultsPaths: fullQuery.completedQuery.query.resultsPaths,
      resultsPath: this.convertPathToWebviewUri(
        panel,
        fullQuery.completedQuery.query.resultsPaths.resultsPath,
      ),
      parsedResultSets,
      sortedResultsMap,
      database: fullQuery.initialInfo.databaseInfo,
      shouldKeepOldResultsWhileRendering,
      metadata: fullQuery.completedQuery.query.metadata,
      queryName: this.labelProvider.getLabel(fullQuery),
      queryPath: fullQuery.initialInfo.queryPath,
    });
  }

  /**
   * Show a page of interpreted results
   */
  public async showPageOfInterpretedResults(pageNumber: number): Promise<void> {
    if (this._displayedQuery === undefined) {
      throw new Error(
        "Trying to show interpreted results but displayed query was undefined",
      );
    }
    if (this._interpretation === undefined) {
      throw new Error(
        "Trying to show interpreted results but interpretation was undefined",
      );
    }
    if (
      this._interpretation.data.t === "SarifInterpretationData" &&
      this._interpretation.data.runs[0].results === undefined
    ) {
      throw new Error(
        "Trying to show interpreted results but results were undefined",
      );
    }

    const resultSetSchemas = await this.getResultSetSchemas(
      this._displayedQuery.completedQuery,
    );
    const resultSetNames = resultSetSchemas.map((schema) => schema.name);

    await this.postMessage({
      t: "showInterpretedPage",
      interpretation: this.getPageOfInterpretedResults(pageNumber),
      database: this._displayedQuery.initialInfo.databaseInfo,
      metadata: this._displayedQuery.completedQuery.query.metadata,
      pageNumber,
      resultSetNames,
      pageSize: interpretedPageSize(this._interpretation),
      numPages: numInterpretedPages(this._interpretation),
      queryName: this.labelProvider.getLabel(this._displayedQuery),
      queryPath: this._displayedQuery.initialInfo.queryPath,
    });
  }

  private async getResultSetSchemas(
    completedQuery: CompletedQueryInfo,
    selectedTable = "",
  ): Promise<ResultSetSchema[]> {
    const resultsPath = completedQuery.getResultsPath(selectedTable);
    const schemas = await this.cliServer.bqrsInfo(
      resultsPath,
      PAGE_SIZE.getValue(),
    );
    return schemas["result-sets"];
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
    sorted = false,
  ): Promise<void> {
    const results = this._displayedQuery;
    if (results === undefined) {
      throw new Error("trying to view a page of a query that is not loaded");
    }

    const panel = await this.getPanel();

    const sortedResultsMap: SortedResultsMap = {};
    Object.entries(results.completedQuery.sortedResultsInfo).forEach(
      ([k, v]) =>
        (sortedResultsMap[k] = this.convertPathPropertiesToWebviewUris(
          panel,
          v,
        )),
    );

    const resultSetSchemas = await this.getResultSetSchemas(
      results.completedQuery,
      sorted ? selectedTable : "",
    );

    // If there is a specific sorted table selected, a different bqrs file is loaded that doesn't have all the result set names.
    // Make sure that we load all result set names here.
    // See https://github.com/github/vscode-codeql/issues/1005
    const allResultSetSchemas = sorted
      ? await this.getResultSetSchemas(results.completedQuery, "")
      : resultSetSchemas;
    const resultSetNames = allResultSetSchemas.map((schema) => schema.name);

    const schema = resultSetSchemas.find(
      (resultSet) => resultSet.name === selectedTable,
    )!;
    if (schema === undefined)
      throw new Error(`Query result set '${selectedTable}' not found.`);

    const pageSize = PAGE_SIZE.getValue<number>();
    const chunk = await this.cliServer.bqrsDecode(
      results.completedQuery.getResultsPath(selectedTable, sorted),
      schema.name,
      {
        offset: schema.pagination?.offsets[pageNumber],
        pageSize,
      },
    );
    const resultSet = transformBqrsResultSet(schema, chunk);

    const parsedResultSets: ParsedResultSets = {
      pageNumber,
      pageSize,
      resultSet: { t: "RawResultSet", ...resultSet },
      numPages: numPagesOfResultSet(resultSet),
      numInterpretedPages: numInterpretedPages(this._interpretation),
      selectedTable,
      resultSetNames,
    };

    await this.postMessage({
      t: "setState",
      interpretation: this._interpretation,
      origResultsPaths: results.completedQuery.query.resultsPaths,
      resultsPath: this.convertPathToWebviewUri(
        panel,
        results.completedQuery.query.resultsPaths.resultsPath,
      ),
      parsedResultSets,
      sortedResultsMap,
      database: results.initialInfo.databaseInfo,
      shouldKeepOldResultsWhileRendering: false,
      metadata: results.completedQuery.query.metadata,
      queryName: this.labelProvider.getLabel(results),
      queryPath: results.initialInfo.queryPath,
    });
  }

  private async _getInterpretedResults(
    metadata: QueryMetadata | undefined,
    resultsPaths: ResultsPaths,
    sourceInfo: cli.SourceInfo | undefined,
    sourceLocationPrefix: string,
    sortState: InterpretedResultsSortState | undefined,
  ): Promise<Interpretation | undefined> {
    if (!resultsPaths) {
      void this.logger.log(
        "No results path. Cannot display interpreted results.",
      );
      return undefined;
    }
    let data;
    let numTotalResults;
    // Graph results are only supported in canary mode because the graph viewer is not actively supported
    if (metadata?.kind === GRAPH_TABLE_NAME && isCanary()) {
      data = await interpretGraphResults(
        this.cliServer,
        metadata,
        resultsPaths,
        sourceInfo,
      );
      numTotalResults = data.dot.length;
    } else {
      const sarif = await interpretResultsSarif(
        this.cliServer,
        metadata,
        resultsPaths,
        sourceInfo,
      );

      sarif.runs.forEach((run) => {
        if (run.results) {
          sortInterpretedResults(run.results, sortState);
        }
      });

      sarif.sortState = sortState;
      data = sarif;

      numTotalResults = (() => {
        return sarif.runs?.[0]?.results ? sarif.runs[0].results.length : 0;
      })();
    }

    const interpretation: Interpretation = {
      data,
      sourceLocationPrefix,
      numTruncatedResults: 0,
      numTotalResults,
    };
    this._interpretation = interpretation;
    return interpretation;
  }

  private getPageOfInterpretedResults(pageNumber: number): Interpretation {
    function getPageOfRun(run: Sarif.Run): Sarif.Run {
      return {
        ...run,
        results: run.results?.slice(
          PAGE_SIZE.getValue<number>() * pageNumber,
          PAGE_SIZE.getValue<number>() * (pageNumber + 1),
        ),
      };
    }

    const interp = this._interpretation;
    if (interp === undefined) {
      throw new Error(
        "Tried to get interpreted results before interpretation finished",
      );
    }

    if (interp.data.t !== "SarifInterpretationData") return interp;

    if (interp.data.runs.length !== 1) {
      void this.logger.log(
        `Warning: SARIF file had ${interp.data.runs.length} runs, expected 1`,
      );
    }

    return {
      ...interp,
      data: {
        ...interp.data,
        runs: [getPageOfRun(interp.data.runs[0])],
      },
    };
  }

  private async interpretResultsInfo(
    query: QueryEvaluationInfo,
    sortState: InterpretedResultsSortState | undefined,
  ): Promise<Interpretation | undefined> {
    if (
      query.canHaveInterpretedResults() &&
      query.quickEvalPosition === undefined // never do results interpretation if quickEval
    ) {
      try {
        const dbItem = this.databaseManager.findDatabaseItem(
          Uri.file(query.dbItemPath),
        );
        if (!dbItem) {
          throw new Error(
            `Could not find database item for ${query.dbItemPath}`,
          );
        }
        const sourceLocationPrefix = await dbItem.getSourceLocationPrefix(
          this.cliServer,
        );
        const sourceArchiveUri = dbItem.sourceArchive;
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
          sortState,
        );
      } catch (e) {
        // If interpretation fails, accept the error and continue
        // trying to render uninterpreted results anyway.
        void showAndLogExceptionWithTelemetry(
          redactableError(
            asError(e),
          )`Showing raw results instead of interpreted ones due to an error. ${getErrorMessage(
            e,
          )}`,
        );
      }
    }
    return this._interpretation && this.getPageOfInterpretedResults(0);
  }

  private async showResultsAsDiagnostics(
    resultsInfo: ResultsPaths,
    metadata: QueryMetadata | undefined,
    database: DatabaseItem,
  ): Promise<void> {
    const sourceLocationPrefix = await database.getSourceLocationPrefix(
      this.cliServer,
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
      undefined,
    );

    if (!interpretation) {
      return;
    }

    try {
      await this.showProblemResultsAsDiagnostics(interpretation, database);
    } catch (e) {
      void this.logger.log(
        `Exception while computing problem results as diagnostics: ${getErrorMessage(
          e,
        )}`,
      );
      this._diagnosticCollection.clear();
    }
  }

  private async showProblemResultsAsDiagnostics(
    interpretation: Interpretation,
    databaseItem: DatabaseItem,
  ): Promise<void> {
    const { data, sourceLocationPrefix } = interpretation;

    if (data.t !== "SarifInterpretationData") return;

    if (!data.runs || !data.runs[0].results) {
      void this.logger.log(
        "Didn't find a run in the sarif results. Error processing sarif?",
      );
      return;
    }

    const diagnostics: Array<[Uri, readonly Diagnostic[]]> = [];

    for (const result of data.runs[0].results) {
      const message = result.message.text;
      if (message === undefined) {
        void this.logger.log("Sarif had result without plaintext message");
        continue;
      }
      if (!result.locations) {
        void this.logger.log("Sarif had result without location");
        continue;
      }

      const sarifLoc = parseSarifLocation(
        result.locations[0],
        sourceLocationPrefix,
      );
      if ("hint" in sarifLoc) {
        continue;
      }
      const resultLocation = tryResolveLocation(sarifLoc, databaseItem);
      if (!resultLocation) {
        void this.logger.log(`Sarif location was not resolvable ${sarifLoc}`);
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
        if (typeof section === "string") {
          resultMessageChunks.push(section);
        } else {
          resultMessageChunks.push(section.text);
          const sarifChunkLoc = parseSarifLocation(
            relatedLocationsById[section.dest],
            sourceLocationPrefix,
          );
          if ("hint" in sarifChunkLoc) {
            continue;
          }
          const referenceLocation = tryResolveLocation(
            sarifChunkLoc,
            databaseItem,
          );

          if (referenceLocation) {
            const related = new DiagnosticRelatedInformation(
              referenceLocation,
              section.text,
            );
            relatedInformation.push(related);
          }
        }
      }
      const diagnostic = new Diagnostic(
        resultLocation.range,
        resultMessageChunks.join(""),
        DiagnosticSeverity.Warning,
      );
      diagnostic.relatedInformation = relatedInformation;

      diagnostics.push([resultLocation.uri, [diagnostic]]);
    }
    this._diagnosticCollection.set(diagnostics);
  }

  private convertPathToWebviewUri(panel: WebviewPanel, path: string): string {
    return fileUriToWebviewUri(panel, Uri.file(path));
  }

  private convertPathPropertiesToWebviewUris(
    panel: WebviewPanel,
    info: SortedResultSetInfo,
  ): SortedResultSetInfo {
    return {
      resultsPath: this.convertPathToWebviewUri(panel, info.resultsPath),
      sortState: info.sortState,
    };
  }

  private handleSelectionChange(
    event: vscode.TextEditorSelectionChangeEvent,
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
