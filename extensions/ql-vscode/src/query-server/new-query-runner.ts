import { CancellationToken } from "vscode";
import {
  ProgressCallback,
  UserCancellationException,
} from "../common/vscode/progress";
import { DatabaseItem } from "../databases/local-databases";
import {
  clearCache,
  ClearCacheParams,
  clearPackCache,
  deregisterDatabases,
  registerDatabases,
  upgradeDatabase,
} from "./new-messages";
import { CoreQueryResults, CoreQueryTarget, QueryRunner } from "./query-runner";
import { QueryServerClient } from "./query-server-client";
import { compileAndRunQueryAgainstDatabaseCore } from "./run-queries";
import * as vscode from "vscode";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { Logger } from "../common/logging";
import { QueryOutputDir } from "../run-queries-shared";

export class NewQueryRunner extends QueryRunner {
  constructor(public readonly qs: QueryServerClient) {
    super();
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
    logger: Logger,
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
}
