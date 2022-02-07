import { CancellationTokenSource, env } from 'vscode';

import { QueryWithResults, QueryEvaluationInfo } from './run-queries';
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
import { showAndLogErrorMessage } from './helpers';

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
  readonly id: string; // unique id for this query.
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

  /**
   * This dispose method is called when the query is removed from the history view.
   */
  dispose: () => void;

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
   * Note that in the {@link FullQueryInfo.slurp} method, we create a CompletedQueryInfo instance
   * by explicitly setting the prototype in order to avoid calling this constructor.
   */
  constructor(
    evaluation: QueryWithResults,
  ) {
    this.query = evaluation.query;
    this.result = evaluation.result;
    this.logFileLocation = evaluation.logFileLocation;

    // Use the dispose method from the evaluation.
    // The dispose will clean up any additional log locations that this
    // query may have created.
    this.dispose = evaluation.dispose;

    this.sortedResultsInfo = {};
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
    return this.sortedResultsInfo[selectedTable]?.resultsPath
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
      delete this.sortedResultsInfo[resultSetName];
      return;
    }

    const sortedResultSetInfo: SortedResultSetInfo = {
      resultsPath: this.query.getSortedResultSetPath(resultSetName),
      sortState
    };

    await server.sortBqrs(
      this.query.resultsPaths.resultsPath,
      sortedResultSetInfo.resultsPath,
      resultSetName,
      [sortState.columnIndex],
      [sortState.sortDirection]
    );
    this.sortedResultsInfo[resultSetName] = sortedResultSetInfo;
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

  static async slurp(fsPath: string, config: QueryHistoryConfig): Promise<FullQueryInfo[]> {
    try {
      const data = await fs.readFile(fsPath, 'utf8');
      const queries = JSON.parse(data);
      return queries.map((q: FullQueryInfo) => {

        // Need to explicitly set prototype since reading in from JSON will not
        // do this automatically. Note that we can't call the constructor here since
        // the constructor invokes extra logic that we don't want to do.
        Object.setPrototypeOf(q, FullQueryInfo.prototype);

        // The config object is a global, se we need to set it explicitly
        // and ensure it is not serialized to JSON.
        q.setConfig(config);

        // Date instances are serialized as strings. Need to
        // convert them back to Date instances.
        (q.initialInfo as any).start = new Date(q.initialInfo.start);
        if (q.completedQuery) {
          // Again, need to explicitly set prototypes.
          Object.setPrototypeOf(q.completedQuery, CompletedQueryInfo.prototype);
          Object.setPrototypeOf(q.completedQuery.query, QueryEvaluationInfo.prototype);
          // slurped queries do not need to be disposed
          q.completedQuery.dispose = () => { /**/ };
        }
        return q;
      });
    } catch (e) {
      void showAndLogErrorMessage('Error loading query history.', {
        fullMessage: ['Error loading query history.', e.stack].join('\n'),
      });
      return [];
    }
  }

  /**
   * Save the query history to disk. It is not necessary that the parent directory
   * exists, but if it does, it must be writable. An existing file will be overwritten.
   *
   * Any errors will be rethrown.
   *
   * @param queries the list of queries to save.
   * @param fsPath the path to save the queries to.
   */
  static async splat(queries: FullQueryInfo[], fsPath: string): Promise<void> {
    try {
      const data = JSON.stringify(queries, null, 2);
      await fs.mkdirp(path.dirname(fsPath));
      await fs.writeFile(fsPath, data);
    } catch (e) {
      throw new Error(`Error saving query history to ${fsPath}: ${e.message}`);
    }
  }

  public failureReason: string | undefined;
  public completedQuery: CompletedQueryInfo | undefined;
  private config: QueryHistoryConfig | undefined;

  /**
   * Note that in the {@link FullQueryInfo.slurp} method, we create a FullQueryInfo instance
   * by explicitly setting the prototype in order to avoid calling this constructor.
   */
  constructor(
    public readonly initialInfo: InitialQueryInfo,
    config: QueryHistoryConfig,
    private readonly source?: CancellationTokenSource
  ) {
    this.setConfig(config);
  }

  cancel() {
    this.source?.cancel();
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
    return this.interpolate(
      this.initialInfo.userSpecifiedLabel ?? this.config?.format ?? ''
    );
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

  /**
   * The `config` property must not be serialized since it contains a listerner
   * for global configuration changes. Instead, It should be set when the query
   * is deserialized.
   *
   * @param config the global query history config object
   */
  private setConfig(config: QueryHistoryConfig) {
    // avoid serializing config property
    Object.defineProperty(this, 'config', {
      enumerable: false,
      writable: false,
      configurable: true,
      value: config
    });
  }
}
