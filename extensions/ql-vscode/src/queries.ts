import * as path from 'path';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import { ExtensionContext, ProgressLocation, window as Window, workspace } from 'vscode';
import { DatabaseManager, DatabaseItem } from './databases';
import * as qsClient from './queryserver-client';
import { QLConfiguration } from './config';
import { DatabaseInfo } from './interface-types';
import * as messages from './messages';
import * as helpers from './helpers';
import { logger, Logger, queryServerLogger } from './logging';

/**
 * queries.ts
 * -------------
 *
 * Compiling and running QL queries.
 */

// XXX: Tmp directory should be configuarble.
const tmpDir = tmp.dirSync({ prefix: 'queries_', keep: false, unsafeCleanup: true });
const upgradesTmpDir = tmp.dirSync({ dir: tmpDir.name, prefix: 'upgrades_', keep: false, unsafeCleanup: true });
export const tmpDirDisposal = {
  dispose: () => {
    upgradesTmpDir.removeCallback();
    tmpDir.removeCallback();
  }
};

let queryCounter = 0;

/**
 * A collection of evaluation-time information about a query,
 * including the query itself, and where we have decided to put
 * temporary files associated with it, such as the compiled query
 * output and results.
 */
class QueryInfo {
  program: messages.QlProgram;
  quickEvalPosition?: messages.Position;
  compiledQueryPath: string;
  resultsPath: string;
  dbItem: DatabaseItem;
  db: vscode.Uri; // guarantee the existence of a well-defined db dir at this point

  constructor(program: messages.QlProgram, dbItem: DatabaseItem, quickEvalPosition?: messages.Position) {
    this.program = program;
    this.quickEvalPosition = quickEvalPosition;
    this.compiledQueryPath = path.join(tmpDir.name, `compiledQuery${queryCounter}.qlo`);
    this.resultsPath = path.join(tmpDir.name, `results${queryCounter}.bqrs`);
    if (dbItem.contents === undefined) {
      throw new Error('Can\'t run query on invalid snapshot.');
    }
    this.db = dbItem.contents.databaseUri;
    this.dbItem = dbItem;
    queryCounter++;
  }

  async run(
    qs: qsClient.Server,
  ): Promise<messages.EvaluationResult> {
    let result: messages.EvaluationResult | null = null;

    const callbackId = qs.registerCallback(res => { result = res });

    const queryToRun: messages.QueryToRun = {
      resultsPath: this.resultsPath,
      qlo: vscode.Uri.file(this.compiledQueryPath).toString(),
      allowUnknownTemplates: true,
      id: callbackId,
      timeoutSecs: 1000, // XXX timeout should be configurable
    }
    const db: messages.Database = {
      dbDir: this.db.fsPath,
      workingSet: 'default'
    }
    const params: messages.EvaluateQueriesParams = {
      db,
      evaluateId: callbackId,
      queries: [queryToRun],
      stopOnError: false,
      useSequenceHint: false
    }
    try {
      await withProgress({
        location: ProgressLocation.Notification,
        title: "Running Query",
        cancellable: false,
      }, (progress, token) => {
        return qs.sendRequest(messages.runQueries, params, token, progress)
      });
    } finally {
      qs.unRegisterCallback(callbackId);
    }
    return result || { evaluationTime: 0, message: "No result from server", queryId: -1, runId: callbackId, resultType: messages.QueryResultType.OTHER_ERROR };
  }

  async compileAndRun(
    qs: qsClient.Server,
  ): Promise<messages.EvaluationResult> {
    let compiled: messages.CheckQueryResult;
    try {
      const params: messages.CompileQueryParams = {
        compilationOptions: {
          computeNoLocationUrls: true,
          failOnWarnings: false,
          fastCompilation: false,
          includeDilInQlo: true,
          localChecking: false,
          noComputeGetUrl: false,
          noComputeToString: false,
        },
        queryToCheck: this.program,
        resultPath: this.compiledQueryPath,
        target: !!this.quickEvalPosition ? { quickEval: { quickEvalPos: this.quickEvalPosition } } : { query: {} }
      };


      compiled = await withProgress({
        location: ProgressLocation.Notification,
        title: "Compiling Query",
        cancellable: false,
      }, (progress, token) => {
        return qs.sendRequest(messages.compileQuery, params, token, progress);
      });
    } finally {
      qs.log(" - - - COMPILATION DONE - - - ");
    }

    const errors = (compiled.messages || []).filter(msg => msg.severity == 0);
    if (errors.length == 0) {
      return await this.run(qs);
    }
    else {
      errors.forEach(err =>
        Window.showErrorMessage(err.message || "[no error message available]")
      );
      return {
        evaluationTime: 0,
        resultType: messages.QueryResultType.OTHER_ERROR,
        queryId: 0,
        runId: 0,
        message: "Query had compilation errors"
      }
    }
  }
}

export interface EvaluationInfo {
  query: QueryInfo;
  result: messages.EvaluationResult;
  database: DatabaseInfo;
}

/**
 * Start the query server.
 */
export function spawnQueryServer(config: QLConfiguration): qsClient.Server | undefined {
  //TODO: Handle configuration changes, query server crashes, etc.
  const semmleDist = config.qlDistributionPath;
  if (semmleDist) {
    queryServerLogger.log("Starting QL query server using JSON-RPC");
    const server = new qsClient.Server(config.configData, {
      logger: queryServerLogger,
    });
    queryServerLogger.log(`Query server started on pid: ${server.getPid()}`);
    return server;
  } else {
    return undefined;
  }
}

/**
 * This mediates between the kind of progress callbacks we want to
 * write (where we *set* current progress position and give
 * `maxSteps`) and the kind vscode progress api expects us to write
 * (which increment progress by a certain amount out of 100%)
 */
function withProgress<R>(
  options: vscode.ProgressOptions,
  task: (
    progress: (p: messages.ProgressMessage) => void,
    token: vscode.CancellationToken
  ) => Thenable<R>
): Thenable<R> {
  let progressAchieved = 0;
  return Window.withProgress(options,
    (progress, token) => {
      return task(p => {
        const { message, step, maxStep } = p;
        const increment = 100 * (step - progressAchieved) / maxStep;
        progressAchieved = step;
        progress.report({ message, increment });
      }, token);
    });
}

/**
 * Checks whether the given database can be upgraded to the given target DB scheme,
 * and whether the user wants to proceed with the upgrade.
 * Reports errors to both the user and the console.
 * @returns the `UpgradeParams` needed to start the upgrade, if the upgrade is possible and was confirmed by the user, or `undefined` otherwise.
 */
async function checkAndConfirmDatabaseUpgrade(qs: qsClient.Server, db: DatabaseItem, targetDbScheme: vscode.Uri, upgradesDirectory: vscode.Uri):
  Promise<messages.UpgradeParams | undefined> {
  if (db.contents === undefined || db.contents.dbSchemeUri === undefined) {
    helpers.showAndLogErrorMessage("Database is invalid, and cannot be upgraded.")
    return;
  }
  const params: messages.UpgradeParams = {
    fromDbscheme: db.contents.dbSchemeUri.fsPath,
    toDbscheme: targetDbScheme.fsPath,
    additionalUpgrades: [upgradesDirectory.fsPath]
  };

  let checkUpgradeResult: messages.CheckUpgradeResult;
  try {
    qs.log('Checking database upgrade...');
    checkUpgradeResult = await checkDatabaseUpgrade(qs, params);
  }
  catch (e) {
    helpers.showAndLogErrorMessage(`Database cannot be upgraded: ${e}`);
    return;
  }
  finally {
    qs.log('Done checking database upgrade.')
  }

  const checkedUpgrades = checkUpgradeResult.checkedUpgrades;
  if (checkedUpgrades === undefined) {
    const error = checkUpgradeResult.upgradeError || '[no error message available]';
    await helpers.showAndLogErrorMessage(`Database cannot be upgraded: ${error}`);
    return;
  }

  if (checkedUpgrades.scripts.length === 0) {
    await helpers.showAndLogInformationMessage('Database is already up to date; nothing to do.');
    return;
  }

  let curSha = checkedUpgrades.initialSha;
  let descriptionMessage = '';
  for (const script of checkedUpgrades.scripts) {
    descriptionMessage += `Would perform upgrade: ${script.description}\n`;
    descriptionMessage += `\t-> Compatibility: ${script.compatibility}\n`;
    curSha = script.newSha;
  }

  const targetSha = checkedUpgrades.targetSha;
  if (curSha != targetSha) {
    // Newlines aren't rendered in notifications: https://github.com/microsoft/vscode/issues/48900
    // A modal dialog would be rendered better, but is more intrusive.
    await helpers.showAndLogErrorMessage(`Database cannot be upgraded to the target database scheme.
    Can upgrade from ${checkedUpgrades.initialSha} (current) to ${curSha}, but cannot reach ${targetSha} (target).`);
    // TODO: give a more informative message if we think the DB is ahead of the target DB scheme
    return;
  }

  logger.log(descriptionMessage);
  // Ask the user to confirm the upgrade.
  const shouldUpgrade = await helpers.showBinaryChoiceDialog(`Should the database ${db.snapshotUri} be upgraded?\n\n${descriptionMessage}`);
  if (shouldUpgrade) {
    return params;
  }
  else {
    logger.log('User cancelled the database upgrade.');
    return;
  }
}

/**
 * Command handler for 'Upgrade Database'.
 * Attempts to upgrade the given database to the given target DB scheme, using the given directory of upgrades.
 * First performs a dry-run and prompts the user to confirm the upgrade.
 * Reports errors during compilation and evaluation of upgrades to the user.
 */
export async function upgradeDatabase(qs: qsClient.Server, db: DatabaseItem, targetDbScheme: vscode.Uri, upgradesDirectory: vscode.Uri):
  Promise<messages.RunUpgradeResult | undefined> {
  const upgradeParams = await checkAndConfirmDatabaseUpgrade(qs, db, targetDbScheme, upgradesDirectory);

  if(upgradeParams === undefined) {
    return;
  }
  
  let compileUpgradeResult: messages.CompileUpgradeResult;
  try {
    compileUpgradeResult = await compileDatabaseUpgrade(qs, upgradeParams);
  }
  catch (e) {
    helpers.showAndLogErrorMessage(`Compilation of database upgrades failed: ${e}`);
    return;
  }
  finally {
    qs.log('Done compiling database upgrade.')
  }

  if (compileUpgradeResult.compiledUpgrades === undefined) {
    const error = compileUpgradeResult.error || '[no error message available]';
    helpers.showAndLogErrorMessage(`Compilation of database upgrades failed: ${error}`);
    return;
  }

  try {
    qs.log('Running the following database upgrade:');
    qs.log(compileUpgradeResult.compiledUpgrades.scripts.map(s => s.description.description).join('\n'));
    return await runDatabaseUpgrade(qs, db, compileUpgradeResult.compiledUpgrades);
  }
  catch (e) {
    helpers.showAndLogErrorMessage(`Database upgrade failed: ${e}`);
    return;
  }
  finally {
    qs.log('Done running database upgrade.')
  }
}

async function checkDatabaseUpgrade(qs: qsClient.Server, upgradeParams: messages.UpgradeParams):
  Promise<messages.CheckUpgradeResult> {
  return withProgress({
    location: ProgressLocation.Notification,
    title: "Checking for database upgrades",
    cancellable: true,
  }, (progress, token) => qs.sendRequest(messages.checkUpgrade, upgradeParams, token, progress));
}

async function compileDatabaseUpgrade(qs: qsClient.Server, upgradeParams: messages.UpgradeParams):
  Promise<messages.CompileUpgradeResult> {
  const params: messages.CompileUpgradeParams = {
    upgrade: upgradeParams,
    upgradeTempDir: upgradesTmpDir.name
  }

  return withProgress({
    location: ProgressLocation.Notification,
    title: "Compiling database upgrades",
    cancellable: true,
  }, (progress, token) => qs.sendRequest(messages.compileUpgrade, params, token, progress));
}

async function runDatabaseUpgrade(qs: qsClient.Server, db: DatabaseItem, upgrades: messages.CompiledUpgrades):
  Promise<messages.RunUpgradeResult> {

  if (db.contents === undefined || db.contents.databaseUri === undefined) {
    throw new Error('Can\'t upgrade an invalid database.');
  }
  const database: messages.Database = {
    dbDir: db.contents.databaseUri.fsPath,
    workingSet: 'default'
  };

  const params: messages.RunUpgradeParams = {
    db: database,
    timeoutSecs: 1000, // TODO: make configurable
    toRun: upgrades
  };

  return withProgress({
    location: ProgressLocation.Notification,
    title: "Running database upgrades",
    cancellable: true,
  }, (progress, token) => qs.sendRequest(messages.runUpgrade, params, token, progress));
}

export async function clearCacheInDatabase(qs: qsClient.Server, dbItem: DatabaseItem):
  Promise<messages.ClearCacheResult> {
  if (dbItem.contents === undefined) {
    throw new Error('Can\'t clear the cache in an invalid snapshot.');
  }

  const db: messages.Database = {
    dbDir: dbItem.contents.databaseUri.fsPath,
    workingSet: 'default',
  };

  const params: messages.ClearCacheParams = {
    dryRun: false,
    db,
  };

  return withProgress({
    location: ProgressLocation.Notification,
    title: "Clearing Cache",
    cancellable: false,
  }, (progress, token) =>
      qs.sendRequest(messages.clearCache, params, token, progress)
  );
}

export async function compileAndRunQueryAgainstDatabase(
  qs: qsClient.Server,
  db: DatabaseItem,
  quickEval?: boolean
): Promise<EvaluationInfo> {
  const config = workspace.getConfiguration('ql');
  const root = workspace.rootPath;
  const editor = Window.activeTextEditor;
  if (root == undefined) {
    throw new Error('Can\'t run query with undefined workspace');
  }
  if (editor == undefined) {
    throw new Error('Can\'t run query without an active editor');
  }


  if (editor.document.isDirty) {
    // TODO: add 'always save' button which records preference in configuration
    if (await helpers.showBinaryChoiceDialog('Query file has unsaved changes. Save now?')) {
      editor.document.save();
    }
  }

  const qlProgram: messages.QlProgram = {
    libraryPath: config.projects['.'].libraryPath.map(lp => path.join(root, lp)),
    dbschemePath: path.join(root, config.projects['.'].dbScheme),
    queryPath: editor.document.fileName
  };
  let quickEvalPosition: messages.Position | undefined;
  if (quickEval) {
    const pos = editor.selection.start;
    const posEnd = editor.selection.end;
    // Convert from 0-based to 1-based line and column numbers.
    quickEvalPosition = {
      fileName: editor.document.fileName,
      line: pos.line + 1, column: pos.character + 1,
      endLine: posEnd.line + 1, endColumn: posEnd.character + 1
    }
  }

  const query = new QueryInfo(qlProgram, db, quickEvalPosition);
  return {
    query,
    result: await query.compileAndRun(qs),
    database: {
      name: db.name,
      snapshotUri: db.snapshotUri.toString(true)
    }
  };
}
