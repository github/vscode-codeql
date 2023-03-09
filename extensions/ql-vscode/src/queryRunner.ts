import { CancellationToken } from "vscode";
import { CodeQLCliServer } from "./cli";
import { ProgressCallback } from "./commandRunner";
import { DatabaseItem } from "./local-databases";
import { InitialQueryInfo, LocalQueryInfo } from "./query-results";
import { QueryWithResults } from "./run-queries-shared";

export interface DatabaseDetails {
  path: string;
  hasMetadataFile: boolean;
  dbSchemePath: string;
  datasetPath: string;
  name: string;
}

export async function validateDatabase(
  dbItem: DatabaseItem,
): Promise<DatabaseDetails> {
  if (!dbItem.contents || !dbItem.contents.dbSchemeUri) {
    throw new Error(
      `Database ${dbItem.databaseUri} does not have a CodeQL database scheme.`,
    );
  }

  if (dbItem.error) {
    throw new Error("Can't run query on invalid database.");
  }

  return {
    path: dbItem.databaseUri.fsPath,
    hasMetadataFile: await dbItem.hasMetadataFile(),
    dbSchemePath: dbItem.contents.dbSchemeUri.fsPath,
    datasetPath: dbItem.contents.datasetUri.fsPath,
    name: dbItem.name,
  };
}

export abstract class QueryRunner {
  abstract restartQueryServer(
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<void>;

  abstract cliServer: CodeQLCliServer;

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

  abstract compileAndRunQueryAgainstDatabase(
    db: DatabaseDetails,
    initialInfo: InitialQueryInfo,
    queryStorageDir: string,
    progress: ProgressCallback,
    token: CancellationToken,
    templates?: Record<string, string>,
    queryInfo?: LocalQueryInfo, // May be omitted for queries not initiated by the user. If omitted we won't create a structured log for the query.
  ): Promise<QueryWithResults>;

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
}
