import { CancellationTokenSource, env } from "vscode";

import * as messages from "./pure/messages-shared";
import * as legacyMessages from "./pure/legacy-messages";
import * as cli from "./cli";
import { pathExists } from "fs-extra";
import { basename } from "path";
import {
  RawResultsSortState,
  SortedResultSetInfo,
  QueryMetadata,
  InterpretedResultsSortState,
  ResultsPaths,
  SarifInterpretationData,
  GraphInterpretationData,
  DatabaseInfo,
} from "./pure/interface-types";
import { QueryStatus } from "./query-status";
import { QueryEvaluationInfo, QueryWithResults } from "./run-queries-shared";
import { formatLegacyMessage } from "./legacy-query-server/run-queries";
import { sarifParser } from "./sarif-parser";

/**
 * query-results.ts
 * ----------------
 *
 * A collection of classes and functions that collectively
 * manage query results.
 */

/**
 * A description of the information about a query
 * that is available before results are populated.
 */
export interface InitialQueryInfo {
  userSpecifiedLabel?: string; // if missing, use a default label
  readonly queryText: string; // text of the selected file, or the selected text when doing quick eval
  readonly isQuickQuery: boolean;
  readonly isQuickEval: boolean;
  readonly quickEvalPosition?: messages.Position;
  readonly queryPath: string;
  readonly databaseInfo: DatabaseInfo;
  readonly start: Date;
  readonly id: string; // unique id for this query.
}

export class CompletedQueryInfo implements QueryWithResults {
  readonly query: QueryEvaluationInfo;
  readonly message?: string;
  readonly successful?: boolean;
  /**
   * The legacy result. This is only set when loading from the query history.
   */
  readonly result: legacyMessages.EvaluationResult;
  readonly logFileLocation?: string;
  resultCount: number;

  /**
   * Map from result set name to SortedResultSetInfo.
   */
  sortedResultsInfo: Record<string, SortedResultSetInfo>;

  /**
   * How we're currently sorting alerts. This is not mere interface
   * state due to truncation; on re-sort, we want to read in the file
   * again, sort it, and only ship off a reasonable number of results
   * to the webview. Undefined means to use whatever order is in the
   * sarif file.
   */
  interpretedResultsSortState: InterpretedResultsSortState | undefined;

  /**
   * Note that in the {@link readQueryHistoryFromFile} method, we create a CompletedQueryInfo instance
   * by explicitly setting the prototype in order to avoid calling this constructor.
   */
  constructor(evaluation: QueryWithResults) {
    this.query = evaluation.query;
    this.logFileLocation = evaluation.logFileLocation;
    this.result = evaluation.result;

    this.message = evaluation.message;
    this.successful = evaluation.successful;

    this.sortedResultsInfo = {};
    this.resultCount = 0;
  }

  setResultCount(value: number) {
    this.resultCount = value;
  }

  get statusString(): string {
    if (this.message) {
      return this.message;
    } else if (this.result) {
      return formatLegacyMessage(this.result);
    } else {
      throw new Error("No status available");
    }
  }

  getResultsPath(selectedTable: string, useSorted = true): string {
    if (!useSorted) {
      return this.query.resultsPaths.resultsPath;
    }
    return (
      this.sortedResultsInfo[selectedTable]?.resultsPath ||
      this.query.resultsPaths.resultsPath
    );
  }

  async updateSortState(
    server: cli.CodeQLCliServer,
    resultSetName: string,
    sortState?: RawResultsSortState,
  ): Promise<void> {
    if (sortState === undefined) {
      delete this.sortedResultsInfo[resultSetName];
      return;
    }

    const sortedResultSetInfo: SortedResultSetInfo = {
      resultsPath: this.query.getSortedResultSetPath(resultSetName),
      sortState,
    };

    await server.sortBqrs(
      this.query.resultsPaths.resultsPath,
      sortedResultSetInfo.resultsPath,
      resultSetName,
      [sortState.columnIndex],
      [sortState.sortDirection],
    );
    this.sortedResultsInfo[resultSetName] = sortedResultSetInfo;
  }

  async updateInterpretedSortState(
    sortState?: InterpretedResultsSortState,
  ): Promise<void> {
    this.interpretedResultsSortState = sortState;
  }
}

/**
 * Call cli command to interpret SARIF results.
 */
export async function interpretResultsSarif(
  cli: cli.CodeQLCliServer,
  metadata: QueryMetadata | undefined,
  resultsPaths: ResultsPaths,
  sourceInfo?: cli.SourceInfo,
): Promise<SarifInterpretationData> {
  const { resultsPath, interpretedResultsPath } = resultsPaths;
  let res;
  if (await pathExists(interpretedResultsPath)) {
    res = await sarifParser(interpretedResultsPath);
  } else {
    res = await cli.interpretBqrsSarif(
      ensureMetadataIsComplete(metadata),
      resultsPath,
      interpretedResultsPath,
      sourceInfo,
    );
  }
  return { ...res, t: "SarifInterpretationData" };
}

/**
 * Call cli command to interpret graph results.
 */
export async function interpretGraphResults(
  cli: cli.CodeQLCliServer,
  metadata: QueryMetadata | undefined,
  resultsPaths: ResultsPaths,
  sourceInfo?: cli.SourceInfo,
): Promise<GraphInterpretationData> {
  const { resultsPath, interpretedResultsPath } = resultsPaths;
  if (await pathExists(interpretedResultsPath)) {
    const dot = await cli.readDotFiles(interpretedResultsPath);
    return { dot, t: "GraphInterpretationData" };
  }

  const dot = await cli.interpretBqrsGraph(
    ensureMetadataIsComplete(metadata),
    resultsPath,
    interpretedResultsPath,
    sourceInfo,
  );
  return { dot, t: "GraphInterpretationData" };
}

export function ensureMetadataIsComplete(metadata: QueryMetadata | undefined) {
  if (metadata === undefined) {
    throw new Error("Can't interpret results without query metadata");
  }
  if (metadata.kind === undefined) {
    throw new Error(
      "Can't interpret results without query metadata including kind",
    );
  }
  if (metadata.id === undefined) {
    // Interpretation per se doesn't really require an id, but the
    // SARIF format does, so in the absence of one, we use a dummy id.
    metadata.id = "dummy-id";
  }
  return metadata;
}

/**
 * Used in Interface and Compare-Interface for queries that we know have been completed.
 */
export type CompletedLocalQueryInfo = LocalQueryInfo & {
  completedQuery: CompletedQueryInfo;
};

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
