import * as vscode from "vscode";
import {
  getOnDiskWorkspaceFolders,
  showAndLogExceptionWithTelemetry,
  tmpDir,
} from "../helpers";
import { ProgressCallback, UserCancellationException } from "../commandRunner";
import { extLogger } from "../common";
import * as messages from "../pure/legacy-messages";
import * as qsClient from "./queryserver-client";
import * as tmp from "tmp-promise";
import { dirname } from "path";
import { DatabaseItem } from "../databases";
import { asError } from "../pure/helpers-pure";

/**
 * Maximum number of lines to include from database upgrade message,
 * to work around the fact that we can't guarantee a scrollable text
 * box for it when displaying in dialog boxes.
 */
const MAX_UPGRADE_MESSAGE_LINES = 10;

/**
 * Compile a database upgrade sequence.
 * Callers must check that this is valid with the current queryserver first.
 */
export async function compileDatabaseUpgradeSequence(
  qs: qsClient.QueryServerClient,
  dbItem: DatabaseItem,
  resolvedSequence: string[],
  currentUpgradeTmp: tmp.DirectoryResult,
  progress: ProgressCallback,
  token: vscode.CancellationToken,
): Promise<messages.CompileUpgradeSequenceResult> {
  if (
    dbItem.contents === undefined ||
    dbItem.contents.dbSchemeUri === undefined
  ) {
    throw new Error("Database is invalid, and cannot be upgraded.");
  }
  // If possible just compile the upgrade sequence
  return await qs.sendRequest(
    messages.compileUpgradeSequence,
    {
      upgradeTempDir: currentUpgradeTmp.path,
      upgradePaths: resolvedSequence,
    },
    token,
    progress,
  );
}

async function compileDatabaseUpgrade(
  qs: qsClient.QueryServerClient,
  dbItem: DatabaseItem,
  targetDbScheme: string,
  resolvedSequence: string[],
  currentUpgradeTmp: tmp.DirectoryResult,
  progress: ProgressCallback,
  token: vscode.CancellationToken,
): Promise<messages.CompileUpgradeResult> {
  if (!dbItem.contents?.dbSchemeUri) {
    throw new Error("Database is invalid, and cannot be upgraded.");
  }
  // We have the upgrades we want but compileUpgrade
  // requires searching for them.  So we use the parent directories of the upgrades
  // as the upgrade path.
  const parentDirs = resolvedSequence.map((dir) => dirname(dir));
  const uniqueParentDirs = new Set(parentDirs);
  progress({
    step: 1,
    maxStep: 3,
    message: "Checking for database upgrades",
  });
  return qs.sendRequest(
    messages.compileUpgrade,
    {
      upgrade: {
        fromDbscheme: dbItem.contents.dbSchemeUri.fsPath,
        toDbscheme: targetDbScheme,
        additionalUpgrades: Array.from(uniqueParentDirs),
      },
      upgradeTempDir: currentUpgradeTmp.path,
      singleFileUpgrades: true,
    },
    token,
    progress,
  );
}

/**
 * Checks whether the user wants to proceed with the upgrade.
 * Reports errors to both the user and the console.
 */
async function checkAndConfirmDatabaseUpgrade(
  compiled: messages.CompiledUpgrades,
  db: DatabaseItem,
  quiet: boolean,
): Promise<void> {
  let descriptionMessage = "";
  const descriptions = getUpgradeDescriptions(compiled);
  for (const script of descriptions) {
    descriptionMessage += `Would perform upgrade: ${script.description}\n`;
    descriptionMessage += `\t-> Compatibility: ${script.compatibility}\n`;
  }
  void extLogger.log(descriptionMessage);

  // If the quiet flag is set, do the upgrade without a popup.
  if (quiet) {
    return;
  }

  // Ask the user to confirm the upgrade.

  const showLogItem: vscode.MessageItem = {
    title: "No, Show Changes",
    isCloseAffordance: true,
  };
  const yesItem = { title: "Yes", isCloseAffordance: false };
  const noItem = { title: "No", isCloseAffordance: true };
  const dialogOptions: vscode.MessageItem[] = [yesItem, noItem];

  let messageLines = descriptionMessage.split("\n");
  if (messageLines.length > MAX_UPGRADE_MESSAGE_LINES) {
    messageLines = messageLines.slice(0, MAX_UPGRADE_MESSAGE_LINES);
    messageLines.push(
      'The list of upgrades was truncated, click "No, Show Changes" to see the full list.',
    );
    dialogOptions.push(showLogItem);
  }

  const message = `Should the database ${
    db.databaseUri.fsPath
  } be upgraded?\n\n${messageLines.join("\n")}`;
  const chosenItem = await vscode.window.showInformationMessage(
    message,
    { modal: true },
    ...dialogOptions,
  );

  if (chosenItem === showLogItem) {
    extLogger.outputChannel.show();
  }

  if (chosenItem !== yesItem) {
    throw new UserCancellationException("User cancelled the database upgrade.");
  }
}

/**
 * Get the descriptions from a compiled upgrade
 */
function getUpgradeDescriptions(
  compiled: messages.CompiledUpgrades,
): messages.UpgradeDescription[] {
  // We use the presence of compiledUpgradeFile to check
  // if it is multifile or not. We need to explicitly check undefined
  // as the types claim the empty string is a valid value
  if (compiled.compiledUpgradeFile === undefined) {
    return compiled.scripts.map((script) => script.description);
  } else {
    return compiled.descriptions;
  }
}

/**
 * Command handler for 'Upgrade Database'.
 * Attempts to upgrade the given database to the given target DB scheme, using the given directory of upgrades.
 * First performs a dry-run and prompts the user to confirm the upgrade.
 * Reports errors during compilation and evaluation of upgrades to the user.
 */
export async function upgradeDatabaseExplicit(
  qs: qsClient.QueryServerClient,
  dbItem: DatabaseItem,
  progress: ProgressCallback,
  token: vscode.CancellationToken,
): Promise<messages.RunUpgradeResult | undefined> {
  const searchPath: string[] = getOnDiskWorkspaceFolders();

  if (!dbItem?.contents?.dbSchemeUri) {
    throw new Error("Database is invalid, and cannot be upgraded.");
  }
  const upgradeInfo = await qs.cliServer.resolveUpgrades(
    dbItem.contents.dbSchemeUri.fsPath,
    searchPath,
    false,
  );

  const { scripts, finalDbscheme } = upgradeInfo;

  if (finalDbscheme === undefined) {
    throw new Error("Could not determine target dbscheme to upgrade to.");
  }
  const currentUpgradeTmp = await tmp.dir({
    dir: tmpDir.name,
    prefix: "upgrade_",
    keep: false,
    unsafeCleanup: true,
  });
  try {
    let compileUpgradeResult: messages.CompileUpgradeResult;
    try {
      compileUpgradeResult = await compileDatabaseUpgrade(
        qs,
        dbItem,
        finalDbscheme,
        scripts,
        currentUpgradeTmp,
        progress,
        token,
      );
    } catch (e) {
      void showAndLogExceptionWithTelemetry(
        asError(e),
        "database_upgrade_compilation",
        {
          notificationMessage: `Compilation of database upgrades failed: ${e}`,
        },
      );
      return;
    } finally {
      void qs.logger.log("Done compiling database upgrade.");
    }

    if (!compileUpgradeResult.compiledUpgrades) {
      const error =
        compileUpgradeResult.error || "[no error message available]";
      void showAndLogExceptionWithTelemetry(
        asError(`Compilation of database upgrades failed: ${error}`),
        "database_upgrade_compilation",
      );
      return;
    }

    await checkAndConfirmDatabaseUpgrade(
      compileUpgradeResult.compiledUpgrades,
      dbItem,
      qs.cliServer.quiet,
    );

    try {
      void qs.logger.log("Running the following database upgrade:");

      getUpgradeDescriptions(compileUpgradeResult.compiledUpgrades)
        .map((s) => s.description)
        .join("\n");
      const result = await runDatabaseUpgrade(
        qs,
        dbItem,
        compileUpgradeResult.compiledUpgrades,
        progress,
        token,
      );

      // TODO Can remove the next lines when https://github.com/github/codeql-team/issues/1241 is fixed
      // restart the query server to avoid a bug in the CLI where the upgrade is applied, but the old dbscheme
      // is still cached in memory.

      await qs.restartQueryServer(progress, token);
      return result;
    } catch (e) {
      void showAndLogExceptionWithTelemetry(asError(e), "database_upgrade", {
        notificationMessage: `Database upgrade failed: ${e}`,
      });
      return;
    } finally {
      void qs.logger.log("Done running database upgrade.");
    }
  } finally {
    await currentUpgradeTmp.cleanup();
  }
}

async function runDatabaseUpgrade(
  qs: qsClient.QueryServerClient,
  db: DatabaseItem,
  upgrades: messages.CompiledUpgrades,
  progress: ProgressCallback,
  token: vscode.CancellationToken,
): Promise<messages.RunUpgradeResult> {
  if (db.contents === undefined || db.contents.datasetUri === undefined) {
    throw new Error("Can't upgrade an invalid database.");
  }
  const database: messages.Dataset = {
    dbDir: db.contents.datasetUri.fsPath,
    workingSet: "default",
  };

  const params: messages.RunUpgradeParams = {
    db: database,
    timeoutSecs: qs.config.timeoutSecs,
    toRun: upgrades,
  };

  return qs.sendRequest(messages.runUpgrade, params, token, progress);
}
