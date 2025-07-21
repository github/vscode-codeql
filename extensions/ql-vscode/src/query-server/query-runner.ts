import { window, Uri } from "vscode";
import type { CancellationToken, MessageItem } from "vscode";
import type { CodeQLCliServer } from "../codeql-cli/cli";
import type { ProgressCallback } from "../common/vscode/progress";
import { UserCancellationException } from "../common/vscode/progress";
import type { DatabaseItem } from "../databases/local-databases/database-item";
import { QueryOutputDir } from "../local-queries/query-output-dir";
import type {
  ClearCacheMode,
  ClearCacheParams,
  Position,
  QueryResultType,
  TrimCacheParams,
  TrimCacheWithModeParams,
} from "./messages";
import {
  clearCache,
  clearPackCache,
  deregisterDatabases,
  registerDatabases,
  trimCache,
  trimCacheWithMode,
  upgradeDatabase,
} from "./messages";
import type { BaseLogger, Logger } from "../common/logging";
import { join } from "path";
import { nanoid } from "nanoid";
import type { QueryServerClient } from "./query-server-client";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { compileAndRunQueryAgainstDatabaseCore } from "./run-queries";

export interface CoreQueryTarget {
  /** Path to the query source file. */
  queryPath: string;

  /**
   * Base name to use for output files, without extension. For example, "foo" will result in the
   * BQRS file being written to "<outputdir>/foo.bqrs".
   */
  outputBaseName: string;

  /**
   * Optional position of text to be used as QuickEval target. This need not be in the same file as
   * `queryPath`.
   */
  quickEvalPosition?: Position;
  /**
   * If this is quick eval, whether to only count the number of results.
   */
  quickEvalCountOnly?: boolean;
}

export interface CoreQueryResult {
  readonly resultType: QueryResultType;
  readonly message: string | undefined;
  readonly evaluationTime: number;

  /**
   * The base name of the output file. Append '.bqrs' and join with the output directory to get the
   * path to the BQRS.
   */
  readonly outputBaseName: string;
}

export interface CoreQueryResults {
  /** A map from query path to its results. */
  readonly results: Map<string, CoreQueryResult>;
}

export interface CoreQueryRun {
  readonly queryTargets: CoreQueryTarget[];
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

type OnQueryRunStartingListener = (dbPath: Uri) => Promise<void>;
export class QueryRunner {
  constructor(public readonly qs: QueryServerClient) {}

  // Event handlers that get notified whenever a query is about to start running.
  // Can't use vscode EventEmitters since they are not asynchronous.
  private readonly onQueryRunStartingListeners: OnQueryRunStartingListener[] =
    [];
  public onQueryRunStarting(listener: OnQueryRunStartingListener) {
    this.onQueryRunStartingListeners.push(listener);
  }

  private async fireQueryRunStarting(dbPath: Uri) {
    await Promise.all(this.onQueryRunStartingListeners.map((l) => l(dbPath)));
  }

  get cliServer(): CodeQLCliServer {
    return this.qs.cliServer;
  }

  get customLogDirectory(): string | undefined {
    return this.qs.config.customLogDirectory;
  }

  get logger(): Logger {
    return this.qs.logger;
  }

  async restartQueryServer(progress: ProgressCallback): Promise<void> {
    await this.qs.restartQueryServer(progress);
  }

  onStart(callBack: (progress: ProgressCallback) => Promise<void>) {
    this.qs.onDidStartQueryServer(callBack);
  }

  async clearCacheInDatabase(dbItem: DatabaseItem): Promise<void> {
    if (dbItem.contents === undefined) {
      throw new Error("Can't clear the cache in an invalid database.");
    }

    const db = dbItem.databaseUri.fsPath;
    const params: ClearCacheParams = {
      dryRun: false,
      db,
    };
    await this.qs.sendRequest(clearCache, params);
  }

  async trimCacheInDatabase(dbItem: DatabaseItem): Promise<void> {
    if (dbItem.contents === undefined) {
      throw new Error("Can't trim the cache in an invalid database.");
    }

    const db = dbItem.databaseUri.fsPath;
    const params: TrimCacheParams = {
      db,
    };
    await this.qs.sendRequest(trimCache, params);
  }

  async trimCacheWithModeInDatabase(
    dbItem: DatabaseItem,
    mode: ClearCacheMode,
  ): Promise<void> {
    if (dbItem.contents === undefined) {
      throw new Error("Can't clean the cache in an invalid database.");
    }

    const db = dbItem.databaseUri.fsPath;
    const params: TrimCacheWithModeParams = {
      db,
      mode,
    };
    await this.qs.sendRequest(trimCacheWithMode, params);
  }

  public async compileAndRunQueryAgainstDatabaseCore(
    dbPath: string,
    queries: CoreQueryTarget[],
    additionalPacks: string[],
    extensionPacks: string[] | undefined,
    additionalRunQueryArgs: Record<string, unknown>,
    generateEvalLog: boolean,
    outputDir: QueryOutputDir,
    progress: ProgressCallback,
    token: CancellationToken,
    templates: Record<string, string> | undefined,
    logger: BaseLogger,
  ): Promise<CoreQueryResults> {
    await this.fireQueryRunStarting(Uri.file(dbPath));

    return await compileAndRunQueryAgainstDatabaseCore(
      this.qs,
      dbPath,
      queries,
      generateEvalLog,
      additionalPacks,
      extensionPacks,
      additionalRunQueryArgs,
      outputDir,
      progress,
      token,
      templates,
      logger,
    );
  }

  async deregisterDatabase(dbItem: DatabaseItem): Promise<void> {
    if (dbItem.contents) {
      const databases: string[] = [dbItem.databaseUri.fsPath];
      await this.qs.sendRequest(deregisterDatabases, { databases });
    }
  }
  async registerDatabase(dbItem: DatabaseItem): Promise<void> {
    if (dbItem.contents) {
      const databases: string[] = [dbItem.databaseUri.fsPath];
      await this.qs.sendRequest(registerDatabases, { databases });
    }
  }

  async clearPackCache(): Promise<void> {
    await this.qs.sendRequest(clearPackCache, {});
  }

  async upgradeDatabaseExplicit(
    dbItem: DatabaseItem,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> {
    const yesItem = { title: "Yes", isCloseAffordance: false };
    const noItem = { title: "No", isCloseAffordance: true };
    const dialogOptions: MessageItem[] = [yesItem, noItem];

    const message = `Should the database ${dbItem.databaseUri.fsPath} be destructively upgraded?\n\nThis should not be necessary to run queries
    as we will non-destructively update it anyway.`;
    const chosenItem = await window.showInformationMessage(
      message,
      { modal: true },
      ...dialogOptions,
    );

    if (chosenItem !== yesItem) {
      throw new UserCancellationException(
        "User cancelled the database upgrade.",
      );
    }
    await this.qs.sendRequest(
      upgradeDatabase,
      {
        db: dbItem.databaseUri.fsPath,
        additionalPacks: getOnDiskWorkspaceFolders(),
      },
      token,
      progress,
    );
  }

  /**
   * Create a `CoreQueryRun` object. This creates an object whose `evaluate()` function can be
   * called to actually evaluate the query. The returned object also contains information about the
   * query evaluation that is known even before evaluation starts, including the unique ID of the
   * evaluation and the path to its output directory.
   */
  public createQueryRun(
    dbPath: string,
    queries: CoreQueryTarget[],
    generateEvalLog: boolean,
    additionalPacks: string[],
    extensionPacks: string[] | undefined,
    additionalRunQueryArgs: Record<string, unknown>,
    queryStorageDir: string,
    queryBasename: string,
    templates: Record<string, string> | undefined,
  ): CoreQueryRun {
    const id = `${queryBasename}-${nanoid()}`;
    const outputDir = new QueryOutputDir(join(queryStorageDir, id));

    return {
      queryTargets: queries,
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
          queryTargets: queries,
          ...(await this.compileAndRunQueryAgainstDatabaseCore(
            dbPath,
            queries,
            additionalPacks,
            extensionPacks,
            additionalRunQueryArgs,
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
