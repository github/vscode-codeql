import type { CancellationToken, Uri } from "vscode";
import type { CodeQLCliServer, TestCompleted } from "../codeql-cli/cli";
import type {
  DatabaseItem,
  DatabaseManager,
} from "../databases/local-databases";
import { getOnDiskWorkspaceFolders } from "../common/vscode/workspace-folders";
import { asError, getErrorMessage } from "../common/helpers-pure";
import { redactableError } from "../common/errors";
import { access } from "fs-extra";
import { extLogger } from "../common/logging/vscode";
import type { BaseLogger } from "../common/logging";
import {
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
} from "../common/logging";
import { DisposableObject } from "../common/disposable-object";
import { telemetryListener } from "../common/vscode/telemetry";

async function isFileAccessible(uri: Uri): Promise<boolean> {
  try {
    await access(uri.fsPath);
    return true;
  } catch {
    return false;
  }
}

export class TestRunner extends DisposableObject {
  public constructor(
    private readonly databaseManager: DatabaseManager,
    private readonly cliServer: CodeQLCliServer,
  ) {
    super();
  }

  public async run(
    tests: string[],
    logger: BaseLogger,
    token: CancellationToken,
    eventHandler: (event: TestCompleted) => Promise<void>,
  ): Promise<void> {
    const currentDatabaseUri =
      this.databaseManager.currentDatabaseItem?.databaseUri;
    const databasesUnderTest: DatabaseItem[] = [];
    for (const database of this.databaseManager.databaseItems) {
      for (const test of tests) {
        if (await database.isAffectedByTest(test)) {
          databasesUnderTest.push(database);
          break;
        }
      }
    }

    await this.removeDatabasesBeforeTests(databasesUnderTest);
    try {
      const workspacePaths = getOnDiskWorkspaceFolders();
      for await (const event of this.cliServer.runTests(tests, workspacePaths, {
        cancellationToken: token,
        logger,
      })) {
        await eventHandler(event);
      }
    } catch {
      // CodeQL testing can throw exception even in normal scenarios. For example, if the test run
      // produces no output (which is normal), the testing command would throw an exception on
      // unexpected EOF during json parsing. So nothing needs to be done here - all the relevant
      // error information (if any) should have already been written to the test logger.
    } finally {
      await this.reopenDatabasesAfterTests(
        databasesUnderTest,
        currentDatabaseUri,
      );
    }
  }

  private async removeDatabasesBeforeTests(
    databasesUnderTest: DatabaseItem[],
  ): Promise<void> {
    for (const database of databasesUnderTest) {
      try {
        await this.databaseManager.removeDatabaseItem(database);
      } catch (e) {
        // This method is invoked from Test Explorer UI, and testing indicates that Test
        // Explorer UI swallows any thrown exception without reporting it to the user.
        // So we need to display the error message ourselves and then rethrow.
        void showAndLogExceptionWithTelemetry(
          extLogger,
          telemetryListener,
          redactableError(asError(e))`Cannot remove database ${
            database.name
          }: ${getErrorMessage(e)}`,
        );
        throw e;
      }
    }
  }

  private async reopenDatabasesAfterTests(
    databasesUnderTest: DatabaseItem[],
    currentDatabaseUri: Uri | undefined,
  ): Promise<void> {
    for (const closedDatabase of databasesUnderTest) {
      const uri = closedDatabase.databaseUri;
      if (await isFileAccessible(uri)) {
        try {
          const reopenedDatabase = await this.databaseManager.openDatabase(
            uri,
            closedDatabase.origin,
            false,
          );
          await this.databaseManager.renameDatabaseItem(
            reopenedDatabase,
            closedDatabase.name,
          );
          if (currentDatabaseUri?.toString() === uri.toString()) {
            await this.databaseManager.setCurrentDatabaseItem(
              reopenedDatabase,
              true,
            );
          }
        } catch (e) {
          // This method is invoked from Test Explorer UI, and testing indicates that Test
          // Explorer UI swallows any thrown exception without reporting it to the user.
          // So we need to display the error message ourselves and then rethrow.
          void showAndLogWarningMessage(
            extLogger,
            `Cannot reopen database ${uri}: ${e}`,
          );
          throw e;
        }
      }
    }
  }
}
