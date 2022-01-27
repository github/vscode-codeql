import { env } from 'vscode';

import { QueryWithResults, tmpDir, QueryEvaluationInfo } from './run-queries';
import * as messages from './pure/messages';
import * as cli from './cli';
import * as sarif from 'sarif';
import * as fs from 'fs-extra';
import * as path from 'path';
import {
  RawResultsSortState,
  SortedResultSetInfo,
  QueryMetadata,
  InterpretedResultsSortState,
  ResultsPaths
} from './pure/interface-types';
import { QueryHistoryConfig } from './config';
import { DatabaseInfo } from './pure/interface-types';

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
  readonly databaseInfo: DatabaseInfo
  readonly start: Date;
  readonly id: number; // an incrementing number for each query
}

export enum QueryStatus {
  InProgress = 'InProgress',
  Completed = 'Completed',
  Failed = 'Failed',
}

export class CompletedQueryInfo implements QueryWithResults {
  readonly query: QueryEvaluationInfo;
  readonly result: messages.EvaluationResult;
  readonly logFileLocation?: string;
  resultCount: number;
  dispose: () => void;

  /**
   * Map from result set name to SortedResultSetInfo.
   */
  sortedResultsInfo: Map<string, SortedResultSetInfo>;

  /**
   * How we're currently sorting alerts. This is not mere interface
   * state due to truncation; on re-sort, we want to read in the file
   * again, sort it, and only ship off a reasonable number of results
   * to the webview. Undefined means to use whatever order is in the
   * sarif file.
   */
  interpretedResultsSortState: InterpretedResultsSortState | undefined;

  constructor(
    evaluation: QueryWithResults,
  ) {
    this.query = evaluation.query;
    this.result = evaluation.result;
    this.logFileLocation = evaluation.logFileLocation;
    this.dispose = evaluation.dispose;

    this.sortedResultsInfo = new Map();
    this.resultCount = 0;
  }

  setResultCount(value: number) {
    this.resultCount = value;
  }

  get statusString(): string {
    switch (this.result.resultType) {
      case messages.QueryResultType.CANCELLATION:
        return `cancelled after ${Math.round(this.result.evaluationTime / 1000)} seconds`;
      case messages.QueryResultType.OOM:
        return 'out of memory';
      case messages.QueryResultType.SUCCESS:
        return `finished in ${Math.round(this.result.evaluationTime / 1000)} seconds`;
      case messages.QueryResultType.TIMEOUT:
        return `timed out after ${Math.round(this.result.evaluationTime / 1000)} seconds`;
      case messages.QueryResultType.OTHER_ERROR:
      default:
        return this.result.message ? `failed: ${this.result.message}` : 'failed';
    }
  }

  getResultsPath(selectedTable: string, useSorted = true): string {
    if (!useSorted) {
      return this.query.resultsPaths.resultsPath;
    }
    return this.sortedResultsInfo.get(selectedTable)?.resultsPath
      || this.query.resultsPaths.resultsPath;
  }

  get didRunSuccessfully(): boolean {
    return this.result.resultType === messages.QueryResultType.SUCCESS;
  }

  async updateSortState(
    server: cli.CodeQLCliServer,
    resultSetName: string,
    sortState?: RawResultsSortState
  ): Promise<void> {
    if (sortState === undefined) {
      this.sortedResultsInfo.delete(resultSetName);
      return;
    }

    const sortedResultSetInfo: SortedResultSetInfo = {
      resultsPath: path.join(tmpDir.name, `sortedResults${this.query.queryID}-${resultSetName}.bqrs`),
      sortState
    };

    await server.sortBqrs(
      this.query.resultsPaths.resultsPath,
      sortedResultSetInfo.resultsPath,
      resultSetName,
      [sortState.columnIndex],
      [sortState.sortDirection]
    );
    this.sortedResultsInfo.set(resultSetName, sortedResultSetInfo);
  }

  async updateInterpretedSortState(sortState?: InterpretedResultsSortState): Promise<void> {
    this.interpretedResultsSortState = sortState;
  }
}


/**
 * Call cli command to interpret results.
 */
export async function interpretResults(
  server: cli.CodeQLCliServer,
  metadata: QueryMetadata | undefined,
  resultsPaths: ResultsPaths,
  sourceInfo?: cli.SourceInfo
): Promise<sarif.Log> {
  const { resultsPath, interpretedResultsPath } = resultsPaths;
  if (await fs.pathExists(interpretedResultsPath)) {
    return JSON.parse(await fs.readFile(interpretedResultsPath, 'utf8'));
  }
  return await server.interpretBqrs(ensureMetadataIsComplete(metadata), resultsPath, interpretedResultsPath, sourceInfo);
}

export function ensureMetadataIsComplete(metadata: QueryMetadata | undefined) {
  if (metadata === undefined) {
    throw new Error('Can\'t interpret results without query metadata');
  }
  if (metadata.kind === undefined) {
    throw new Error('Can\'t interpret results without query metadata including kind');
  }
  if (metadata.id === undefined) {
    // Interpretation per se doesn't really require an id, but the
    // SARIF format does, so in the absence of one, we use a dummy id.
    metadata.id = 'dummy-id';
  }
  return metadata;
}


/**
 * Used in Interface and Compare-Interface for queries that we know have been complated.
 */
export type FullCompletedQueryInfo = FullQueryInfo & {
  completedQuery: CompletedQueryInfo
};

export class FullQueryInfo {
  public failureReason: string | undefined;
  public completedQuery: CompletedQueryInfo | undefined;

  constructor(
    public readonly initialInfo: InitialQueryInfo,
    private readonly config: QueryHistoryConfig,
  ) {
    /**/
  }

  get startTime() {
    return this.initialInfo.start.toLocaleString(env.language);
  }

  interpolate(template: string): string {
    const { resultCount = 0, statusString = 'in progress' } = this.completedQuery || {};
    const replacements: { [k: string]: string } = {
      t: this.startTime,
      q: this.getQueryName(),
      d: this.initialInfo.databaseInfo.name,
      r: resultCount.toString(),
      s: statusString,
      f: this.getQueryFileName(),
      '%': '%',
    };
    return template.replace(/%(.)/g, (match, key) => {
      const replacement = replacements[key];
      return replacement !== undefined ? replacement : match;
    });
  }

  /**
   * Returns a label for this query that includes interpolated values.
   */
  get label(): string {
    return this.interpolate(this.initialInfo.userSpecifiedLabel ?? this.config.format ?? '');
  }

  /**
   * Avoids getting the default label for the query.
   * If there is a custom label for this query, interpolate and use that.
   * Otherwise, use the name of the query.
   *
   * @returns the name of the query, unless there is a custom label for this query.
   */
  getShortLabel(): string {
    return this.initialInfo.userSpecifiedLabel
      ? this.interpolate(this.initialInfo.userSpecifiedLabel)
      : this.getQueryName();
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
      return `${path.basename(fileName)}:${lineInfo}`;
    }
    return path.basename(this.initialInfo.queryPath);
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
      return 'Quick evaluation of ' + this.getQueryFileName();
    } else if (this.completedQuery?.query.metadata?.name) {
      return this.completedQuery?.query.metadata?.name;
    } else {
      return this.getQueryFileName();
    }
  }

  isCompleted(): boolean {
    return !!this.completedQuery;
  }

  completeThisQuery(info: QueryWithResults) {
    this.completedQuery = new CompletedQueryInfo(info);
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
    } else if (this.completedQuery.didRunSuccessfully) {
      return QueryStatus.Completed;
    } else {
      return QueryStatus.Failed;
    }
  }
}
