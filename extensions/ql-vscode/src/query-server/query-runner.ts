import vscode, { CancellationToken } from "vscode";
import { CodeQLCliServer } from "../codeql-cli/cli";
import {
  ProgressCallback,
  UserCancellationException,
} from "../common/vscode/progress";
import { DatabaseItem } from "../databases/local-databases";
import { QueryOutputDir } from "../run-queries-shared";
import {
  clearCache,
  ClearCacheParams,
  clearPackCache,
  deregisterDatabases,
  Position,
  QueryResultType,
  registerDatabases,
  trimCache,
  TrimCacheParams,
  upgradeDatabase,
} from "./messages";
import { BaseLogger, Logger } from "../common/logging";
import { basename, join } from "path";
import { nanoid } from "nanoid";
import { QueryServerClient } from "./query-server-client";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { compileAndRunQueryAgainstDatabaseCore } from "./run-queries";

export interface CoreQueryTarget {
  /** The full path to the query. */
  queryPath: string;
  /**
   * Optional position of text to be used as QuickEval target. This need not be in the same file as
   * `query`.
   */
  quickEvalPosition?: Position;
  /**
   * If this is quick eval, whether to only count the number of results.
   */
  quickEvalCountOnly?: boolean;
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

export class QueryRunner {
  constructor(public readonly qs: QueryServerClient) {}

  get cliServer(): CodeQLCliServer {
    return this.qs.cliServer;
  }

  get customLogDirectory(): string | undefined {
    return this.qs.config.customLogDirectory;
  }

  get logger(): Logger {
    return this.qs.logger;
  }

  async restartQueryServer(
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> {
    await this.qs.restartQueryServer(progress, token);
  }

  onStart(
    callBack: (
      progress: ProgressCallback,
      token: CancellationToken,
    ) => Promise<void>,
  ) {
    this.qs.onDidStartQueryServer(callBack);
  }

  async clearCacheInDatabase(
    dbItem: DatabaseItem,
    token: CancellationToken,
  ): Promise<void> {
    if (dbItem.contents === undefined) {
      throw new Error("Can't clear the cache in an invalid database.");
    }

    const db = dbItem.databaseUri.fsPath;
    const params: ClearCacheParams = {
      dryRun: false,
      db,
    };
    await this.qs.sendRequest(clearCache, params, token);
  }

  async trimCacheInDatabase(
    dbItem: DatabaseItem,
    token: CancellationToken,
  ): Promise<void> {
    if (dbItem.contents === undefined) {
      throw new Error("Can't trim the cache in an invalid database.");
    }

    const db = dbItem.databaseUri.fsPath;
    const params: TrimCacheParams = {
      db,
    };
    await this.qs.sendRequest(trimCache, params, token);
  }

  public async compileAndRunQueryAgainstDatabaseCore(
    dbPath: string,
    query: CoreQueryTarget,
    additionalPacks: string[],
    extensionPacks: string[] | undefined,
    additionalRunQueryArgs: Record<string, any>,
    generateEvalLog: boolean,
    outputDir: QueryOutputDir,
    progress: ProgressCallback,
    token: CancellationToken,
    templates: Record<string, string> | undefined,
    logger: BaseLogger,
  ): Promise<CoreQueryResults> {
    return await compileAndRunQueryAgainstDatabaseCore(
      this.qs,
      dbPath,
      query,
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
    const dialogOptions: vscode.MessageItem[] = [yesItem, noItem];

    const message = `Should the database ${dbItem.databaseUri.fsPath} be destructively upgraded?\n\nThis should not be necessary to run queries
    as we will non-destructively update it anyway.`;
    const chosenItem = await vscode.window.showInformationMessage(
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
    query: CoreQueryTarget,
    generateEvalLog: boolean,
    additionalPacks: string[],
    extensionPacks: string[] | undefined,
    additionalRunQueryArgs: Record<string, any>,
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
