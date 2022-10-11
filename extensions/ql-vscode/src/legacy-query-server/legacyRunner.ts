import { CancellationToken } from 'vscode';
import { ProgressCallback } from '../commandRunner';
import { DatabaseItem } from '../databases';
import { Dataset, deregisterDatabases, registerDatabases } from '../pure/legacy-messages';
import { InitialQueryInfo, LocalQueryInfo } from '../query-results';
import { QueryRunner } from '../queryRunner';
import { QueryWithResults } from '../run-queries-shared';
import { QueryServerClient } from './queryserver-client';
import { clearCacheInDatabase, compileAndRunQueryAgainstDatabase } from './run-queries';
import { upgradeDatabaseExplicit } from './upgrades';

export class LegacyQueryRunner extends QueryRunner {


  constructor(public readonly qs: QueryServerClient) {
    super();
  }

  get cliServer() {
    return this.qs.cliServer;
  }

  async restartQueryServer(progress: ProgressCallback, token: CancellationToken): Promise<void> {
    await this.qs.restartQueryServer(progress, token);
  }

  onStart(callBack: (progress: ProgressCallback, token: CancellationToken) => Promise<void>) {
    this.qs.onDidStartQueryServer(callBack);
  }
  async clearCacheInDatabase(dbItem: DatabaseItem, progress: ProgressCallback, token: CancellationToken): Promise<void> {
    await clearCacheInDatabase(this.qs, dbItem, progress, token);
  }
  async compileAndRunQueryAgainstDatabase(dbItem: DatabaseItem, initialInfo: InitialQueryInfo, queryStorageDir: string, progress: ProgressCallback, token: CancellationToken, templates?: Record<string, string>, queryInfo?: LocalQueryInfo): Promise<QueryWithResults> {
    return await compileAndRunQueryAgainstDatabase(this.qs.cliServer, this.qs, dbItem, initialInfo, queryStorageDir, progress, token, templates, queryInfo);
  }

  async deregisterDatabase(progress: ProgressCallback, token: CancellationToken, dbItem: DatabaseItem): Promise<void> {
    if (dbItem.contents && (await this.qs.cliServer.cliConstraints.supportsDatabaseRegistration())) {
      const databases: Dataset[] = [{
        dbDir: dbItem.contents.datasetUri.fsPath,
        workingSet: 'default'
      }];
      await this.qs.sendRequest(deregisterDatabases, { databases }, token, progress);
    }
  }
  async registerDatabase(progress: ProgressCallback, token: CancellationToken, dbItem: DatabaseItem): Promise<void> {
    if (dbItem.contents && (await this.qs.cliServer.cliConstraints.supportsDatabaseRegistration())) {
      const databases: Dataset[] = [{
        dbDir: dbItem.contents.datasetUri.fsPath,
        workingSet: 'default'
      }];
      await this.qs.sendRequest(registerDatabases, { databases }, token, progress);
    }
  }

  async upgradeDatabaseExplicit(dbItem: DatabaseItem, progress: ProgressCallback, token: CancellationToken): Promise<void> {
    await upgradeDatabaseExplicit(this.qs, dbItem, progress, token);
  }
}
