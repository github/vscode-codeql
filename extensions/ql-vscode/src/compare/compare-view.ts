import { ViewColumn } from "vscode";

import {
  ALERTS_TABLE_NAME,
  FromCompareViewMessage,
  InterpretedQueryCompareResult,
  QueryCompareResult,
  RawQueryCompareResult,
  ToCompareViewMessage,
} from "../common/interface-types";
import { Logger, showAndLogExceptionWithTelemetry } from "../common/logging";
import { extLogger } from "../common/logging/vscode";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { DatabaseManager } from "../databases/local-databases";
import { jumpToLocation } from "../databases/local-databases/locations";
import { BqrsInfo } from "../common/bqrs-cli-types";
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
import { bqrsToResultSet } from "../common/bqrs-raw-results-mapper";
import { RawResultSet } from "../common/raw-result-types";
import {
  CompareQueryInfo,
  findCommonResultSetNames,
  findResultSetNames,
  getResultSetNames,
} from "./result-set-names";
import { compareInterpretedResults } from "./interpreted-results";

interface ComparePair {
  from: CompletedLocalQueryInfo;
  fromInfo: CompareQueryInfo;
  to: CompletedLocalQueryInfo;
  toInfo: CompareQueryInfo;

  commonResultSetNames: readonly string[];
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
    const [fromSchemas, toSchemas] = await Promise.all([
      this.cliServer.bqrsInfo(
        from.completedQuery.query.resultsPaths.resultsPath,
      ),
      this.cliServer.bqrsInfo(to.completedQuery.query.resultsPaths.resultsPath),
    ]);

    const [fromSchemaNames, toSchemaNames] = await Promise.all([
      getResultSetNames(
        fromSchemas,
        from.completedQuery.query.metadata,
        from.completedQuery.query.resultsPaths.interpretedResultsPath,
      ),
      getResultSetNames(
        toSchemas,
        to.completedQuery.query.metadata,
        to.completedQuery.query.resultsPaths.interpretedResultsPath,
      ),
    ]);

    const commonResultSetNames = findCommonResultSetNames(
      fromSchemaNames,
      toSchemaNames,
    );

    this.comparePair = {
      from,
      fromInfo: {
        schemas: fromSchemas,
        schemaNames: fromSchemaNames,
        metadata: from.completedQuery.query.metadata,
        interpretedResultsPath:
          from.completedQuery.query.resultsPaths.interpretedResultsPath,
      },
      to,
      toInfo: {
        schemas: toSchemas,
        schemaNames: toSchemaNames,
        metadata: to.completedQuery.query.metadata,
        interpretedResultsPath:
          to.completedQuery.query.resultsPaths.interpretedResultsPath,
      },
      commonResultSetNames,
    };

    const panel = await this.getPanel();
    panel.reveal(undefined, true);
    await this.waitForPanelLoaded();

    await this.postMessage({
      t: "setComparisonQueryInfo",
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
      databaseUri: to.initialInfo.databaseInfo.databaseUri,
      commonResultSetNames,
    });

    await this.showResultsInternal(selectedResultSetName);
  }

  private async showResultsInternal(selectedResultSetName?: string) {
    if (!this.comparePair) {
      return;
    }

    const panel = await this.getPanel();
    panel.reveal(undefined, true);

    await this.waitForPanelLoaded();
    const {
      currentResultSetName,
      currentResultSetDisplayName,
      fromResultSetName,
      toResultSetName,
    } = await this.findResultSetsToCompare(
      this.comparePair,
      selectedResultSetName,
    );
    if (currentResultSetDisplayName) {
      let result: QueryCompareResult | undefined;
      let message: string | undefined;
      try {
        if (currentResultSetName === ALERTS_TABLE_NAME) {
          result = await this.compareInterpretedResults(this.comparePair);
        } else {
          result = await this.compareResults(
            this.comparePair,
            fromResultSetName,
            toResultSetName,
          );
        }
      } catch (e) {
        message = getErrorMessage(e);
      }

      await this.postMessage({
        t: "setComparisons",
        result,
        currentResultSetName: currentResultSetDisplayName,
        message,
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

  private async findResultSetsToCompare(
    { fromInfo, toInfo, commonResultSetNames }: ComparePair,
    selectedResultSetName: string | undefined,
  ) {
    const {
      currentResultSetName,
      currentResultSetDisplayName,
      fromResultSetName,
      toResultSetName,
    } = await findResultSetNames(
      fromInfo,
      toInfo,
      commonResultSetNames,
      selectedResultSetName,
    );

    return {
      commonResultSetNames,
      currentResultSetName,
      currentResultSetDisplayName,
      fromResultSetName,
      toResultSetName,
    };
  }

  private async changeTable(newResultSetName: string) {
    await this.showResultsInternal(newResultSetName);
  }

  private async getResultSet(
    bqrsInfo: BqrsInfo,
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
    return bqrsToResultSet(schema, chunk);
  }

  private async compareResults(
    { from, fromInfo, to, toInfo }: ComparePair,
    fromResultSetName: string,
    toResultSetName: string,
  ): Promise<RawQueryCompareResult> {
    const [fromResultSet, toResultSet] = await Promise.all([
      this.getResultSet(
        fromInfo.schemas,
        fromResultSetName,
        from.completedQuery.query.resultsPaths.resultsPath,
      ),
      this.getResultSet(
        toInfo.schemas,
        toResultSetName,
        to.completedQuery.query.resultsPaths.resultsPath,
      ),
    ]);

    return resultsDiff(fromResultSet, toResultSet);
  }

  private async compareInterpretedResults({
    from,
    to,
  }: ComparePair): Promise<InterpretedQueryCompareResult> {
    return compareInterpretedResults(
      this.databaseManager,
      this.cliServer,
      from,
      to,
    );
  }

  private async openQuery(kind: "from" | "to") {
    const toOpen =
      kind === "from" ? this.comparePair?.from : this.comparePair?.to;
    if (toOpen) {
      await this.showQueryResultsCallback(toOpen);
    }
  }
}
