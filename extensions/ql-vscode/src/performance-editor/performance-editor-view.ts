import * as vscode from "vscode";
import { Range, languages, window as Window } from "vscode";
import { DatabaseEventKind, DatabaseManager } from "../local-databases";
import { showAndLogWarningMessage } from "../helpers";
// import {
//   asError,
//   //assertNever,
//   getErrorMessage,
//   getErrorStack,
// } from "../pure/helpers-pure";

import {
  IntoPerformanceEditorViewMsg,
  FromPerformanceEditorViewMsg,
} from "../pure/interface-types";
import { Logger } from "../common";
///import { CompletedLocalQueryInfo } from "../query-results";
import { AbstractWebview, WebviewPanelConfig } from "../abstract-webview";
import { isCanary } from "../config";
import { HistoryItemLabelProvider } from "../query-history/history-item-label-provider";
import { QueryHistoryInfo } from "../query-history/query-history-info";
import { CompletedLocalQueryInfo } from "../query-results";
import { showLocation, WebviewReveal } from "../interface-utils";
import {
  PerformanceEditorRow,
  PerformanceGraph,
} from "./performance-editor-model";
import { ResolvableLocationValue } from "../pure/bqrs-cli-types";

export class PerformanceEditorView extends AbstractWebview<
  IntoPerformanceEditorViewMsg,
  FromPerformanceEditorViewMsg
> {
  //   private _displayedQuery?: CompletedLocalQueryInfo;
  //   private _interpretation?: Interpretation;

  private performanceGraph?: PerformanceGraph;

  private readonly _diagnosticCollection = languages.createDiagnosticCollection(
    "codeql-performance-editor",
  );

  constructor(
    public ctx: vscode.ExtensionContext,
    private databaseManager: DatabaseManager,
    public logger: Logger,
    private labelProvider: HistoryItemLabelProvider,
  ) {
    super(ctx);
    this.push(this._diagnosticCollection);
    // this.push(
    //   vscode.window.onDidChangeTextEditorSelection(
    //     this.handleSelectionChange.bind(this),
    //   ),
    // );

    this.push(
      this.databaseManager.onDidChangeDatabaseItem(({ kind }) => {
        if (kind === DatabaseEventKind.Remove) {
          this._diagnosticCollection.clear();
          if (this.isShowingPanel) {
            // void this.postMessage({
            //   t: "untoggleShowProblems",
            // });
          }
        }
      }),
    );
  }

  public fake(q: QueryHistoryInfo) {
    this.labelProvider.getLabel(q);
  }

  protected getPanelConfig(): WebviewPanelConfig {
    return {
      viewId: "performanceEditorView",
      title: "CodeQL Performance Viewer",
      viewColumn: this.chooseColumnForWebview(),
      preserveFocus: true,
      view: "performance-editor",
      // Required for the graph viewer which is using d3-graphviz WASM module. Only supported in canary mode.
      allowWasmEval: isCanary(),
    };
  }

  protected onPanelDispose(): void {
    //this._displayedQuery = undefined;
  }

  protected async jumpToPredicate(
    location: ResolvableLocationValue,
  ): Promise<void> {
    const range = new Range(
      Math.max(0, location.startLine - 1),
      Math.max(0, location.startColumn - 1),
      Math.max(0, location.endLine - 1),
      Math.max(1, location.endColumn),
    );

    await showLocation({
      uri: vscode.Uri.file(location.uri),
      range,
    });
  }

  protected async onMessage(msg: FromPerformanceEditorViewMsg): Promise<void> {
    console.log(msg);
    try {
      switch (msg.t) {
        case "viewLoaded":
          this.onWebViewLoaded();
          break;
        case "jumpToPredicate":
          await this.jumpToPredicate(msg.location);

          break;
        // case "unhandledError":
        //   void showAndLogExceptionWithTelemetry(
        //     redactableError(
        //       msg.error,
        //     )`Unhandled error in results view: ${msg.error.message}`,
        //   );
        //   break;
        default:
          //assertNever(msg);
          break;
      }
    } catch (e) {
      //   void showAndLogExceptionWithTelemetry(
      //     redactableError(
      //       asError(e),
      //     )`Error handling message from performance editor view: ${getErrorMessage(
      //       e,
      //     )}`,
      //     {
      //       fullMessage: getErrorStack(e),
      //     },
      //   );
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

  public async showResults(
    fullQuery: CompletedLocalQueryInfo,
    forceReveal: WebviewReveal,
  ): Promise<void> {
    if (!fullQuery.completedQuery?.successful) {
      return;
    }

    const panel = await this.getPanel();

    // this._interpretation = undefined;
    // const interpretationPage = await this.interpretResultsInfo(
    //   fullQuery.completedQuery.query,
    //   fullQuery.completedQuery.interpretedResultsSortState,
    // );

    // const sortedResultsMap: SortedResultsMap = {};
    // Object.entries(fullQuery.completedQuery.sortedResultsInfo).forEach(
    //   ([k, v]) =>
    //     (sortedResultsMap[k] = this.convertPathPropertiesToWebviewUris(
    //       panel,
    //       v,
    //     )),
    // );

    // this._displayedQuery = fullQuery;

    await this.waitForPanelLoaded();
    if (!panel.visible) {
      if (forceReveal === WebviewReveal.Forced) {
        panel.reveal(undefined, true);
      } else {
        // The results panel exists, (`.getPanel()` guarantees it) but
        // is not visible; it's in a not-currently-viewed tab. Show a
        // more asynchronous message to not so abruptly interrupt
        // user's workflow by immediately revealing the panel.
        const showButton = "View Performance Results";
        const queryName = this.labelProvider.getShortLabel(fullQuery);
        const resultPromise = vscode.window.showInformationMessage(
          `Performance results available for  ${
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

    // There are two main datasets -- the predicate profiles and the predicate amortization view.
    // In concept it shouldn't be possible for the eval log to be undefined but it is written that way
    // in the types so we accout for it here.
    if (fullQuery.jsonEvalLogSummaryLocation !== undefined) {
      // First the predicate profiles built with the default sorting and default amortization

      // construct the initial graph
      this.performanceGraph = PerformanceGraph.fromLogSummary(
        fullQuery.jsonEvalLogSummaryLocation,
      );

      // get the deepest root
      const deepestRoot = this.performanceGraph.getDeepestExecutionRoot();

      if (deepestRoot === undefined) {
        throw new Error("No root found in performance graph");
      }

      // filter it down so the graph only contains children of that root.
      this.performanceGraph.pruneToRoot(deepestRoot);

      // get the rows for the table
      const performanceEditorRows: PerformanceEditorRow[] =
        this.performanceGraph.buildPerformanceEditorRows();

      await this.postMessage({
        t: "setState",
        performanceEditorRows,
      });
    } else {
      this.warnNoEvalLogs();
    }
    // // Note that the resultSetSchemas will return offsets for the default (unsorted) page,
    // // which may not be correct. However, in this case, it doesn't matter since we only
    // // need the first offset, which will be the same no matter which sorting we use.
    // const resultSetSchemas = await this.getResultSetSchemas(
    //   fullQuery.completedQuery,
    // );
    // const resultSetNames = resultSetSchemas.map((schema) => schema.name);

    // const selectedTable = getDefaultResultSetName(resultSetNames);
    // const schema = resultSetSchemas.find(
    //   (resultSet) => resultSet.name === selectedTable,
    // )!;

    // // Use sorted results path if it exists. This may happen if we are
    // // reloading the results view after it has been sorted in the past.
    // const resultsPath = fullQuery.completedQuery.getResultsPath(selectedTable);
    // const pageSize = PAGE_SIZE.getValue<number>();
    // const chunk = await this.cliServer.bqrsDecode(resultsPath, schema.name, {
    //   // Always send the first page.
    //   // It may not wind up being the page we actually show,
    //   // if there are interpreted results, but speculatively
    //   // send anyway.
    //   offset: schema.pagination?.offsets[0],
    //   pageSize,
    // });
    // const resultSet = transformBqrsResultSet(schema, chunk);
    // fullQuery.completedQuery.setResultCount(
    //   interpretationPage?.numTotalResults || resultSet.schema.rows,
    // );
    // const parsedResultSets: ParsedResultSets = {
    //   pageNumber: 0,
    //   pageSize,
    //   numPages: numPagesOfResultSet(resultSet, this._interpretation),
    //   numInterpretedPages: numInterpretedPages(this._interpretation),
    //   resultSet: { ...resultSet, t: "RawResultSet" },
    //   selectedTable: undefined,
    //   resultSetNames,
    // };

    // await this.postMessage({
    //   t: "setState",
    //   interpretation: interpretationPage,
    //   origResultsPaths: fullQuery.completedQuery.query.resultsPaths,
    //   resultsPath: this.convertPathToWebviewUri(
    //     panel,
    //     fullQuery.completedQuery.query.resultsPaths.resultsPath,
    //   ),
    //   parsedResultSets,
    //   sortedResultsMap,
    //   database: fullQuery.initialInfo.databaseInfo,
    //   shouldKeepOldResultsWhileRendering,
    //   metadata: fullQuery.completedQuery.query.metadata,
    //   queryName: this.labelProvider.getLabel(fullQuery),
    //   queryPath: fullQuery.initialInfo.queryPath,
    // });
  }

  private warnNoEvalLogs() {
    void showAndLogWarningMessage(`Summary JSON log not available.`);
  }
}
