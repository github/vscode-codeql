import * as path from 'path';
import {
  commands,
  Disposable,
  env,
  Event,
  EventEmitter,
  ExtensionContext,
  ProviderResult,
  Range,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeView,
  Uri,
  ViewColumn,
  window,
  workspace,
} from 'vscode';
import { QueryHistoryConfig } from './config';
import {
  showAndLogErrorMessage,
  showAndLogInformationMessage,
  showAndLogWarningMessage,
  showBinaryChoiceDialog
} from './helpers';
import { logger } from './logging';
import { URLSearchParams } from 'url';
import { QueryServerClient } from './queryserver-client';
import { DisposableObject } from './pure/disposable-object';
import { commandRunner } from './commandRunner';
import { ONE_HOUR_IN_MS, TWO_HOURS_IN_MS } from './pure/time';
import { assertNever, getErrorMessage, getErrorStack } from './pure/helpers-pure';
import { CompletedLocalQueryInfo, LocalQueryInfo as LocalQueryInfo, QueryHistoryInfo } from './query-results';
import { DatabaseManager } from './databases';
import { registerQueryHistoryScubber } from './query-history-scrubber';
import { QueryStatus } from './query-status';
import { slurpQueryHistory, splatQueryHistory } from './query-serialization';
import * as fs from 'fs-extra';
import { CliVersionConstraint } from './cli';
import { HistoryItemLabelProvider } from './history-item-label-provider';
import { Credentials } from './authentication';
import { cancelRemoteQuery } from './remote-queries/gh-actions-api-client';
import { RemoteQueriesManager } from './remote-queries/remote-queries-manager';
import { RemoteQueryHistoryItem } from './remote-queries/remote-query-history-item';
import { InterfaceManager } from './interface';
import { WebviewReveal } from './interface-utils';
import { EvalLogViewer } from './eval-log-viewer';
import EvalLogTreeBuilder from './eval-log-tree-builder';
import { EvalLogData, parseViewerData } from './pure/log-summary-parser';

/**
 * query-history.ts
 * ------------
 * Managing state of previous queries that we've executed.
 *
 * The source of truth of the current state resides inside the
 * `TreeDataProvider` subclass below.
 */

export const SHOW_QUERY_TEXT_MSG = `\
////////////////////////////////////////////////////////////////////////////////////
// This is the text of the entire query file when it was executed for this query  //
// run. The text or dependent libraries may have changed since then.              //
//                                                                                //
// This buffer is readonly. To re-execute this query, you must open the original  //
// query file.                                                                    //
////////////////////////////////////////////////////////////////////////////////////

`;

const SHOW_QUERY_TEXT_QUICK_EVAL_MSG = `\
////////////////////////////////////////////////////////////////////////////////////
// This is the Quick Eval selection of the query file when it was executed for    //
// this query run. The text or dependent libraries may have changed since then.   //
//                                                                                //
// This buffer is readonly. To re-execute this query, you must open the original  //
// query file.                                                                    //
////////////////////////////////////////////////////////////////////////////////////

`;

/**
 * Number of milliseconds two clicks have to arrive apart to be
 * considered a double-click.
 */
const DOUBLE_CLICK_TIME = 500;

const WORKSPACE_QUERY_HISTORY_FILE = 'workspace-query-history.json';

export class QueryHistoryManager extends DisposableObject {
  lastItemClick: { time: Date; item: QueryHistoryInfo } | undefined;
  compareWithItem: LocalQueryInfo | undefined;
  queryHistoryScrubber: Disposable | undefined;
  private queryMetadataStorageLocation;

  constructor(
    private readonly qs: QueryServerClient,
    private readonly dbm: DatabaseManager,
    private readonly localQueriesInterfaceManager: InterfaceManager,
    private readonly remoteQueriesManager: RemoteQueriesManager,
    private readonly evalLogViewer: EvalLogViewer,
    private readonly queryStorageDir: string,
    private readonly ctx: ExtensionContext,
    private readonly queryHistoryConfigListener: QueryHistoryConfig,
    private readonly labelProvider: HistoryItemLabelProvider,
    private readonly doCompareCallback: (
      from: CompletedLocalQueryInfo,
      to: CompletedLocalQueryInfo
    ) => Promise<void>
  ) {
    super();

    // Note that we use workspace storage to hold the metadata for the query history.
    // This is because the query history is specific to each workspace.
    // For situations where `ctx.storageUri` is undefined (i.e., there is no workspace),
    // we default to global storage.
    this.queryMetadataStorageLocation = path.join((ctx.storageUri || ctx.globalStorageUri).fsPath, WORKSPACE_QUERY_HISTORY_FILE);

    void logger.log('Registering query history panel commands.');
    this.push(
      commandRunner(
        'codeQLQueryHistory.openQuery',
        this.handleOpenQuery.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.removeHistoryItem',
        this.handleRemoveHistoryItem.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.sortByName',
        this.handleSortByName.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.sortByDate',
        this.handleSortByDate.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.sortByCount',
        this.handleSortByCount.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.setLabel',
        this.handleSetLabel.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.compareWith',
        this.handleCompareWith.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.showQueryLog',
        this.handleShowQueryLog.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.openQueryDirectory',
        this.handleOpenQueryDirectory.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.showEvalLog',
        this.handleShowEvalLog.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.showEvalLogSummary',
        this.handleShowEvalLogSummary.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.showEvalLogViewer',
        this.handleShowEvalLogViewer.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.cancel',
        this.handleCancel.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.showQueryText',
        this.handleShowQueryText.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.exportResults',
        this.handleExportResults.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.viewCsvResults',
        this.handleViewCsvResults.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.viewCsvAlerts',
        this.handleViewCsvAlerts.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.viewSarifAlerts',
        this.handleViewSarifAlerts.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.viewDil',
        this.handleViewDil.bind(this)
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.itemClicked',
        async (item: LocalQueryInfo) => {
          return this.handleItemClicked(item, [item]);
        }
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.openOnGithub',
        async (item: LocalQueryInfo) => {
          return this.handleOpenOnGithub(item, [item]);
        }
      )
    );
    this.push(
      commandRunner(
        'codeQLQueryHistory.copyRepoList',
        this.handleCopyRepoList.bind(this)
      )
    );

    // There are two configuration items that affect the query history:
    // 1. The ttl for query history items.
    // 2. The default label for query history items.
    // When either of these change, must refresh the tree view.
    this.push(
      queryHistoryConfigListener.onDidChangeConfiguration(() => {
        this.treeDataProvider.refresh();
        this.registerQueryHistoryScrubber(queryHistoryConfigListener, this, ctx);
      })
    );

    // displays query text in a read-only document
    this.push(workspace.registerTextDocumentContentProvider('codeql', {
      provideTextDocumentContent(
        uri: Uri
      ): ProviderResult<string> {
        const params = new URLSearchParams(uri.query);

        return (
          (JSON.parse(params.get('isQuickEval') || '')
            ? SHOW_QUERY_TEXT_QUICK_EVAL_MSG
            : SHOW_QUERY_TEXT_MSG) + params.get('queryText')
        );
      },
    }));

    this.registerQueryHistoryScrubber(queryHistoryConfigListener, this, ctx);
    this.registerToRemoteQueriesEvents();
  }

  private getCredentials() {
    return Credentials.initialize(this.ctx);
  }

  /**
   * Register and create the history scrubber.
   */
  private registerQueryHistoryScrubber(queryHistoryConfigListener: QueryHistoryConfig, qhm: QueryHistoryManager, ctx: ExtensionContext) {
    this.queryHistoryScrubber?.dispose();
    // Every hour check if we need to re-run the query history scrubber.
    this.queryHistoryScrubber = this.push(
      registerQueryHistoryScubber(
        ONE_HOUR_IN_MS,
        TWO_HOURS_IN_MS,
        queryHistoryConfigListener.ttlInMillis,
        this.queryStorageDir,
        qhm,
        ctx
      )
    );
  }

  private registerToRemoteQueriesEvents() {
    const queryAddedSubscription = this.remoteQueriesManager.onRemoteQueryAdded(async (event) => {
      this.addQuery({
        t: 'remote',
        status: QueryStatus.InProgress,
        completed: false,
        queryId: event.queryId,
        remoteQuery: event.query,
      });

      await this.refreshTreeView();
    });

    const queryRemovedSubscription = this.remoteQueriesManager.onRemoteQueryRemoved(async (event) => {
      const item = this.treeDataProvider.allHistory.find(i => i.t === 'remote' && i.queryId === event.queryId);
      if (item) {
        await this.removeRemoteQuery(item as RemoteQueryHistoryItem);
      }
    });

    const queryStatusUpdateSubscription = this.remoteQueriesManager.onRemoteQueryStatusUpdate(async (event) => {
      const item = this.treeDataProvider.allHistory.find(i => i.t === 'remote' && i.queryId === event.queryId);
      if (item) {
        const remoteQueryHistoryItem = item as RemoteQueryHistoryItem;
        remoteQueryHistoryItem.status = event.status;
        remoteQueryHistoryItem.failureReason = event.failureReason;
        remoteQueryHistoryItem.resultCount = event.resultCount;
        if (event.status === QueryStatus.Completed) {
          remoteQueryHistoryItem.completed = true;
        }
        await this.refreshTreeView();
      } else {
        void logger.log('Variant analysis status update event received for unknown variant analysis');
      }
    });

    this.push(queryAddedSubscription);
    this.push(queryRemovedSubscription);
    this.push(queryStatusUpdateSubscription);
  }

  async readQueryHistory(): Promise<void> {
    void logger.log(`Reading cached query history from '${this.queryMetadataStorageLocation}'.`);
    const history = await slurpQueryHistory(this.queryMetadataStorageLocation);
    this.treeDataProvider.allHistory = history;
    this.treeDataProvider.allHistory.forEach(async (item) => {
      if (item.t === 'remote') {
        await this.remoteQueriesManager.rehydrateRemoteQuery(item.queryId, item.remoteQuery, item.status);
      }
    });
  }

  async writeQueryHistory(): Promise<void> {
    await splatQueryHistory(this.treeDataProvider.allHistory, this.queryMetadataStorageLocation);
  }

  async handleOpenQuery(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ): Promise<void> {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem) {
      return;
    }

    const queryPath = finalSingleItem.t === 'local'
      ? finalSingleItem.initialInfo.queryPath
      : finalSingleItem.remoteQuery.queryFilePath;

    const textDocument = await workspace.openTextDocument(
      Uri.file(queryPath)
    );
    const editor = await window.showTextDocument(
      textDocument,
      ViewColumn.One
    );

    if (finalSingleItem.t === 'local') {
      const queryText = finalSingleItem.initialInfo.queryText;
      if (queryText !== undefined && finalSingleItem.initialInfo.isQuickQuery) {
        await editor.edit((edit) =>
          edit.replace(
            textDocument.validateRange(
              new Range(0, 0, textDocument.lineCount, 0)
            ),
            queryText
          )
        );
      }
    }
  }

  getCurrentQueryHistoryItem(): QueryHistoryInfo | undefined {
    return this.treeDataProvider.getCurrent();
  }

  async removeDeletedQueries() {
    await Promise.all(this.treeDataProvider.allHistory.map(async (item) => {
      if (item.t == 'local' && item.completedQuery && !(await fs.pathExists(item.completedQuery?.query.querySaveDir))) {
        this.treeDataProvider.remove(item);
        item.completedQuery?.dispose();
      }
    }));
  }

  async handleRemoveHistoryItem(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] = []
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);
    const toDelete = (finalMultiSelect || [finalSingleItem]);
    await Promise.all(toDelete.map(async (item) => {
      if (item.t === 'local') {
        // Removing in progress local queries is not supported. They must be cancelled first.
        if (item.status !== QueryStatus.InProgress) {
          this.treeDataProvider.remove(item);
          item.completedQuery?.dispose();

          // User has explicitly asked for this query to be removed.
          // We need to delete it from disk as well.
          await item.completedQuery?.query.deleteQuery();
        }
      } else {
        await this.removeRemoteQuery(item);
      }
    }));

    await this.writeQueryHistory();
    const current = this.treeDataProvider.getCurrent();
    if (current !== undefined) {
      await this.treeView.reveal(current, { select: true });
      await this.openQueryResults(current);
    }
  }

  private async removeRemoteQuery(item: RemoteQueryHistoryItem): Promise<void> {
    // Remote queries can be removed locally, but not remotely.
    // The user must cancel the query on GitHub Actions explicitly.
    this.treeDataProvider.remove(item);
    void logger.log(`Deleted ${this.labelProvider.getLabel(item)}.`);
    if (item.status === QueryStatus.InProgress) {
      void logger.log('The variant analysis is still running on GitHub Actions. To cancel there, you must go to the workflow run in your browser.');
    }

    await this.remoteQueriesManager.removeRemoteQuery(item.queryId);
  }

  async handleSortByName() {
    if (this.treeDataProvider.sortOrder === SortOrder.NameAsc) {
      this.treeDataProvider.sortOrder = SortOrder.NameDesc;
    } else {
      this.treeDataProvider.sortOrder = SortOrder.NameAsc;
    }
  }

  async handleSortByDate() {
    if (this.treeDataProvider.sortOrder === SortOrder.DateAsc) {
      this.treeDataProvider.sortOrder = SortOrder.DateDesc;
    } else {
      this.treeDataProvider.sortOrder = SortOrder.DateAsc;
    }
  }

  async handleSortByCount() {
    if (this.treeDataProvider.sortOrder === SortOrder.CountAsc) {
      this.treeDataProvider.sortOrder = SortOrder.CountDesc;
    } else {
      this.treeDataProvider.sortOrder = SortOrder.CountAsc;
    }
  }

  async handleSetLabel(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ): Promise<void> {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    if (!this.assertSingleQuery(finalMultiSelect)) {
      return;
    }

    const response = await window.showInputBox({
      placeHolder: `(use default: ${this.queryHistoryConfigListener.format})`,
      value: finalSingleItem.userSpecifiedLabel ?? '',
      title: 'Set query label',
      prompt: 'Set the query history item label. See the description of the codeQL.queryHistory.format setting for more information.',
    });
    // undefined response means the user cancelled the dialog; don't change anything
    if (response !== undefined) {
      // Interpret empty string response as 'go back to using default'
      finalSingleItem.userSpecifiedLabel = response === '' ? undefined : response;
      await this.refreshTreeView();
    }
  }

  async handleCompareWith(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    try {
      // local queries only
      if (finalSingleItem?.t !== 'local') {
        throw new Error('Please select a local query.');
      }

      if (!finalSingleItem.completedQuery?.didRunSuccessfully) {
        throw new Error('Please select a query that has completed successfully.');
      }

      const from = this.compareWithItem || singleItem;
      const to = await this.findOtherQueryToCompare(from, finalMultiSelect);

      if (from.completed && to?.completed) {
        await this.doCompareCallback(from as CompletedLocalQueryInfo, to as CompletedLocalQueryInfo);
      }
    } catch (e) {
      void showAndLogErrorMessage(getErrorMessage(e));
    }
  }

  async handleItemClicked(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] = []
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem) {
      return;
    }

    this.treeDataProvider.setCurrentItem(finalSingleItem);

    const now = new Date();
    const prevItemClick = this.lastItemClick;
    this.lastItemClick = { time: now, item: finalSingleItem };

    if (
      prevItemClick !== undefined &&
      now.valueOf() - prevItemClick.time.valueOf() < DOUBLE_CLICK_TIME &&
      finalSingleItem == prevItemClick.item
    ) {
      // show original query file on double click
      await this.handleOpenQuery(finalSingleItem, [finalSingleItem]);
    } else {
      // show results on single click only if query is completed successfully.
      if (finalSingleItem.status === QueryStatus.Completed) {
        await this.openQueryResults(finalSingleItem);
      }
    }
  }

  async handleShowQueryLog(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    // Local queries only
    if (!this.assertSingleQuery(multiSelect) || singleItem?.t !== 'local') {
      return;
    }

    if (!singleItem.completedQuery) {
      return;
    }

    if (singleItem.completedQuery.logFileLocation) {
      await this.tryOpenExternalFile(singleItem.completedQuery.logFileLocation);
    } else {
      void showAndLogWarningMessage('No log file available');
    }
  }

  async getQueryHistoryItemDirectory(queryHistoryItem: QueryHistoryInfo): Promise<string> {
    if (queryHistoryItem.t === 'local') {
      if (queryHistoryItem.completedQuery) {
        return queryHistoryItem.completedQuery.query.querySaveDir;
      }
    } else if (queryHistoryItem.t === 'remote') {
      return path.join(this.queryStorageDir, queryHistoryItem.queryId);
    }

    throw new Error('Unable to get query directory');
  }

  async handleOpenQueryDirectory(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem) {
      return;
    }

    let externalFilePath: string | undefined;
    if (finalSingleItem.t === 'local') {
      if (finalSingleItem.completedQuery) {
        externalFilePath = path.join(finalSingleItem.completedQuery.query.querySaveDir, 'timestamp');
      }
    } else if (finalSingleItem.t === 'remote') {
      externalFilePath = path.join(this.queryStorageDir, finalSingleItem.queryId, 'timestamp');
    }

    if (externalFilePath) {
      if (!(await fs.pathExists(externalFilePath))) {
        // timestamp file is missing (manually deleted?) try selecting the parent folder.
        // It's less nice, but at least it will work.
        externalFilePath = path.dirname(externalFilePath);
        if (!(await fs.pathExists(externalFilePath))) {
          throw new Error(`Query directory does not exist: ${externalFilePath}`);
        }
      }
      try {
        await commands.executeCommand('revealFileInOS', Uri.file(externalFilePath));
      } catch (e) {
        throw new Error(`Failed to open ${externalFilePath}: ${getErrorMessage(e)}`);
      }
    }
  }

  private warnNoEvalLogs() {
    void showAndLogWarningMessage(`Evaluator log, summary, and viewer are not available for this run. Perhaps it failed before evaluation, or you are running with a version of CodeQL before ' + ${CliVersionConstraint.CLI_VERSION_WITH_PER_QUERY_EVAL_LOG}?`);
  }

  private warnInProgressEvalLogSummary() {
    void showAndLogWarningMessage('The evaluator log summary is still being generated for this run. Please try again later. The summary generation process is tracked in the "CodeQL Extension Log" view.');
  }

  private warnInProgressEvalLogViewer() {
    void showAndLogWarningMessage('The viewer\'s data is still being generated for this run. Please try again or re-run the query.');
  }

  async handleShowEvalLog(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    // Only applicable to an individual local query
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem || finalSingleItem.t !== 'local') {
      return;
    }

    if (finalSingleItem.evalLogLocation) {
      await this.tryOpenExternalFile(finalSingleItem.evalLogLocation);
    } else {
      this.warnNoEvalLogs();
    }
  }

  async handleShowEvalLogSummary(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    // Only applicable to an individual local query
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem || finalSingleItem.t !== 'local') {
      return;
    }

    if (finalSingleItem.evalLogSummaryLocation) {
      await this.tryOpenExternalFile(finalSingleItem.evalLogSummaryLocation);
      return;
    }

    // Summary log file doesn't exist.
    if (finalSingleItem.evalLogLocation && fs.pathExists(finalSingleItem.evalLogLocation)) {
      // If raw log does exist, then the summary log is still being generated.
      this.warnInProgressEvalLogSummary();
    } else {
      this.warnNoEvalLogs();
    }
  }

  async handleShowEvalLogViewer(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[],
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);
    // Only applicable to an individual local query
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem || finalSingleItem.t !== 'local') {
      return;
    }

    // If the JSON summary file location wasn't saved, display error
    if (finalSingleItem.jsonEvalLogSummaryLocation == undefined) {
      this.warnInProgressEvalLogViewer();
      return;
    }

    // TODO(angelapwen): Stream the file in.
    void fs.readFile(finalSingleItem.jsonEvalLogSummaryLocation, async (err, buffer) => {
      if (err) {
        throw new Error(`Could not read evaluator log summary JSON file to generate viewer data at ${finalSingleItem.jsonEvalLogSummaryLocation}.`);
      }
      const evalLogData: EvalLogData[] = parseViewerData(buffer.toString());
      const evalLogTreeBuilder = new EvalLogTreeBuilder(finalSingleItem.getQueryName(), evalLogData);
      this.evalLogViewer.updateRoots(await evalLogTreeBuilder.getRoots());
    });
  }

  async handleCancel(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    const selected = finalMultiSelect || [finalSingleItem];
    const results = selected.map(async item => {
      if (item.status === QueryStatus.InProgress) {
        if (item.t === 'local') {
          item.cancel();
        } else if (item.t === 'remote') {
          void showAndLogInformationMessage('Cancelling variant analysis. This may take a while.');
          const credentials = await this.getCredentials();
          await cancelRemoteQuery(credentials, item.remoteQuery);
        }
      }
    });

    await Promise.all(results);
  }

  async handleShowQueryText(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[] = []
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem) {
      return;
    }

    const params = new URLSearchParams({
      isQuickEval: String(!!(finalSingleItem.t === 'local' && finalSingleItem.initialInfo.quickEvalPosition)),
      queryText: encodeURIComponent(await this.getQueryText(finalSingleItem)),
    });
    const queryId = finalSingleItem.t === 'local'
      ? finalSingleItem.initialInfo.id
      : finalSingleItem.queryId;

    const uri = Uri.parse(
      `codeql:${queryId}?${params.toString()}`, true
    );
    const doc = await workspace.openTextDocument(uri);
    await window.showTextDocument(doc, { preview: false });
  }

  async handleViewSarifAlerts(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    // Local queries only
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem || finalSingleItem.t !== 'local' || !finalSingleItem.completedQuery) {
      return;
    }

    const query = finalSingleItem.completedQuery.query;
    const hasInterpretedResults = query.canHaveInterpretedResults();
    if (hasInterpretedResults) {
      await this.tryOpenExternalFile(
        query.resultsPaths.interpretedResultsPath
      );
    } else {
      const label = this.labelProvider.getLabel(finalSingleItem);
      void showAndLogInformationMessage(
        `Query ${label} has no interpreted results.`
      );
    }
  }

  async handleViewCsvResults(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    // Local queries only
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem || finalSingleItem.t !== 'local' || !finalSingleItem.completedQuery) {
      return;
    }
    const query = finalSingleItem.completedQuery.query;
    if (await query.hasCsv()) {
      void this.tryOpenExternalFile(query.csvPath);
      return;
    }
    if (await query.exportCsvResults(this.qs, query.csvPath)) {
      void this.tryOpenExternalFile(
        query.csvPath
      );
    }
  }

  async handleViewCsvAlerts(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    // Local queries only
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem || finalSingleItem.t !== 'local' || !finalSingleItem.completedQuery) {
      return;
    }

    await this.tryOpenExternalFile(
      await finalSingleItem.completedQuery.query.ensureCsvAlerts(this.qs, this.dbm)
    );
  }

  async handleViewDil(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[],
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    // Local queries only
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem || finalSingleItem.t !== 'local' || !finalSingleItem.completedQuery) {
      return;
    }

    await this.tryOpenExternalFile(
      await finalSingleItem.completedQuery.query.ensureDilPath(this.qs)
    );
  }

  async handleOpenOnGithub(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[],
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    // Remote queries only
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem || finalSingleItem.t !== 'remote') {
      return;
    }

    const { actionsWorkflowRunId: workflowRunId, controllerRepository: { owner, name } } = finalSingleItem.remoteQuery;

    await commands.executeCommand(
      'vscode.open',
      Uri.parse(`https://github.com/${owner}/${name}/actions/runs/${workflowRunId}`)
    );
  }

  async handleCopyRepoList(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[],
  ) {
    const { finalSingleItem, finalMultiSelect } = this.determineSelection(singleItem, multiSelect);

    // Remote queries only
    if (!this.assertSingleQuery(finalMultiSelect) || !finalSingleItem || finalSingleItem.t !== 'remote') {
      return;
    }

    await commands.executeCommand('codeQL.copyRepoList', finalSingleItem.queryId);
  }

  async getQueryText(item: QueryHistoryInfo): Promise<string> {
    return item.t === 'local'
      ? item.initialInfo.queryText
      : item.remoteQuery.queryText;
  }

  async handleExportResults(): Promise<void> {
    await commands.executeCommand('codeQL.exportVariantAnalysisResults');
  }

  addQuery(item: QueryHistoryInfo) {
    this.treeDataProvider.pushQuery(item);
    this.updateTreeViewSelectionIfVisible();
  }

  /**
   * Update the tree view selection if the tree view is visible.
   *
   * If the tree view is not visible, we must wait until it becomes visible before updating the
   * selection. This is because the only mechanism for updating the selection of the tree view
   * has the side-effect of revealing the tree view. This changes the active sidebar to CodeQL,
   * interrupting user workflows such as writing a commit message on the source control sidebar.
   */
  private updateTreeViewSelectionIfVisible() {
    if (this.treeView.visible) {
      const current = this.treeDataProvider.getCurrent();
      if (current != undefined) {
        // We must fire the onDidChangeTreeData event to ensure the current element can be selected
        // using `reveal` if the tree view was not visible when the current element was added.
        this.treeDataProvider.refresh();
        void this.treeView.reveal(current, { select: true });
      }
    }
  }

  private async tryOpenExternalFile(fileLocation: string) {
    const uri = Uri.file(fileLocation);
    try {
      await window.showTextDocument(uri, { preview: false });
    } catch (e) {
      const msg = getErrorMessage(e);
      if (
        msg.includes(
          'Files above 50MB cannot be synchronized with extensions'
        ) ||
        msg.includes('too large to open')
      ) {
        const res = await showBinaryChoiceDialog(
          `VS Code does not allow extensions to open files >50MB. This file
exceeds that limit. Do you want to open it outside of VS Code?

You can also try manually opening it inside VS Code by selecting
the file in the file explorer and dragging it into the workspace.`
        );
        if (res) {
          try {
            await commands.executeCommand('revealFileInOS', uri);
          } catch (e) {
            void showAndLogErrorMessage(getErrorMessage(e));
          }
        }
      } else {
        void showAndLogErrorMessage(`Could not open file ${fileLocation}`);
        void logger.log(getErrorMessage(e));
        void logger.log(getErrorStack(e));
      }
    }
  }

  private async findOtherQueryToCompare(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ): Promise<CompletedLocalQueryInfo | undefined> {

    // Remote queries cannot be compared
    if (singleItem.t !== 'local' || multiSelect.some(s => s.t !== 'local') || !singleItem.completedQuery) {
      return undefined;
    }
    const dbName = singleItem.initialInfo.databaseInfo.name;

    // if exactly 2 queries are selected, use those
    if (multiSelect?.length === 2) {
      // return the query that is not the first selected one
      const otherQuery =
        (singleItem === multiSelect[0] ? multiSelect[1] : multiSelect[0]) as LocalQueryInfo;
      if (!otherQuery.completedQuery) {
        throw new Error('Please select a completed query.');
      }
      if (!otherQuery.completedQuery.didRunSuccessfully) {
        throw new Error('Please select a successful query.');
      }
      if (otherQuery.initialInfo.databaseInfo.name !== dbName) {
        throw new Error('Query databases must be the same.');
      }
      return otherQuery as CompletedLocalQueryInfo;
    }

    if (multiSelect?.length > 2) {
      throw new Error('Please select no more than 2 queries.');
    }

    // otherwise, let the user choose
    const comparableQueryLabels = this.treeDataProvider.allHistory
      .filter(
        (otherQuery) =>
          otherQuery !== singleItem &&
          otherQuery.t === 'local' &&
          otherQuery.completedQuery &&
          otherQuery.completedQuery.didRunSuccessfully &&
          otherQuery.initialInfo.databaseInfo.name === dbName
      )
      .map((item) => ({
        label: this.labelProvider.getLabel(item),
        description: (item as CompletedLocalQueryInfo).initialInfo.databaseInfo.name,
        detail: (item as CompletedLocalQueryInfo).completedQuery.statusString,
        query: item as CompletedLocalQueryInfo,
      }));
    if (comparableQueryLabels.length < 1) {
      throw new Error('No other queries available to compare with.');
    }
    const choice = await window.showQuickPick(comparableQueryLabels);
    return choice?.query;
  }

  private assertSingleQuery(multiSelect: QueryHistoryInfo[] = [], message = 'Please select a single query.') {
    if (multiSelect.length > 1) {
      void showAndLogErrorMessage(
        message
      );
      return false;
    }
    return true;
  }

  /**
   * Updates the compare with source query. This ensures that all compare command invocations
   * when exactly 2 queries are selected always have the proper _from_ query. Always use
   * compareWithItem as the _from_ query.
   *
   * The heuristic is this:
   *
   * 1. If selection is empty or has length > 2 delete compareWithItem.
   * 2. If selection is length 1, then set that item to compareWithItem.
   * 3. If selection is length 2, then make sure compareWithItem is one of the selected items
   *    if not, then delete compareWithItem. If it is then, do nothing.
   *
   * This ensures that compareWithItem is always the first item selected if there are only
   * two selected items.
   *
   * @param newSelection the new selection after the most recent selection change
   */
  private updateCompareWith(newSelection: LocalQueryInfo[]) {
    if (newSelection.length === 1) {
      this.compareWithItem = newSelection[0];
    } else if (
      newSelection.length !== 2 ||
      !this.compareWithItem ||
      !newSelection.includes(this.compareWithItem)
    ) {
      this.compareWithItem = undefined;
    }
  }

  /**
   * If no items are selected, attempt to grab the selection from the treeview.
   * However, often the treeview itself does not have any selection. In this case,
   * grab the selection from the `treeDataProvider` current item.
   *
   * We need to use this method because when clicking on commands from the view title
   * bar, the selections are not passed in.
   *
   * @param singleItem the single item selected, or undefined if no item is selected
   * @param multiSelect a multi-select or undefined if no items are selected
   */
  private determineSelection(
    singleItem: QueryHistoryInfo,
    multiSelect: QueryHistoryInfo[]
  ): {
    finalSingleItem: QueryHistoryInfo;
    finalMultiSelect: QueryHistoryInfo[]
  } {
    if (!singleItem && !multiSelect?.[0]) {
      const selection = this.treeView.selection;
      const current = this.treeDataProvider.getCurrent();
      if (selection?.length) {
        return {
          finalSingleItem: selection[0],
          finalMultiSelect: [...selection]
        };
      } else if (current) {
        return {
          finalSingleItem: current,
          finalMultiSelect: [current]
        };
      }
    }

    // ensure we only return undefined if we have neither a single or multi-selecion
    if (singleItem && !multiSelect?.[0]) {
      multiSelect = [singleItem];
    } else if (!singleItem && multiSelect?.[0]) {
      singleItem = multiSelect[0];
    }
    return {
      finalSingleItem: singleItem,
      finalMultiSelect: multiSelect
    };
  }

  async refreshTreeView(): Promise<void> {
    this.treeDataProvider.refresh();
    await this.writeQueryHistory();
  }

  private async openQueryResults(item: QueryHistoryInfo) {
    if (item.t === 'local') {
      await this.localQueriesInterfaceManager.showResults(item as CompletedLocalQueryInfo, WebviewReveal.Forced, false);
    }
    else if (item.t === 'remote') {
      await this.remoteQueriesManager.openRemoteQueryResults(item.queryId);
    }
  }
}
