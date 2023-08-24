import { CancellationToken } from "vscode";
import { CodeQLCliServer } from "../codeql-cli/cli";
import { ProgressCallback } from "../common/vscode/progress";
import { DatabaseItem } from "../databases/local-databases";
import { CoreCompletedQuery, QueryRunner } from "../query-server";
import { createLockFileForStandardQuery } from "./standard-queries";
import { TeeLogger, showAndLogExceptionWithTelemetry } from "../common/logging";
import { QueryResultType } from "../query-server/new-messages";
import { extLogger } from "../common/logging/vscode";
import { telemetryListener } from "../common/vscode/telemetry";
import { redactableError } from "../common/errors";
import { basename } from "path";

type RunQueryOptions = {
  cliServer: CodeQLCliServer;
  queryRunner: QueryRunner;
  databaseItem: DatabaseItem;
  queryPath: string;
  queryStorageDir: string;
  additionalPacks: string[];
  extensionPacks: string[] | undefined;
  progress: ProgressCallback;
  token: CancellationToken;
};

export async function runQuery({
  cliServer,
  queryRunner,
  databaseItem,
  queryPath,
  queryStorageDir,
  additionalPacks,
  extensionPacks,
  progress,
  token,
}: RunQueryOptions): Promise<CoreCompletedQuery | undefined> {
  // Create a lock file for the query. This is required to resolve dependencies and library path for the query.
  const { cleanup: cleanupLockFile } = await createLockFileForStandardQuery(
    cliServer,
    queryPath,
  );

  // Create a query run to execute
  const queryRun = queryRunner.createQueryRun(
    databaseItem.databaseUri.fsPath,
    {
      queryPath,
      quickEvalPosition: undefined,
      quickEvalCountOnly: false,
    },
    false,
    additionalPacks,
    extensionPacks,
    queryStorageDir,
    undefined,
    undefined,
  );

  const completedQuery = await queryRun.evaluate(
    progress,
    token,
    new TeeLogger(queryRunner.logger, queryRun.outputDir.logPath),
  );

  await cleanupLockFile?.();

  if (completedQuery.resultType !== QueryResultType.SUCCESS) {
    void showAndLogExceptionWithTelemetry(
      extLogger,
      telemetryListener,
      redactableError`Failed to run ${basename(queryPath)} query: ${
        completedQuery.message ?? "No message"
      }`,
    );
    return;
  }
  return completedQuery;
}
