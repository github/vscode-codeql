import { CancellationToken } from "vscode";
import { CodeQLCliServer } from "../../codeql-cli/cli";
import { ProgressCallback } from "../../common/vscode/progress";
import { Logger } from "../../common/logging";
import { DatabaseItem } from "../../databases/local-databases";
import {
  Dataset,
  deregisterDatabases,
  registerDatabases,
} from "../legacy-messages";
import {
  CoreQueryResults,
  CoreQueryTarget,
  QueryRunner,
} from "../query-runner";
import { QueryOutputDir } from "../../run-queries-shared";
import { QueryServerClient } from "./query-server-client";
import {
  clearCacheInDatabase,
  compileAndRunQueryAgainstDatabaseCore,
} from "./run-queries";
import { upgradeDatabaseExplicit } from "./upgrades";

export class LegacyQueryRunner extends QueryRunner {
  constructor(public readonly qs: QueryServerClient) {
    super();
  }

  get cliServer(): CodeQLCliServer {
    return this.qs.cliServer;
  }

  get customLogDirectory(): string | undefined {
    return undefined;
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
    await clearCacheInDatabase(this.qs, dbItem, token);
  }

  public async compileAndRunQueryAgainstDatabaseCore(
    dbPath: string,
    query: CoreQueryTarget,
    additionalPacks: string[],
    extensionPacks: string[] | undefined,
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
      outputDir,
      progress,
      token,
      templates,
      logger,
    );
  }

  async deregisterDatabase(dbItem: DatabaseItem): Promise<void> {
    if (dbItem.contents) {
      const databases: Dataset[] = [
        {
          dbDir: dbItem.contents.datasetUri.fsPath,
          workingSet: "default",
        },
      ];
      await this.qs.sendRequest(deregisterDatabases, { databases });
    }
  }
  async registerDatabase(dbItem: DatabaseItem): Promise<void> {
    if (dbItem.contents) {
      const databases: Dataset[] = [
        {
          dbDir: dbItem.contents.datasetUri.fsPath,
          workingSet: "default",
        },
      ];
      await this.qs.sendRequest(registerDatabases, { databases });
    }
  }

  async upgradeDatabaseExplicit(
    dbItem: DatabaseItem,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void> {
    await upgradeDatabaseExplicit(this.qs, dbItem, progress, token);
  }

  async clearPackCache(): Promise<void> {
    /**
     * Nothing needs to be done
     */
  }
}
