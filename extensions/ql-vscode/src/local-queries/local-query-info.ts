import { basename } from "path";
import { CancellationTokenSource, env } from "vscode";
import { CompletedQueryInfo, InitialQueryInfo } from "../query-results";
import { QueryStatus } from "../query-status";
import { QueryWithResults } from "../run-queries-shared";

export class LocalQueryInfo {
  readonly t = "local";

  public failureReason: string | undefined;
  public completedQuery: CompletedQueryInfo | undefined;
  public evalLogLocation: string | undefined;
  public evalLogSummaryLocation: string | undefined;
  public jsonEvalLogSummaryLocation: string | undefined;
  public evalLogSummarySymbolsLocation: string | undefined;

  /**
   * Note that in the {@link readQueryHistoryFromFile} method, we create a FullQueryInfo instance
   * by explicitly setting the prototype in order to avoid calling this constructor.
   */
  constructor(
    public readonly initialInfo: InitialQueryInfo,
    private cancellationSource?: CancellationTokenSource, // used to cancel in progress queries
  ) {
    /**/
  }

  cancel() {
    this.cancellationSource?.cancel();
    // query is no longer in progress, can delete the cancellation token source
    this.cancellationSource?.dispose();
    delete this.cancellationSource;
  }

  get startTime() {
    return this.initialInfo.start.toLocaleString(env.language);
  }

  get userSpecifiedLabel() {
    return this.initialInfo.userSpecifiedLabel;
  }

  set userSpecifiedLabel(label: string | undefined) {
    this.initialInfo.userSpecifiedLabel = label;
  }

  /**
   * The query's file name, unless it is a quick eval.
   * Queries run through quick evaluation are not usually the entire query file.
   * Label them differently and include the line numbers.
   */
  getQueryFileName() {
    if (this.initialInfo.quickEvalPosition) {
      const { line, endLine, fileName } = this.initialInfo.quickEvalPosition;
      const lineInfo = line === endLine ? `${line}` : `${line}-${endLine}`;
      return `${basename(fileName)}:${lineInfo}`;
    }
    return basename(this.initialInfo.queryPath);
  }

  /**
   * Three cases:
   *
   * - If this is a completed query, use the query name from the query metadata.
   * - If this is a quick eval, return the query name with a prefix
   * - Otherwise, return the query file name.
   */
  getQueryName() {
    if (this.initialInfo.quickEvalPosition) {
      return `Quick evaluation of ${this.getQueryFileName()}`;
    } else if (this.completedQuery?.query.metadata?.name) {
      return this.completedQuery?.query.metadata?.name;
    } else {
      return this.getQueryFileName();
    }
  }

  get completed(): boolean {
    return !!this.completedQuery;
  }

  completeThisQuery(info: QueryWithResults): void {
    this.completedQuery = new CompletedQueryInfo(info);

    // dispose of the cancellation token source and also ensure the source is not serialized as JSON
    this.cancellationSource?.dispose();
    delete this.cancellationSource;
  }

  /**
   * If there is a failure reason, then this query has failed.
   * If there is no completed query, then this query is still running.
   * If there is a completed query, then check if didRunSuccessfully.
   * If true, then this query has completed successfully, otherwise it has failed.
   */
  get status(): QueryStatus {
    if (this.failureReason) {
      return QueryStatus.Failed;
    } else if (!this.completedQuery) {
      return QueryStatus.InProgress;
    } else if (this.completedQuery.successful) {
      return QueryStatus.Completed;
    } else {
      return QueryStatus.Failed;
    }
  }
}
