import { CancellationToken } from "vscode";
import { CodeQLCliServer } from "./cli";
import { ProgressCallback } from "./progress";
import { DatabaseItem } from "./local-databases";
import { QueryOutputDir } from "./run-queries-shared";
import { Position, QueryResultType } from "./pure/new-messages";
import { BaseLogger, Logger } from "./common";
import { basename, join } from "path";
import { nanoid } from "nanoid";

export interface CoreQueryTarget {
  /** The full path to the query. */
  queryPath: string;
  /**
   * Optional position of text to be used as QuickEval target. This need not be in the same file as
   * `query`.
   */
  quickEvalPosition?: Position;
}

export interface CoreQueryResults {
  readonly resultType: QueryResultType;
  readonly message: string | undefined;
  readonly evaluationTime: number;
}

export interface CoreQueryRun {
  readonly queryTarget: CoreQueryTarget;
  readonly dbPath: string;
  readonly id: string;
  readonly outputDir: QueryOutputDir;

  evaluate(
    progress: ProgressCallback,
    token: CancellationToken,
    logger: BaseLogger,
  ): Promise<CoreCompletedQuery>;
}

/** Includes both the results of the query and the initial information from `CoreQueryRun`. */
export type CoreCompletedQuery = CoreQueryResults &
  Omit<CoreQueryRun, "evaluate">;

export abstract class QueryRunner {
  abstract restartQueryServer(
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void>;

  abstract cliServer: CodeQLCliServer;
  abstract customLogDirectory: string | undefined;
  abstract logger: Logger;

  abstract onStart(
    arg0: (
      progress: ProgressCallback,
      token: CancellationToken,
    ) => Promise<void>,
  ): void;
  abstract clearCacheInDatabase(
    dbItem: DatabaseItem,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void>;

  /**
   * Overridden in subclasses to evaluate the query via the query server and return the results.
   */
  public abstract compileAndRunQueryAgainstDatabaseCore(
    dbPath: string,
    query: CoreQueryTarget,
    additionalPacks: string[],
    extensionPacks: string[] | undefined,
    generateEvalLog: boolean,
    outputDir: QueryOutputDir,
    progress: ProgressCallback,
    token: CancellationToken,
    templates: Record<string, string> | undefined,
    logger: BaseLogger,
  ): Promise<CoreQueryResults>;

  abstract deregisterDatabase(
    progress: ProgressCallback,
    token: CancellationToken,
    dbItem: DatabaseItem,
  ): Promise<void>;

  abstract registerDatabase(
    progress: ProgressCallback,
    token: CancellationToken,
    dbItem: DatabaseItem,
  ): Promise<void>;

  abstract upgradeDatabaseExplicit(
    dbItem: DatabaseItem,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void>;

  abstract clearPackCache(): Promise<void>;

  /**
   * Create a `CoreQueryRun` object. This creates an object whose `evaluate()` function can be
   * called to actually evaluate the query. The returned object also contains information about the
   * query evaluation that is known even before evaluation starts, including the unique ID of the
   * evaluation and the path to its output directory.
   */
  public createQueryRun(
    dbPath: string,
    query: CoreQueryTarget,
    generateEvalLog: boolean,
    additionalPacks: string[],
    extensionPacks: string[] | undefined,
    queryStorageDir: string,
    id = `${basename(query.queryPath)}-${nanoid()}`,
    templates: Record<string, string> | undefined,
  ): CoreQueryRun {
    const outputDir = new QueryOutputDir(join(queryStorageDir, id));

    return {
      queryTarget: query,
      dbPath,
      id,
      outputDir,
      evaluate: async (
        progress: ProgressCallback,
        token: CancellationToken,
        logger: BaseLogger,
      ): Promise<CoreCompletedQuery> => {
        return {
          id,
          outputDir,
          dbPath,
          queryTarget: query,
          ...(await this.compileAndRunQueryAgainstDatabaseCore(
            dbPath,
            query,
            additionalPacks,
            extensionPacks,
            generateEvalLog,
            outputDir,
            progress,
            token,
            templates,
            logger,
          )),
        };
      },
    };
  }
}
