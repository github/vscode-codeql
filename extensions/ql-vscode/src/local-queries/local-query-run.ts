import { BaseLogger, Logger } from "../common";
import {
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
  tryGetQueryMetadata,
} from "../helpers";
import { CoreQueryResults } from "../query-server";
import { QueryHistoryManager } from "../query-history/query-history-manager";
import { DatabaseItem } from "../databases/local-databases";
import {
  EvaluatorLogPaths,
  generateEvalLogSummaries,
  logEndSummary,
  QueryEvaluationInfo,
  QueryOutputDir,
  QueryWithResults,
} from "../run-queries-shared";
import { CompletedLocalQueryInfo, LocalQueryInfo } from "../query-results";
import { WebviewReveal } from "./webview";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { QueryResultType } from "../pure/new-messages";
import { redactableError } from "../pure/errors";
import { LocalQueries } from "./local-queries";

function formatResultMessage(result: CoreQueryResults): string {
  switch (result.resultType) {
    case QueryResultType.CANCELLATION:
      return `cancelled after ${Math.round(
        result.evaluationTime / 1000,
      )} seconds`;
    case QueryResultType.OOM:
      return "out of memory";
    case QueryResultType.SUCCESS:
      return `finished in ${Math.round(result.evaluationTime / 1000)} seconds`;
    case QueryResultType.COMPILATION_ERROR:
      return `compilation failed: ${result.message}`;
    case QueryResultType.OTHER_ERROR:
    default:
      return result.message ? `failed: ${result.message}` : "failed";
  }
}

/**
 * Tracks the evaluation of a local query, including its interactions with the UI.
 *
 * The client creates an instance of `LocalQueryRun` when the evaluation starts, and then invokes
 * the `complete()` function once the query has completed (successfully or otherwise).
 *
 * Having the client tell the `LocalQueryRun` when the evaluation is complete, rather than having
 * the `LocalQueryRun` manage the evaluation itself, may seem a bit clunky. It's done this way
 * because once we move query evaluation into a Debug Adapter, the debugging UI drives the
 * evaluation, and we can only respond to events from the debug adapter.
 */
export class LocalQueryRun {
  public constructor(
    private readonly outputDir: QueryOutputDir,
    private readonly localQueries: LocalQueries,
    private readonly queryInfo: LocalQueryInfo,
    private readonly dbItem: DatabaseItem,
    public readonly logger: Logger, // Public so that other clients, like the debug adapter, know where to send log output
    private readonly queryHistoryManager: QueryHistoryManager,
    private readonly cliServer: CodeQLCliServer,
  ) {}

  /**
   * Updates the UI based on the results of the query evaluation. This creates the evaluator log
   * summaries, updates the query history item for the evaluation with the results and evaluation
   * time, and displays the results view.
   *
   * This function must be called when the evaluation completes, whether the evaluation was
   * successful or not.
   * */
  public async complete(results: CoreQueryResults): Promise<void> {
    const evalLogPaths = await this.summarizeEvalLog(
      results.resultType,
      this.outputDir,
      this.logger,
    );
    if (evalLogPaths !== undefined) {
      this.queryInfo.setEvaluatorLogPaths(evalLogPaths);
    }
    const queryWithResults = await this.getCompletedQueryInfo(results);
    this.queryHistoryManager.completeQuery(this.queryInfo, queryWithResults);
    await this.localQueries.showResultsForCompletedQuery(
      this.queryInfo as CompletedLocalQueryInfo,
      WebviewReveal.Forced,
    );
    // Note we must update the query history view after showing results as the
    // display and sorting might depend on the number of results
    await this.queryHistoryManager.refreshTreeView();
  }

  /**
   * Updates the UI in the case where query evaluation throws an exception.
   */
  public async fail(err: Error): Promise<void> {
    err.message = `Error running query: ${err.message}`;
    this.queryInfo.failureReason = err.message;
    await this.queryHistoryManager.refreshTreeView();
  }

  /**
   * Generate summaries of the structured evaluator log.
   */
  private async summarizeEvalLog(
    resultType: QueryResultType,
    outputDir: QueryOutputDir,
    logger: BaseLogger,
  ): Promise<EvaluatorLogPaths | undefined> {
    const evalLogPaths = await generateEvalLogSummaries(
      this.cliServer,
      outputDir,
    );
    if (evalLogPaths !== undefined) {
      if (evalLogPaths.endSummary !== undefined) {
        void logEndSummary(evalLogPaths.endSummary, logger); // Logged asynchrnously
      }
    } else {
      // Raw evaluator log was not found. Notify the user, unless we know why it wasn't found.
      if (resultType === QueryResultType.SUCCESS) {
        void showAndLogWarningMessage(
          `Failed to write structured evaluator log to ${outputDir.evalLogPath}.`,
        );
      } else {
        // Don't bother notifying the user if there's no log. For some errors, like compilation
        // errors, we don't expect a log. For cancellations and OOM errors, whether or not we have
        // a log depends on how far execution got before termination.
      }
    }

    return evalLogPaths;
  }

  /**
   * Gets a `QueryWithResults` containing information about the evaluation of the query and its
   * result, in the form expected by the query history UI.
   */
  private async getCompletedQueryInfo(
    results: CoreQueryResults,
  ): Promise<QueryWithResults> {
    // Read the query metadata if possible, to use in the UI.
    const metadata = await tryGetQueryMetadata(
      this.cliServer,
      this.queryInfo.initialInfo.queryPath,
    );
    const query = new QueryEvaluationInfo(
      this.outputDir.querySaveDir,
      this.dbItem.databaseUri.fsPath,
      await this.dbItem.hasMetadataFile(),
      this.queryInfo.initialInfo.quickEvalPosition,
      metadata,
    );

    if (results.resultType !== QueryResultType.SUCCESS) {
      const message = results.message
        ? redactableError`Failed to run query: ${results.message}`
        : redactableError`Failed to run query`;
      void showAndLogExceptionWithTelemetry(message);
    }
    const message = formatResultMessage(results);
    const successful = results.resultType === QueryResultType.SUCCESS;
    return {
      query,
      result: {
        evaluationTime: results.evaluationTime,
        queryId: 0,
        resultType: successful
          ? QueryResultType.SUCCESS
          : QueryResultType.OTHER_ERROR,
        runId: 0,
        message,
      },
      message,
      successful,
    };
  }
}
