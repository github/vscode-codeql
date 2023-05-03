import { CancellationToken, Uri } from "vscode";
import { CodeQLCliServer, TestCompleted } from "../codeql-cli/cli";
import { DatabaseItem, DatabaseManager } from "../databases/local-databases";
import {
  getOnDiskWorkspaceFolders,
  showAndLogExceptionWithTelemetry,
  showAndLogWarningMessage,
} from "../helpers";
import { asError, getErrorMessage } from "../pure/helpers-pure";
import { redactableError } from "../pure/errors";
import { access } from "fs-extra";
import { BaseLogger } from "../common";
import { DisposableObject } from "../pure/disposable-object";

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

    await this.removeDatabasesBeforeTests(databasesUnderTest, token);
    try {
      const workspacePaths = getOnDiskWorkspaceFolders();
      for await (const event of this.cliServer.runTests(tests, workspacePaths, {
        cancellationToken: token,
        logger,
      })) {
        await eventHandler(event);
      }
    } catch (e) {
      // CodeQL testing can throw exception even in normal scenarios. For example, if the test run
      // produces no output (which is normal), the testing command would throw an exception on
      // unexpected EOF during json parsing. So nothing needs to be done here - all the relevant
      // error information (if any) should have already been written to the test logger.
    } finally {
      await this.reopenDatabasesAfterTests(
        databasesUnderTest,
        currentDatabaseUri,
        token,
      );
    }
  }

  private async removeDatabasesBeforeTests(
    databasesUnderTest: DatabaseItem[],
    token: CancellationToken,
  ): Promise<void> {
    for (const database of databasesUnderTest) {
      try {
        await this.databaseManager.removeDatabaseItem(
          (_) => {
            /* no progress reporting */
          },
          token,
          database,
        );
      } catch (e) {
        // This method is invoked from Test Explorer UI, and testing indicates that Test
        // Explorer UI swallows any thrown exception without reporting it to the user.
        // So we need to display the error message ourselves and then rethrow.
        void showAndLogExceptionWithTelemetry(
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
    token: CancellationToken,
  ): Promise<void> {
    for (const closedDatabase of databasesUnderTest) {
      const uri = closedDatabase.databaseUri;
      if (await isFileAccessible(uri)) {
        try {
          const reopenedDatabase = await this.databaseManager.openDatabase(
            (_) => {
              /* no progress reporting */
            },
            token,
            uri,
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
          void showAndLogWarningMessage(`Cannot reopen database ${uri}: ${e}`);
          throw e;
        }
      }
    }
  }
}
