import { ExtensionContext, ViewColumn } from "vscode";

import {
  FromCompareViewMessage,
  ToCompareViewMessage,
  QueryCompareResult,
} from "../pure/interface-types";
import { extLogger, Logger } from "../common";
import { showAndLogExceptionWithTelemetry } from "../common/vscode/logging";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { DatabaseManager } from "../databases/local-databases";
import { jumpToLocation } from "../databases/local-databases/locations";
import {
  transformBqrsResultSet,
  RawResultSet,
  BQRSInfo,
} from "../pure/bqrs-cli-types";
import resultsDiff from "./resultsDiff";
import { CompletedLocalQueryInfo } from "../query-results";
import { assertNever, getErrorMessage } from "../pure/helpers-pure";
import { HistoryItemLabelProvider } from "../query-history/history-item-label-provider";
import {
  AbstractWebview,
  WebviewPanelConfig,
} from "../common/vscode/abstract-webview";
import { telemetryListener } from "../common/vscode/telemetry";
import { redactableError } from "../pure/errors";

interface ComparePair {
  from: CompletedLocalQueryInfo;
  to: CompletedLocalQueryInfo;
}

export class CompareView extends AbstractWebview<
  ToCompareViewMessage,
  FromCompareViewMessage
> {
  private comparePair: ComparePair | undefined;

  constructor(
    ctx: ExtensionContext,
    private databaseManager: DatabaseManager,
    private cliServer: CodeQLCliServer,
    private logger: Logger,
    private labelProvider: HistoryItemLabelProvider,
    private showQueryResultsCallback: (
      item: CompletedLocalQueryInfo,
    ) => Promise<void>,
  ) {
    super(ctx);
  }

  async showResults(
    from: CompletedLocalQueryInfo,
    to: CompletedLocalQueryInfo,
    selectedResultSetName?: string,
  ) {
    this.comparePair = { from, to };
    const panel = await this.getPanel();
    panel.reveal(undefined, true);

    await this.waitForPanelLoaded();
    const [
      commonResultSetNames,
      currentResultSetName,
      fromResultSet,
      toResultSet,
    ] = await this.findCommonResultSetNames(from, to, selectedResultSetName);
    if (currentResultSetName) {
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
        columns: fromResultSet.schema.columns,
        commonResultSetNames,
        currentResultSetName,
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
    from: CompletedLocalQueryInfo,
    to: CompletedLocalQueryInfo,
    selectedResultSetName: string | undefined,
  ): Promise<[string[], string, RawResultSet, RawResultSet]> {
    const fromSchemas = await this.cliServer.bqrsInfo(
      from.completedQuery.query.resultsPaths.resultsPath,
    );
    const toSchemas = await this.cliServer.bqrsInfo(
      to.completedQuery.query.resultsPaths.resultsPath,
    );
    const fromSchemaNames = fromSchemas["result-sets"].map(
      (schema) => schema.name,
    );
    const toSchemaNames = toSchemas["result-sets"].map((schema) => schema.name);
    const commonResultSetNames = fromSchemaNames.filter((name) =>
      toSchemaNames.includes(name),
    );

    // Fall back on the default result set names if there are no common ones.
    const defaultFromResultSetName = fromSchemaNames.find((name) =>
      name.startsWith("#"),
    );
    const defaultToResultSetName = toSchemaNames.find((name) =>
      name.startsWith("#"),
    );

    if (
      commonResultSetNames.length === 0 &&
      !(defaultFromResultSetName || defaultToResultSetName)
    ) {
      throw new Error(
        "No common result sets found between the two queries. Please check that the queries are compatible.",
      );
    }

    const currentResultSetName =
      selectedResultSetName || commonResultSetNames[0];
    const fromResultSet = await this.getResultSet(
      fromSchemas,
      currentResultSetName || defaultFromResultSetName!,
      from.completedQuery.query.resultsPaths.resultsPath,
    );
    const toResultSet = await this.getResultSet(
      toSchemas,
      currentResultSetName || defaultToResultSetName!,
      to.completedQuery.query.resultsPaths.resultsPath,
    );
    return [
      commonResultSetNames,
      currentResultSetName ||
        `${defaultFromResultSetName} <-> ${defaultToResultSetName}`,
      fromResultSet,
      toResultSet,
    ];
  }

  private async changeTable(newResultSetName: string) {
    if (!this.comparePair?.from || !this.comparePair.to) {
      return;
    }
    await this.showResults(
      this.comparePair.from,
      this.comparePair.to,
      newResultSetName,
    );
  }

  private async getResultSet(
    bqrsInfo: BQRSInfo,
    resultSetName: string,
    resultsPath: string,
  ): Promise<RawResultSet> {
    const schema = bqrsInfo["result-sets"].find(
      (schema) => schema.name === resultSetName,
    );
    if (!schema) {
      throw new Error(`Schema ${resultSetName} not found.`);
    }
    const chunk = await this.cliServer.bqrsDecode(resultsPath, resultSetName);
    return transformBqrsResultSet(schema, chunk);
  }

  private compareResults(
    fromResults: RawResultSet,
    toResults: RawResultSet,
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
