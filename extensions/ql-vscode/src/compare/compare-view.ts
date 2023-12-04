import { Uri, ViewColumn } from "vscode";

import * as sarif from "sarif";
import {
  FromCompareViewMessage,
  ToCompareViewMessage,
  RawQueryCompareResult,
  ALERTS_TABLE_NAME,
  QueryCompareResult,
  InterpretedQueryCompareResult,
} from "../common/interface-types";
import { Logger, showAndLogExceptionWithTelemetry } from "../common/logging";
import { extLogger } from "../common/logging/vscode";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { DatabaseManager } from "../databases/local-databases";
import { jumpToLocation } from "../databases/local-databases/locations";
import {
  transformBqrsResultSet,
  RawResultSet,
  BQRSInfo,
} from "../common/bqrs-cli-types";
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
import { pathExists } from "fs-extra";
import { sarifParser } from "../common/sarif-parser";
import sarifDiff from "./sarif-diff";

interface ComparePair {
  from: CompletedLocalQueryInfo;
  to: CompletedLocalQueryInfo;
}

type CommonResultSet =
  | {
      type: "raw";
      commonResultSetNames: string[];
      currentResultSetName: string;
      fromSchemas: BQRSInfo;
      toSchemas: BQRSInfo;
      fromResultSetName: string;
      toResultSetName: string;
    }
  | {
      type: "interpreted";
      commonResultSetNames: string[];
      currentResultSetName: string;
    };

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
    this.comparePair = { from, to };
    const panel = await this.getPanel();
    panel.reveal(undefined, true);

    await this.waitForPanelLoaded();
    const commonResultSet = await this.findCommonResultSet(
      from,
      to,
      selectedResultSetName,
    );
    const { commonResultSetNames, currentResultSetName } = commonResultSet;
    if (currentResultSetName) {
      let result: QueryCompareResult | undefined;
      let message: string | undefined;

      if (commonResultSet.type === "interpreted") {
        try {
          result = await this.compareInterpretedResults(from, to);
        } catch (e) {
          message = getErrorMessage(e);
        }
      } else {
        try {
          result = await this.compareRawResults(
            from,
            to,
            commonResultSet.fromSchemas,
            commonResultSet.toSchemas,
            commonResultSet.fromResultSetName,
            commonResultSet.toResultSetName,
          );
        } catch (e) {
          message = getErrorMessage(e);
        }
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
        commonResultSetNames,
        currentResultSetName,
        result,
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

  private async findCommonResultSet(
    from: CompletedLocalQueryInfo,
    to: CompletedLocalQueryInfo,
    selectedResultSetName: string | undefined,
  ): Promise<CommonResultSet> {
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

    if (
      await pathExists(
        from.completedQuery.query.resultsPaths.interpretedResultsPath,
      )
    ) {
      fromSchemaNames.push(ALERTS_TABLE_NAME);
    }
    if (
      await pathExists(
        to.completedQuery.query.resultsPaths.interpretedResultsPath,
      )
    ) {
      toSchemaNames.push(ALERTS_TABLE_NAME);
    }

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

    const displayCurrentResultSetName =
      currentResultSetName ||
      `${defaultFromResultSetName} <-> ${defaultToResultSetName}`;

    if (currentResultSetName === ALERTS_TABLE_NAME) {
      return {
        type: "interpreted",
        commonResultSetNames,
        currentResultSetName: displayCurrentResultSetName,
      };
    } else {
      return {
        type: "raw",
        commonResultSetNames,
        currentResultSetName: displayCurrentResultSetName,
        fromSchemas,
        toSchemas,
        fromResultSetName: currentResultSetName || defaultFromResultSetName!,
        toResultSetName: currentResultSetName || defaultToResultSetName!,
      };
    }
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

  private async getInterpretedResults(
    interpretedResultsPath: string,
  ): Promise<sarif.Log | undefined> {
    if (!(await pathExists(interpretedResultsPath))) {
      return undefined;
    }

    return await sarifParser(interpretedResultsPath);
  }

  private async compareRawResults(
    fromQuery: CompletedLocalQueryInfo,
    toQuery: CompletedLocalQueryInfo,
    fromSchemas: BQRSInfo,
    toSchemas: BQRSInfo,
    fromResultSetName: string,
    toResultSetName: string,
  ): Promise<RawQueryCompareResult> {
    const fromResults = await this.getResultSet(
      fromSchemas,
      fromResultSetName,
      fromQuery.completedQuery.query.resultsPaths.resultsPath,
    );

    const toResults = await this.getResultSet(
      toSchemas,
      toResultSetName,
      toQuery.completedQuery.query.resultsPaths.resultsPath,
    );

    // Only compare columns that have the same name
    return resultsDiff(fromResults, toResults);
  }

  private async compareInterpretedResults(
    fromQuery: CompletedLocalQueryInfo,
    toQuery: CompletedLocalQueryInfo,
  ): Promise<InterpretedQueryCompareResult> {
    const fromResultSet = await this.getInterpretedResults(
      fromQuery.completedQuery.query.resultsPaths.interpretedResultsPath,
    );

    const toResultSet = await this.getInterpretedResults(
      toQuery.completedQuery.query.resultsPaths.interpretedResultsPath,
    );

    if (!fromResultSet || !toResultSet) {
      throw new Error(
        "Could not find interpreted results for one or both queries.",
      );
    }

    const database = this.databaseManager.findDatabaseItem(
      Uri.parse(toQuery.initialInfo.databaseInfo.databaseUri),
    );
    if (!database) {
      throw new Error(
        "Could not find database the queries. Please check that the database still exists.",
      );
    }

    const sourceLocationPrefix = await database.getSourceLocationPrefix(
      this.cliServer,
    );

    const fromResults = fromResultSet.runs[0].results;
    const toResults = toResultSet.runs[0].results;

    if (!fromResults) {
      throw new Error("No results found in the 'from' query.");
    }

    if (!toResults) {
      throw new Error("No results found in the 'to' query.");
    }

    const { from, to } = sarifDiff(fromResults, toResults);

    return {
      type: "interpreted",
      sourceLocationPrefix,
      from,
      to,
    };
  }

  private async openQuery(kind: "from" | "to") {
    const toOpen =
      kind === "from" ? this.comparePair?.from : this.comparePair?.to;
    if (toOpen) {
      await this.showQueryResultsCallback(toOpen);
    }
  }
}
