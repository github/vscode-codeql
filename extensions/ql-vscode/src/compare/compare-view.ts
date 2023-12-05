import { ViewColumn } from "vscode";

import {
  FromCompareViewMessage,
  QueryCompareResult,
  ToCompareViewMessage,
} from "../common/interface-types";
import { Logger, showAndLogExceptionWithTelemetry } from "../common/logging";
import { extLogger } from "../common/logging/vscode";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { DatabaseManager } from "../databases/local-databases";
import { jumpToLocation } from "../databases/local-databases/locations";
import { BQRSInfo, DecodedBqrsChunk } from "../common/bqrs-cli-types";
import resultsDiff from "./resultsDiff";
import { CompletedLocalQueryInfo } from "../query-results";
import { assertNever, getErrorMessage } from "../common/helpers-pure";
import { HistoryItemLabelProvider } from "../query-history/history-item-label-provider";
import {
  AbstractWebview,
  WebviewPanelConfig,
} from "../common/vscode/abstract-webview";
import { telemetryListener } from "../common/vscode/telemetry";
import { redactableError } from "../common/errors";
import { App } from "../common/app";
import { findResultSetNames } from "./result-set-names";

interface ComparePair {
  from: CompletedLocalQueryInfo;
  fromSchemas: BQRSInfo;
  to: CompletedLocalQueryInfo;
  toSchemas: BQRSInfo;
}

export class CompareView extends AbstractWebview<
  ToCompareViewMessage,
  FromCompareViewMessage
> {
  private comparePair: ComparePair | undefined;

  constructor(
    app: App,
    private databaseManager: DatabaseManager,
    private cliServer: CodeQLCliServer,
    private logger: Logger,
    private labelProvider: HistoryItemLabelProvider,
    private showQueryResultsCallback: (
      item: CompletedLocalQueryInfo,
    ) => Promise<void>,
  ) {
    super(app);
  }

  async showResults(
    from: CompletedLocalQueryInfo,
    to: CompletedLocalQueryInfo,
    selectedResultSetName?: string,
  ) {
    const fromSchemas = await this.cliServer.bqrsInfo(
      from.completedQuery.query.resultsPaths.resultsPath,
    );
    const toSchemas = await this.cliServer.bqrsInfo(
      to.completedQuery.query.resultsPaths.resultsPath,
    );

    this.comparePair = {
      from,
      fromSchemas,
      to,
      toSchemas,
    };

    await this.showResultsInternal(selectedResultSetName);
  }

  private async showResultsInternal(selectedResultSetName?: string) {
    if (!this.comparePair) {
      return;
    }

    const { from, to } = this.comparePair;

    const panel = await this.getPanel();
    panel.reveal(undefined, true);

    await this.waitForPanelLoaded();
    const {
      commonResultSetNames,
      currentResultSetDisplayName,
      fromResultSet,
      toResultSet,
    } = await this.findCommonResultSetNames(
      this.comparePair,
      selectedResultSetName,
    );
    if (currentResultSetDisplayName) {
      let rows: QueryCompareResult | undefined;
      let message: string | undefined;
      try {
        rows = this.compareResults(fromResultSet, toResultSet);
      } catch (e) {
        message = getErrorMessage(e);
      }

      await this.postMessage({
        t: "setComparisons",
        stats: {
          fromQuery: {
            // since we split the description into several rows
            // only run interpolation if the label is user-defined
            // otherwise we will wind up with duplicated rows
            name: this.labelProvider.getShortLabel(from),
            status: from.completedQuery.statusString,
            time: from.startTime,
          },
          toQuery: {
            name: this.labelProvider.getShortLabel(to),
            status: to.completedQuery.statusString,
            time: to.startTime,
          },
        },
        columns: fromResultSet.columns,
        commonResultSetNames,
        currentResultSetName: currentResultSetDisplayName,
        rows,
        message,
        databaseUri: to.initialInfo.databaseInfo.databaseUri,
      });
    }
  }

  protected getPanelConfig(): WebviewPanelConfig {
    return {
      viewId: "compareView",
      title: "Compare CodeQL Query Results",
      viewColumn: ViewColumn.Active,
      preserveFocus: true,
      view: "compare",
    };
  }

  protected onPanelDispose(): void {
    this.comparePair = undefined;
  }

  protected async onMessage(msg: FromCompareViewMessage): Promise<void> {
    switch (msg.t) {
      case "viewLoaded":
        this.onWebViewLoaded();
        break;

      case "changeCompare":
        await this.changeTable(msg.newResultSetName);
        telemetryListener?.sendUIInteraction(
          "compare-view-change-table-to-compare",
        );
        break;

      case "viewSourceFile":
        await jumpToLocation(
          msg.databaseUri,
          msg.loc,
          this.databaseManager,
          this.logger,
        );
        break;

      case "openQuery":
        await this.openQuery(msg.kind);
        telemetryListener?.sendUIInteraction(
          `compare-view-open-${msg.kind}-query`,
        );
        break;

      case "telemetry":
        telemetryListener?.sendUIInteraction(msg.action);
        break;

      case "unhandledError":
        void showAndLogExceptionWithTelemetry(
          extLogger,
          telemetryListener,
          redactableError(
            msg.error,
          )`Unhandled error in result comparison view: ${msg.error.message}`,
        );
        break;

      default:
        assertNever(msg);
    }
  }

  private async findCommonResultSetNames(
    { from, fromSchemas, to, toSchemas }: ComparePair,
    selectedResultSetName: string | undefined,
  ) {
    const {
      commonResultSetNames,
      currentResultSetDisplayName,
      fromResultSetName,
      toResultSetName,
    } = await findResultSetNames(fromSchemas, toSchemas, selectedResultSetName);

    const fromResultSet = await this.getResultSet(
      fromSchemas,
      fromResultSetName,
      from.completedQuery.query.resultsPaths.resultsPath,
    );
    const toResultSet = await this.getResultSet(
      toSchemas,
      toResultSetName,
      to.completedQuery.query.resultsPaths.resultsPath,
    );
    return {
      commonResultSetNames,
      currentResultSetDisplayName,
      fromResultSet,
      toResultSet,
    };
  }

  private async changeTable(newResultSetName: string) {
    await this.showResultsInternal(newResultSetName);
  }

  private async getResultSet(
    bqrsInfo: BQRSInfo,
    resultSetName: string,
    resultsPath: string,
  ): Promise<DecodedBqrsChunk> {
    const schema = bqrsInfo["result-sets"].find(
      (schema) => schema.name === resultSetName,
    );
    if (!schema) {
      throw new Error(`Schema ${resultSetName} not found.`);
    }
    return await this.cliServer.bqrsDecode(resultsPath, resultSetName);
  }

  private compareResults(
    fromResults: DecodedBqrsChunk,
    toResults: DecodedBqrsChunk,
  ): QueryCompareResult {
    // Only compare columns that have the same name
    return resultsDiff(fromResults, toResults);
  }

  private async openQuery(kind: "from" | "to") {
    const toOpen =
      kind === "from" ? this.comparePair?.from : this.comparePair?.to;
    if (toOpen) {
      await this.showQueryResultsCallback(toOpen);
    }
  }
}
