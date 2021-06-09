import * as vscode from 'vscode';
import { getOnDiskWorkspaceFolders, showAndLogErrorMessage } from './helpers';
import { ProgressCallback, UserCancellationException } from './commandRunner';
import { logger } from './logging';
import * as messages from './pure/messages';
import * as qsClient from './queryserver-client';
import { upgradesTmpDir } from './run-queries';
import * as tmp from 'tmp-promise';
import * as path from 'path';
import * as semver from 'semver';
import { DatabaseItem } from './databases';

/**
 * Maximum number of lines to include from database upgrade message,
 * to work around the fact that we can't guarantee a scrollable text
 * box for it when displaying in dialog boxes.
 */
const MAX_UPGRADE_MESSAGE_LINES = 10;

/**
 * Check that we support non-destructive upgrades.
 *
 * This requires 3 features. The ability to compile an upgrade sequence; The ability to
 * run a non-destructive upgrades as a query; the ability to specify a target when
 * resolving upgrades. We check for a version of codeql that has all three features.
 */
export async function hasNondestructiveUpgradeCapabilities(qs: qsClient.QueryServerClient): Promise<boolean> {
  return semver.gte(await qs.cliServer.getVersion(), '2.4.2');
}


/**
 * Compile a database upgrade sequence.
 * Callers must check that this is valid with the current queryserver first.
 */
export async function compileDatabaseUpgradeSequence(
  qs: qsClient.QueryServerClient,
  db: DatabaseItem,
  resolvedSequence: string[],
  currentUpgradeTmp: tmp.DirectoryResult,
  progress: ProgressCallback,
  token: vscode.CancellationToken
): Promise<messages.CompileUpgradeSequenceResult> {
  if (db.contents === undefined || db.contents.dbSchemeUri === undefined) {
    throw new Error('Database is invalid, and cannot be upgraded.');
  }
  if (!await hasNondestructiveUpgradeCapabilities(qs)) {
    throw new Error('The version of codeql is too old to run non-destructive upgrades.');
  }
  // If possible just compile the upgrade sequence
  return await qs.sendRequest(messages.compileUpgradeSequence, {
    upgradeTempDir: currentUpgradeTmp.path,
    upgradePaths: resolvedSequence
  }, token, progress);
}

async function compileDatabaseUpgrade(
  qs: qsClient.QueryServerClient,
  db: DatabaseItem,
  targetDbScheme: string,
  resolvedSequence: string[],
  currentUpgradeTmp: tmp.DirectoryResult,
  progress: ProgressCallback,
  token: vscode.CancellationToken
): Promise<messages.CompileUpgradeResult> {
  if (!db.contents?.dbSchemeUri) {
    throw new Error('Database is invalid, and cannot be upgraded.');
  }
  // We have the upgrades we want but compileUpgrade
  // requires searching for them.  So we use the parent directories of the upgrades
  // as the upgrade path.
  const parentDirs = resolvedSequence.map(dir => path.dirname(dir));
  const uniqueParentDirs = new Set(parentDirs);
  progress({
    step: 1,
    maxStep: 3,
    message: 'Checking for database upgrades'
  });
  return qs.sendRequest(messages.compileUpgrade, {
    upgrade: {
      fromDbscheme: db.contents.dbSchemeUri.fsPath,
      toDbscheme: targetDbScheme,
      additionalUpgrades: Array.from(uniqueParentDirs)
    },
    upgradeTempDir: currentUpgradeTmp.path,
    singleFileUpgrades: true,
  }, token, progress);
}

/**
 * Checks whether the user wants to proceed with the upgrade.
 * Reports errors to both the user and the console.
 */
async function checkAndConfirmDatabaseUpgrade(
  compiled: messages.CompiledUpgrades,
  db: DatabaseItem,
  quiet: boolean
): Promise<void> {

  let descriptionMessage = '';
  const descriptions = getUpgradeDescriptions(compiled);
  for (const script of descriptions) {
    descriptionMessage += `Would perform upgrade: ${script.description}\n`;
    descriptionMessage += `\t-> Compatibility: ${script.compatibility}\n`;
  }
  void logger.log(descriptionMessage);


  // If the quiet flag is set, do the upgrade without a popup.
  if (quiet) {
    return;
  }

  // Ask the user to confirm the upgrade.

  const showLogItem: vscode.MessageItem = { title: 'No, Show Changes', isCloseAffordance: true };
  const yesItem = { title: 'Yes', isCloseAffordance: false };
  const noItem = { title: 'No', isCloseAffordance: true };
  const dialogOptions: vscode.MessageItem[] = [yesItem, noItem];

  let messageLines = descriptionMessage.split('\n');
  if (messageLines.length > MAX_UPGRADE_MESSAGE_LINES) {
    messageLines = messageLines.slice(0, MAX_UPGRADE_MESSAGE_LINES);
    messageLines.push('The list of upgrades was truncated, click "No, Show Changes" to see the full list.');
    dialogOptions.push(showLogItem);
  }

  const message = `Should the database ${db.databaseUri.fsPath} be upgraded?\n\n${messageLines.join('\n')}`;
  const chosenItem = await vscode.window.showInformationMessage(message, { modal: true }, ...dialogOptions);

  if (chosenItem === showLogItem) {
    logger.outputChannel.show();
  }

  if (chosenItem !== yesItem) {
    throw new UserCancellationException('User cancelled the database upgrade.');
  }
}

/**
 * Get the descriptions from a compiled upgrade
 */
function getUpgradeDescriptions(compiled: messages.CompiledUpgrades): messages.UpgradeDescription[] {
  // We use the presence of compiledUpgradeFile to check
  // if it is multifile or not. We need to explicitly check undefined
  // as the types claim the empty string is a valid value
  if (compiled.compiledUpgradeFile === undefined) {
    return compiled.scripts.map(script => script.description);
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
  db: DatabaseItem,
  progress: ProgressCallback,
  token: vscode.CancellationToken,
): Promise<messages.RunUpgradeResult | undefined> {

  const searchPath: string[] = getOnDiskWorkspaceFolders();

  if (!db?.contents?.dbSchemeUri) {
    throw new Error('Database is invalid, and cannot be upgraded.');
  }
  const upgradeInfo = await qs.cliServer.resolveUpgrades(
    db.contents.dbSchemeUri.fsPath,
    searchPath,
    false
  );

  const { scripts, finalDbscheme } = upgradeInfo;

  if (finalDbscheme === undefined) {
    throw new Error('Could not determine target dbscheme to upgrade to.');
  }
  const currentUpgradeTmp = await tmp.dir({ dir: upgradesTmpDir.name, prefix: 'upgrade_', keep: false, unsafeCleanup: true });
  try {
    let compileUpgradeResult: messages.CompileUpgradeResult;
    try {
      compileUpgradeResult = await compileDatabaseUpgrade(qs, db, finalDbscheme, scripts, currentUpgradeTmp, progress, token);
    }
    catch (e) {
      void showAndLogErrorMessage(`Compilation of database upgrades failed: ${e}`);
      return;
    }
    finally {
      void qs.logger.log('Done compiling database upgrade.');
    }

    if (!compileUpgradeResult.compiledUpgrades) {
      const error = compileUpgradeResult.error || '[no error message available]';
      void showAndLogErrorMessage(`Compilation of database upgrades failed: ${error}`);
      return;
    }

    await checkAndConfirmDatabaseUpgrade(compileUpgradeResult.compiledUpgrades, db, qs.cliServer.quiet);

    try {
      void qs.logger.log('Running the following database upgrade:');

      getUpgradeDescriptions(compileUpgradeResult.compiledUpgrades).map(s => s.description).join('\n');
      return await runDatabaseUpgrade(qs, db, compileUpgradeResult.compiledUpgrades, progress, token);
    }
    catch (e) {
      void showAndLogErrorMessage(`Database upgrade failed: ${e}`);
      return;
    } finally {
      void qs.logger.log('Done running database upgrade.');
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
    throw new Error('Can\'t upgrade an invalid database.');
  }
  const database: messages.Dataset = {
    dbDir: db.contents.datasetUri.fsPath,
    workingSet: 'default'
  };

  const params: messages.RunUpgradeParams = {
    db: database,
    timeoutSecs: qs.config.timeoutSecs,
    toRun: upgrades
  };

  return qs.sendRequest(messages.runUpgrade, params, token, progress);
}
