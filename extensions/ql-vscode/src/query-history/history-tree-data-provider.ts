import type { Event, ProviderResult, TreeDataProvider } from "vscode";
import { env, EventEmitter, ThemeColor, ThemeIcon, TreeItem } from "vscode";
import { DisposableObject } from "../common/disposable-object";
import { assertNever } from "../common/helpers-pure";
import type { QueryHistoryInfo } from "./query-history-info";
import { getLanguage } from "./query-history-info";
import { QueryStatus } from "./query-status";
import type { HistoryItemLabelProvider } from "./history-item-label-provider";
import type { LanguageContextStore } from "../language-context-store";

export enum SortOrder {
  NameAsc = "NameAsc",
  NameDesc = "NameDesc",
  DateAsc = "DateAsc",
  DateDesc = "DateDesc",
  CountAsc = "CountAsc",
  CountDesc = "CountDesc",
}

/**
 * Tree data provider for the query history view.
 */
export class HistoryTreeDataProvider
  extends DisposableObject
  implements TreeDataProvider<QueryHistoryInfo>
{
  private _sortOrder = SortOrder.DateAsc;

  private _onDidChangeTreeData = super.push(
    new EventEmitter<QueryHistoryInfo | undefined>(),
  );

  readonly onDidChangeTreeData: Event<QueryHistoryInfo | undefined> =
    this._onDidChangeTreeData.event;

  private _onDidChangeCurrentQueryItem = super.push(
    new EventEmitter<QueryHistoryInfo | undefined>(),
  );

  public readonly onDidChangeCurrentQueryItem =
    this._onDidChangeCurrentQueryItem.event;

  private history: QueryHistoryInfo[] = [];

  private current: QueryHistoryInfo | undefined;

  constructor(
    private readonly labelProvider: HistoryItemLabelProvider,
    private readonly languageContext: LanguageContextStore,
  ) {
    super();
  }

  async getTreeItem(element: QueryHistoryInfo): Promise<TreeItem> {
    const treeItem = new TreeItem(this.labelProvider.getLabel(element));

    treeItem.command = {
      title: "Query History Item",
      command: "codeQLQueryHistory.itemClicked",
      arguments: [element],
      tooltip: element.failureReason || this.labelProvider.getLabel(element),
    };

    // Populate the icon and the context value. We use the context value to
    // control which commands are visible in the context menu.
    treeItem.iconPath = this.getIconPath(element);
    treeItem.contextValue = await this.getContextValue(element);

    return treeItem;
  }

  private getIconPath(element: QueryHistoryInfo): ThemeIcon | string {
    switch (element.status) {
      case QueryStatus.InProgress:
        return new ThemeIcon("sync~spin");
      case QueryStatus.Completed:
        if (element.t === "local") {
          return new ThemeIcon("database");
        } else {
          return new ThemeIcon("cloud");
        }
      case QueryStatus.Failed:
        return new ThemeIcon("error", new ThemeColor("errorForeground"));
      default:
        assertNever(element.status);
    }
  }

  private async getContextValue(element: QueryHistoryInfo): Promise<string> {
    switch (element.status) {
      case QueryStatus.InProgress:
        if (element.t === "local") {
          return "inProgressResultsItem";
        } else if (
          element.t === "variant-analysis" &&
          element.variantAnalysis.actionsWorkflowRunId === undefined
        ) {
          return "pendingRemoteResultsItem";
        } else {
          return "inProgressRemoteResultsItem";
        }
      case QueryStatus.Completed:
        if (element.t === "local") {
          const hasResults =
            await element.completedQuery?.query.hasInterpretedResults();
          return hasResults ? "interpretedResultsItem" : "rawResultsItem";
        } else {
          return "remoteResultsItem";
        }
      case QueryStatus.Failed:
        if (element.t === "local") {
          return "cancelledResultsItem";
        } else if (element.variantAnalysis.actionsWorkflowRunId === undefined) {
          return "cancelledRemoteResultsItemWithoutLogs";
        } else {
          return "cancelledRemoteResultsItem";
        }

      default:
        assertNever(element.status);
    }
  }

  getChildren(element?: QueryHistoryInfo): ProviderResult<QueryHistoryInfo[]> {
    return element
      ? []
      : this.history
          .filter((h) => {
            return this.languageContext.shouldInclude(getLanguage(h));
          })
          .sort((h1, h2) => {
            const h1Label = this.labelProvider.getLabel(h1).toLowerCase();
            const h2Label = this.labelProvider.getLabel(h2).toLowerCase();

            const h1Date = this.getItemDate(h1);

            const h2Date = this.getItemDate(h2);

            const resultCount1 =
              h1.t === "local"
                ? h1.completedQuery?.resultCount ?? -1
                : h1.resultCount ?? -1;
            const resultCount2 =
              h2.t === "local"
                ? h2.completedQuery?.resultCount ?? -1
                : h2.resultCount ?? -1;

            switch (this.sortOrder) {
              case SortOrder.NameAsc:
                return h1Label.localeCompare(h2Label, env.language);

              case SortOrder.NameDesc:
                return h2Label.localeCompare(h1Label, env.language);

              case SortOrder.DateAsc:
                return h1Date - h2Date;

              case SortOrder.DateDesc:
                return h2Date - h1Date;

              case SortOrder.CountAsc:
                // If the result counts are equal, sort by name.
                return resultCount1 - resultCount2 === 0
                  ? h1Label.localeCompare(h2Label, env.language)
                  : resultCount1 - resultCount2;

              case SortOrder.CountDesc:
                // If the result counts are equal, sort by name.
                return resultCount2 - resultCount1 === 0
                  ? h2Label.localeCompare(h1Label, env.language)
                  : resultCount2 - resultCount1;
              default:
                assertNever(this.sortOrder);
            }
          });
  }

  getParent(_element: QueryHistoryInfo): ProviderResult<QueryHistoryInfo> {
    return null;
  }

  getCurrent(): QueryHistoryInfo | undefined {
    return this.current;
  }

  pushQuery(item: QueryHistoryInfo): void {
    this.history.push(item);
    this.setCurrentItem(item);
    this.refresh();
  }

  setCurrentItem(item?: QueryHistoryInfo) {
    if (item !== this.current) {
      this.current = item;
      this._onDidChangeCurrentQueryItem.fire(item);
    }
  }

  remove(item: QueryHistoryInfo) {
    const isCurrent = this.current === item;
    if (isCurrent) {
      this.setCurrentItem();
    }
    const index = this.history.findIndex((i) => i === item);
    if (index >= 0) {
      this.history.splice(index, 1);
      if (isCurrent && this.history.length > 0) {
        // Try to keep a current item, near the deleted item if there
        // are any available.
        this.setCurrentItem(
          this.history[Math.min(index, this.history.length - 1)],
        );
      }
      this.refresh();
    }
  }

  get allHistory(): QueryHistoryInfo[] {
    return this.history;
  }

  set allHistory(history: QueryHistoryInfo[]) {
    this.history = history;
    this.setCurrentItem(history[0]);
    this.refresh();
  }

  refresh() {
    this._onDidChangeTreeData.fire(undefined);
  }

  public get sortOrder() {
    return this._sortOrder;
  }

  public set sortOrder(newSortOrder: SortOrder) {
    this._sortOrder = newSortOrder;
    this._onDidChangeTreeData.fire(undefined);
  }

  private getItemDate(item: QueryHistoryInfo) {
    switch (item.t) {
      case "local":
        return item.initialInfo.start.getTime();
      case "variant-analysis":
        return item.variantAnalysis.executionStartTime;
      default:
        assertNever(item);
    }
  }
}
