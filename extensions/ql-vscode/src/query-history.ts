import * as path from 'path';
import * as vscode from 'vscode';
import { ExtensionContext, window as Window } from 'vscode';
import { CompletedQuery } from './query-results';
import { QueryHistoryConfig } from './config';
import { QueryWithResults } from './run-queries';
import * as helpers from './helpers';
import { logger } from './logging';
import { URLSearchParams } from 'url';

/**
 * query-history.ts
 * ------------
 * Managing state of previous queries that we've executed.
 *
 * The source of truth of the current state resides inside the
 * `TreeDataProvider` subclass below.
 */

export type QueryHistoryItemOptions = {
  label?: string; // user-settable label
  queryText?: string; // text of the selected file
  isQuickQuery?: boolean;
}

const SHOW_QUERY_TEXT_MSG = `\
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
 * Path to icon to display next to a failed query history item.
 */
const FAILED_QUERY_HISTORY_ITEM_ICON = 'media/red-x.svg';

/**
 * Tree data provider for the query history view.
 */
class HistoryTreeDataProvider implements vscode.TreeDataProvider<CompletedQuery> {

  /**
   * XXX: This idiom for how to get a `.fire()`-able event emitter was
   * cargo culted from another vscode extension. It seems rather
   * involved and I hope there's something better that can be done
   * instead.
   */
  private _onDidChangeTreeData: vscode.EventEmitter<CompletedQuery | undefined> = new vscode.EventEmitter<CompletedQuery | undefined>();
  readonly onDidChangeTreeData: vscode.Event<CompletedQuery | undefined> = this._onDidChangeTreeData.event;

  private history: CompletedQuery[] = [];

  /**
   * When not undefined, must be reference-equal to an item in `this.databases`.
   */
  private current: CompletedQuery | undefined;

  constructor(private ctx: ExtensionContext) {
  }

  async getTreeItem(element: CompletedQuery): Promise<vscode.TreeItem> {
    const it = new vscode.TreeItem(element.toString());

    it.command = {
      title: 'Query History Item',
      command: 'codeQLQueryHistory.itemClicked',
      arguments: [element],
    };

    // Mark this query history item according to whether it has a
    // SARIF file so that we can make context menu items conditionally
    // available.
    it.contextValue = await element.query.hasInterpretedResults() ? 'interpretedResultsItem' : 'rawResultsItem';

    if (!element.didRunSuccessfully) {
      it.iconPath = path.join(this.ctx.extensionPath, FAILED_QUERY_HISTORY_ITEM_ICON);
    }

    return it;
  }

  getChildren(element?: CompletedQuery): vscode.ProviderResult<CompletedQuery[]> {
    if (element == undefined) {
      return this.history;
    }
    else {
      return [];
    }
  }

  getParent(_element: CompletedQuery): vscode.ProviderResult<CompletedQuery> {
    return null;
  }

  getCurrent(): CompletedQuery | undefined {
    return this.current;
  }

  push(item: CompletedQuery): void {
    this.current = item;
    this.history.push(item);
    this.refresh();
  }

  setCurrentItem(item: CompletedQuery) {
    this.current = item;
  }

  remove(item: CompletedQuery) {
    if (this.current === item)
      this.current = undefined;
    const index = this.history.findIndex(i => i === item);
    if (index >= 0) {
      this.history.splice(index, 1);
      if (this.current === undefined && this.history.length > 0) {
        // Try to keep a current item, near the deleted item if there
        // are any available.
        this.current = this.history[Math.min(index, this.history.length - 1)];
      }
      this.refresh();
    }

  }

  get allHistory(): CompletedQuery[] {
    return this.history;
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  find(queryId: number): CompletedQuery | undefined {
    return this.allHistory.find(query => query.query.queryID === queryId);
  }
}

/**
 * Number of milliseconds two clicks have to arrive apart to be
 * considered a double-click.
 */
const DOUBLE_CLICK_TIME = 500;

export class QueryHistoryManager {
  treeDataProvider: HistoryTreeDataProvider;
  treeView: vscode.TreeView<CompletedQuery>;
  lastItemClick: { time: Date; item: CompletedQuery } | undefined;

  async invokeCallbackOn(queryHistoryItem: CompletedQuery) {
    if (this.selectedCallback !== undefined) {
      const sc = this.selectedCallback;
      await sc(queryHistoryItem);
    }
  }

  async handleOpenQuery(queryHistoryItem: CompletedQuery): Promise<void> {
    const textDocument = await vscode.workspace.openTextDocument(vscode.Uri.file(queryHistoryItem.query.program.queryPath));
    const editor = await vscode.window.showTextDocument(textDocument, vscode.ViewColumn.One);
    const queryText = queryHistoryItem.options.queryText;
    if (queryText !== undefined && queryHistoryItem.options.isQuickQuery) {
      await editor.edit(edit => edit.replace(textDocument.validateRange(
        new vscode.Range(0, 0, textDocument.lineCount, 0)), queryText)
      );
    }
  }

  async handleRemoveHistoryItem(queryHistoryItem: CompletedQuery) {
    this.treeDataProvider.remove(queryHistoryItem);
    queryHistoryItem.dispose();
    const current = this.treeDataProvider.getCurrent();
    if (current !== undefined) {
      this.treeView.reveal(current);
      await this.invokeCallbackOn(current);
    }
  }

  async handleSetLabel(queryHistoryItem: CompletedQuery) {
    const response = await vscode.window.showInputBox({
      prompt: 'Label:',
      placeHolder: '(use default)',
      value: queryHistoryItem.getLabel(),
    });
    // undefined response means the user cancelled the dialog; don't change anything
    if (response !== undefined) {
      if (response === '')
        // Interpret empty string response as "go back to using default"
        queryHistoryItem.options.label = undefined;
      else
        queryHistoryItem.options.label = response;
      this.treeDataProvider.refresh();
    }
  }

  async handleCompareWith(query: CompletedQuery) {
    const dbName = query.database.name;
    const comparableQueryLabels = this.treeDataProvider.allHistory
      .filter((otherQuery) => otherQuery !== query && otherQuery.didRunSuccessfully && otherQuery.database.name === dbName)
      .map(otherQuery => ({
        label: otherQuery.toString(),
        description: otherQuery.databaseName,
        detail: otherQuery.statusString,
        query: otherQuery
      }));
    const choice = await vscode.window.showQuickPick(comparableQueryLabels);
    if (choice) {
      this.doCompareCallback(query, choice.query);
    }
  }

  async handleItemClicked(queryHistoryItem: CompletedQuery) {
    this.treeDataProvider.setCurrentItem(queryHistoryItem);

    const now = new Date();
    const prevItemClick = this.lastItemClick;
    this.lastItemClick = { time: now, item: queryHistoryItem };

    if (prevItemClick !== undefined
      && (now.valueOf() - prevItemClick.time.valueOf()) < DOUBLE_CLICK_TIME
      && queryHistoryItem == prevItemClick.item) {
      // show original query file on double click
      await this.handleOpenQuery(queryHistoryItem);
    }
    else {
      // show results on single click
      await this.invokeCallbackOn(queryHistoryItem);
    }
  }

  async handleShowQueryLog(queryHistoryItem: CompletedQuery) {
    if (queryHistoryItem.logFileLocation) {
      await this.tryOpenExternalFile(queryHistoryItem.logFileLocation);
    } else {
      helpers.showAndLogWarningMessage('No log file available');
    }
  }

  async handleShowQueryText(queryHistoryItem: CompletedQuery) {
    try {
      const queryName = queryHistoryItem.queryName.endsWith('.ql') ? queryHistoryItem.queryName : queryHistoryItem.queryName + '.ql';
      const params = new URLSearchParams({
        isQuickEval: String(!!queryHistoryItem.query.quickEvalPosition),
        queryText: await this.getQueryText(queryHistoryItem)
      });
      const uri = vscode.Uri.parse(`codeql:${queryHistoryItem.query.queryID}-${queryName}?${params.toString()}`);
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: false });
    } catch (e) {
      helpers.showAndLogErrorMessage(e.message);
    }
  }

  async handleViewSarif(queryHistoryItem: CompletedQuery) {
    try {
      const hasInterpretedResults = await queryHistoryItem.query.canHaveInterpretedResults();
      if (hasInterpretedResults) {
        await this.tryOpenExternalFile(
          queryHistoryItem.query.resultsPaths.interpretedResultsPath
        );
      }
      else {
        const label = queryHistoryItem.getLabel();
        helpers.showAndLogInformationMessage(`Query ${label} has no interpreted results.`);
      }
    } catch (e) {
      helpers.showAndLogErrorMessage(e.message);
    }
  }

  async getQueryText(queryHistoryItem: CompletedQuery): Promise<string> {
    if (queryHistoryItem.options.queryText) {
      return queryHistoryItem.options.queryText;
    } else if (queryHistoryItem.query.quickEvalPosition) {
      // capture all selected lines
      const startLine = queryHistoryItem.query.quickEvalPosition.line;
      const endLine = queryHistoryItem.query.quickEvalPosition.endLine;
      const textDocument =
        await vscode.workspace.openTextDocument(queryHistoryItem.query.quickEvalPosition.fileName);
      return textDocument.getText(new vscode.Range(startLine - 1, 0, endLine, 0));
    } else {
      return '';
    }
  }

  constructor(
    ctx: ExtensionContext,
    private queryHistoryConfigListener: QueryHistoryConfig,
    private selectedCallback: (item: CompletedQuery) => Promise<void>,
    private doCompareCallback: (from: CompletedQuery, to: CompletedQuery) => Promise<void>,
  ) {
    const treeDataProvider = this.treeDataProvider = new HistoryTreeDataProvider(ctx);
    this.treeView = Window.createTreeView('codeQLQueryHistory', { treeDataProvider });
    // Lazily update the tree view selection due to limitations of TreeView API (see
    // `updateTreeViewSelectionIfVisible` doc for details)
    this.treeView.onDidChangeVisibility(async _ev => this.updateTreeViewSelectionIfVisible());
    // Don't allow the selection to become empty
    this.treeView.onDidChangeSelection(async ev => {
      if (ev.selection.length == 0) {
        this.updateTreeViewSelectionIfVisible();
      }
    });
    logger.log('Registering query history panel commands.');
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.openQuery', this.handleOpenQuery));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.removeHistoryItem', this.handleRemoveHistoryItem.bind(this)));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.setLabel', this.handleSetLabel.bind(this)));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.compareWith', this.handleCompareWith.bind(this)));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.showQueryLog', this.handleShowQueryLog.bind(this)));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.showQueryText', this.handleShowQueryText.bind(this)));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.viewSarif', this.handleViewSarif.bind(this)));
    ctx.subscriptions.push(vscode.commands.registerCommand('codeQLQueryHistory.itemClicked', async (item) => {
      return this.handleItemClicked(item);
    }));
    queryHistoryConfigListener.onDidChangeQueryHistoryConfiguration(() => {
      this.treeDataProvider.refresh();
    });

    // displays query text in a read-only document
    vscode.workspace.registerTextDocumentContentProvider('codeql', {
      provideTextDocumentContent(uri: vscode.Uri): vscode.ProviderResult<string> {
        const params = new URLSearchParams(uri.query);

        return (
          JSON.parse(params.get('isQuickEval') || '') ? SHOW_QUERY_TEXT_QUICK_EVAL_MSG : SHOW_QUERY_TEXT_MSG
        ) + params.get('queryText');
      }
    });
  }

  addQuery(info: QueryWithResults): CompletedQuery {
    const item = new CompletedQuery(info, this.queryHistoryConfigListener);
    this.treeDataProvider.push(item);
    this.updateTreeViewSelectionIfVisible();
    return item;
  }

  find(queryId: number): CompletedQuery | undefined {
    return this.treeDataProvider.find(queryId);
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
        this.treeView.reveal(current);
      }
    }
  }

  private async tryOpenExternalFile(fileLocation: string) {
    const uri = vscode.Uri.file(fileLocation);
    try {
      await vscode.window.showTextDocument(uri);
    } catch (e) {
      if (
        e.message.includes(
          'Files above 50MB cannot be synchronized with extensions'
        ) ||
        e.message.includes('too large to open')
      ) {
        const res = await helpers.showBinaryChoiceDialog(
          `VS Code does not allow extensions to open files >50MB. This file
exceeds that limit. Do you want to open it outside of VS Code?

You can also try manually opening it inside VS Code by selecting
the file in the file explorer and dragging it into the workspace.`
        );
        if (res) {
          try {
            await vscode.commands.executeCommand('revealFileInOS', uri);
          } catch (e) {
            helpers.showAndLogErrorMessage(e.message);
          }
        }
      } else {
        helpers.showAndLogErrorMessage(`Could not open file ${fileLocation}`);
        logger.log(e.message);
        logger.log(e.stack);
      }
    }
  }
}
