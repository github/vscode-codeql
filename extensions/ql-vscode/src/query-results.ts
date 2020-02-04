import { QueryWithResults, tmpDir, QueryInfo } from "./queries";
import * as messages from './messages';
import * as helpers from './helpers';
import * as cli from './cli';
import * as sarif from 'sarif';
import * as fs from 'fs-extra';
import * as path from 'path';
import { SortState, SortedResultSetInfo, DatabaseInfo, QueryMetadata } from "./interface-types";
import { QueryHistoryConfig } from "./config";
import { QueryHistoryItemOptions } from "./query-history";

export class CompletedQuery implements QueryWithResults {
  readonly time: string;
  readonly query: QueryInfo;
  readonly result: messages.EvaluationResult;
  readonly database: DatabaseInfo;
  options: QueryHistoryItemOptions;
  /**
   * Map from result set name to SortedResultSetInfo.
   */
  sortedResultsInfo: Map<string, SortedResultSetInfo>;


  constructor(
    evalaution: QueryWithResults,
    public config: QueryHistoryConfig,
  ) {
    this.query = evalaution.query;
    this.result = evalaution.result;
    this.database = evalaution.database;
    this.time = new Date().toLocaleString();
    this.sortedResultsInfo = new Map();
    this.options = evalaution.options;
  }

  get databaseName(): string {
    return this.database.name;
  }
  get queryName(): string {
    return helpers.getQueryName(this.query);
  }

  /**
   * Holds if this query should produce interpreted results.
   */
  canInterpretedResults(): Promise<boolean> {
    return this.query.dbItem.hasMetadataFile();
  }

  get statusString(): string {
    switch (this.result.resultType) {
      case messages.QueryResultType.CANCELLATION:
        return `cancelled after ${this.result.evaluationTime / 1000} seconds`;
      case messages.QueryResultType.OOM:
        return `out of memory`;
      case messages.QueryResultType.SUCCESS:
        return `finished in ${this.result.evaluationTime / 1000} seconds`;
      case messages.QueryResultType.TIMEOUT:
        return `timed out after ${this.result.evaluationTime / 1000} seconds`;
      case messages.QueryResultType.OTHER_ERROR:
      default:
        return `failed`;
    }
  }


  interpolate(template: string): string {
    const { databaseName, queryName, time, statusString } = this;
    const replacements: { [k: string]: string } = {
      t: time,
      q: queryName,
      d: databaseName,
      s: statusString,
      '%': '%',
    };
    return template.replace(/%(.)/g, (match, key) => {
      const replacement = replacements[key];
      return replacement !== undefined ? replacement : match;
    });
  }

  getLabel(): string {
    if (this.options.label !== undefined)
      return this.options.label;
    return this.config.format;
  }

  toString(): string {
    return this.interpolate(this.getLabel());
  }
  async updateSortState(server: cli.CodeQLCliServer, resultSetName: string, sortState: SortState | undefined): Promise<void> {
    if (sortState === undefined) {
      this.sortedResultsInfo.delete(resultSetName);
      return;
    }

    const sortedResultSetInfo: SortedResultSetInfo = {
      resultsPath: path.join(tmpDir.name, `sortedResults${this.query.queryID}-${resultSetName}.bqrs`),
      sortState
    };

    await server.sortBqrs(this.query.resultsPaths.resultsPath, sortedResultSetInfo.resultsPath, resultSetName, [sortState.columnIndex], [sortState.direction]);
    this.sortedResultsInfo.set(resultSetName, sortedResultSetInfo);
  }

}

/**
 * Call cli command to interpret results.
 */
export async function interpretResults(server: cli.CodeQLCliServer, metadata: QueryMetadata | undefined, resultsPath: string, sourceInfo?: cli.SourceInfo): Promise<sarif.Log> {
  const interpretedResultsPath = resultsPath + ".interpreted.sarif"

  if (await fs.pathExists(interpretedResultsPath)) {
    return JSON.parse(await fs.readFile(interpretedResultsPath, 'utf8'));
  }
  if (metadata === undefined) {
    throw new Error('Can\'t interpret results without query metadata');
  }
  let { kind, id } = metadata;
  if (kind === undefined) {
    throw new Error('Can\'t interpret results without query metadata including kind');
  }
  if (id === undefined) {
    // Interpretation per se doesn't really require an id, but the
    // SARIF format does, so in the absence of one, we use a dummy id.
    id = "dummy-id";
  }
  return await server.interpretBqrs({ kind, id }, resultsPath, interpretedResultsPath, sourceInfo);
}
