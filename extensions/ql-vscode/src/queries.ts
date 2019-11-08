import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as sarif from 'sarif';
import * as tmp from 'tmp';
import * as vscode from 'vscode';
import * as cli from './cli';
import { DatabaseItem } from './databases';
import * as helpers from './helpers';
import { DatabaseInfo, SortState, ResultsInfo, SortedResultSetInfo } from './interface-types';
import { logger } from './logging';
import * as messages from './messages';
import * as qsClient from './queryserver-client';

/**
 * queries.ts
 * -------------
 *
 * Compiling and running QL queries.
 */

// XXX: Tmp directory should be configuarble.
export const tmpDir = tmp.dirSync({ prefix: 'queries_', keep: false, unsafeCleanup: true });
const upgradesTmpDir = tmp.dirSync({ dir: tmpDir.name, prefix: 'upgrades_', keep: false, unsafeCleanup: true });
export const tmpDirDisposal = {
  dispose: () => {
    upgradesTmpDir.removeCallback();
    tmpDir.removeCallback();
  }
};

let queryCounter = 0;

export class UserCancellationException extends Error { }

/**
 * A collection of evaluation-time information about a query,
 * including the query itself, and where we have decided to put
 * temporary files associated with it, such as the compiled query
 * output and results.
 */
export class QueryInfo {
  compiledQueryPath: string;
  resultsInfo: ResultsInfo;
  /**
   * Map from result set name to SortedResultSetInfo.
   */
  sortedResultsInfo: Map<string, SortedResultSetInfo>;
  dataset: vscode.Uri; // guarantee the existence of a well-defined dataset dir at this point

  constructor(
    public program: messages.QlProgram,
    public dbItem: DatabaseItem,
    public queryDbscheme: string, // the dbscheme file the query expects, based on library path resolution
    public quickEvalPosition?: messages.Position,
    public metadata?: cli.QueryMetadata,
  ) {
    this.compiledQueryPath = path.join(tmpDir.name, `compiledQuery${queryCounter}.qlo`);
    this.resultsInfo = {
      resultsPath: path.join(tmpDir.name, `results${queryCounter}.bqrs`),
      interpretedResultsPath: path.join(tmpDir.name, `interpretedResults${queryCounter}.sarif`)
    };
    this.sortedResultsInfo = new Map();
    if (dbItem.contents === undefined) {
      throw new Error('Can\'t run query on invalid database.');
    }
    this.dataset = dbItem.contents.datasetUri;
    queryCounter++;
  }

  async run(
    qs: qsClient.QueryServerClient,
  ): Promise<messages.EvaluationResult> {
    let result: messages.EvaluationResult | null = null;

    const callbackId = qs.registerCallback(res => { result = res });

    const queryToRun: messages.QueryToRun = {
      resultsPath: this.resultsInfo.resultsPath,
      qlo: vscode.Uri.file(this.compiledQueryPath).toString(),
      allowUnknownTemplates: true,
      id: callbackId,
      timeoutSecs: qs.config.timeoutSecs,
    }
    const dataset: messages.Dataset = {
      dbDir: this.dataset.fsPath,
      workingSet: 'default'
    }
    const params: messages.EvaluateQueriesParams = {
      db: dataset,
      evaluateId: callbackId,
      queries: [queryToRun],
      stopOnError: false,
      useSequenceHint: false
    }
    try {
      await helpers.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Running Query",
        cancellable: true,
      }, (progress, token) => {
        return qs.sendRequest(messages.runQueries, params, token, progress)
      });
    } finally {
      qs.unRegisterCallback(callbackId);
    }
    return result || { evaluationTime: 0, message: "No result from server", queryId: -1, runId: callbackId, resultType: messages.QueryResultType.OTHER_ERROR };
  }

  async compile(
    qs: qsClient.QueryServerClient,
  ): Promise<messages.CompilationMessage[]> {
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
        extraOptions: {
          timeoutSecs: qs.config.timeoutSecs
        },
        queryToCheck: this.program,
        resultPath: this.compiledQueryPath,
        target: !!this.quickEvalPosition ? { quickEval: { quickEvalPos: this.quickEvalPosition } } : { query: {} }
      };


      compiled = await helpers.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Compiling Query",
        cancellable: true,
      }, (progress, token) => {
        return qs.sendRequest(messages.compileQuery, params, token, progress);
      });
    } finally {
      qs.logger.log(" - - - COMPILATION DONE - - - ");
    }

    return (compiled.messages || []).filter(msg => msg.severity == 0);
  }

  /**
   * Holds if this query should produce interpreted results.
   */
  hasInterpretedResults(): boolean {
    return this.dbItem.hasDbInfo();
  }

  async updateSortState(server: cli.CodeQLCliServer, resultSetName: string, sortState: SortState | undefined): Promise<void> {
    if (sortState === undefined) {
      this.sortedResultsInfo.delete(resultSetName);
      return;
    }

    const sortedResultSetInfo: SortedResultSetInfo = {
      resultsPath: path.join(tmpDir.name, `sortedResults${queryCounter}-${resultSetName}.bqrs`),
      sortState
    };

    await server.sortBqrs(this.resultsInfo.resultsPath, sortedResultSetInfo.resultsPath, resultSetName, [sortState.columnIndex], [sortState.direction]);
    this.sortedResultsInfo.set(resultSetName, sortedResultSetInfo);
  }
}

/**
 * Call cli command to interpret results.
 */
export async function interpretResults(server: cli.CodeQLCliServer, queryInfo: QueryInfo, resultsInfo: ResultsInfo, sourceInfo?: cli.SourceInfo): Promise<sarif.Log> {
  if (await fs.pathExists(resultsInfo.interpretedResultsPath)) {
    return JSON.parse(await fs.readFile(resultsInfo.interpretedResultsPath, 'utf8'));
  }
  const { metadata } = queryInfo;
  if (metadata == undefined) {
    throw new Error('Can\'t interpret results without query metadata');
  }
  let { kind, id } = metadata;
  if (kind == undefined) {
    throw new Error('Can\'t interpret results without query metadata including kind');
  }
  if (id == undefined) {
    // Interpretation per se doesn't really require an id, but the
    // SARIF format does, so in the absence of one, we invent one
    // based on the query path.
    //
    // Just to be careful, sanitize to remove '/' since SARIF (section
    // 3.27.5 "ruleId property") says that it has special meaning.
    id = queryInfo.program.queryPath.replace(/\//g, '-');
  }
  return await server.interpretBqrs({ kind, id }, resultsInfo.resultsPath, resultsInfo.interpretedResultsPath, sourceInfo);
}

export interface EvaluationInfo {
  query: QueryInfo;
  result: messages.EvaluationResult;
  database: DatabaseInfo;
}

/**
 * Checks whether the given database can be upgraded to the given target DB scheme,
 * and whether the user wants to proceed with the upgrade.
 * Reports errors to both the user and the console.
 * @returns the `UpgradeParams` needed to start the upgrade, if the upgrade is possible and was confirmed by the user, or `undefined` otherwise.
 */
async function checkAndConfirmDatabaseUpgrade(qs: qsClient.QueryServerClient, db: DatabaseItem, targetDbScheme: vscode.Uri, upgradesDirectories: vscode.Uri[]):
  Promise<messages.UpgradeParams | undefined> {
  if (db.contents === undefined || db.contents.dbSchemeUri === undefined) {
    helpers.showAndLogErrorMessage("Database is invalid, and cannot be upgraded.")
    return;
  }
  const params: messages.UpgradeParams = {
    fromDbscheme: db.contents.dbSchemeUri.fsPath,
    toDbscheme: targetDbScheme.fsPath,
    additionalUpgrades: upgradesDirectories.map(uri => uri.fsPath)
  };

  let checkUpgradeResult: messages.CheckUpgradeResult;
  try {
    qs.logger.log('Checking database upgrade...');
    checkUpgradeResult = await checkDatabaseUpgrade(qs, params);
  }
  catch (e) {
    helpers.showAndLogErrorMessage(`Database cannot be upgraded: ${e}`);
    return;
  }
  finally {
    qs.logger.log('Done checking database upgrade.')
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
  const shouldUpgrade = await helpers.showBinaryChoiceDialog(`Should the database ${db.databaseUri.fsPath} be upgraded?\n\n${descriptionMessage}`);
  if (shouldUpgrade) {
    return params;
  }
  else {
    throw new UserCancellationException('User cancelled the database upgrade.');
  }
}

/**
 * Command handler for 'Upgrade Database'.
 * Attempts to upgrade the given database to the given target DB scheme, using the given directory of upgrades.
 * First performs a dry-run and prompts the user to confirm the upgrade.
 * Reports errors during compilation and evaluation of upgrades to the user.
 */
export async function upgradeDatabase(qs: qsClient.QueryServerClient, db: DatabaseItem, targetDbScheme: vscode.Uri, upgradesDirectories: vscode.Uri[]):
  Promise<messages.RunUpgradeResult | undefined> {
  const upgradeParams = await checkAndConfirmDatabaseUpgrade(qs, db, targetDbScheme, upgradesDirectories);

  if (upgradeParams === undefined) {
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
    qs.logger.log('Done compiling database upgrade.')
  }

  if (compileUpgradeResult.compiledUpgrades === undefined) {
    const error = compileUpgradeResult.error || '[no error message available]';
    helpers.showAndLogErrorMessage(`Compilation of database upgrades failed: ${error}`);
    return;
  }

  try {
    qs.logger.log('Running the following database upgrade:');
    qs.logger.log(compileUpgradeResult.compiledUpgrades.scripts.map(s => s.description.description).join('\n'));
    return await runDatabaseUpgrade(qs, db, compileUpgradeResult.compiledUpgrades);
  }
  catch (e) {
    helpers.showAndLogErrorMessage(`Database upgrade failed: ${e}`);
    return;
  }
  finally {
    qs.logger.log('Done running database upgrade.')
  }
}

async function checkDatabaseUpgrade(qs: qsClient.QueryServerClient, upgradeParams: messages.UpgradeParams):
  Promise<messages.CheckUpgradeResult> {
  return helpers.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Checking for database upgrades",
    cancellable: true,
  }, (progress, token) => qs.sendRequest(messages.checkUpgrade, upgradeParams, token, progress));
}

async function compileDatabaseUpgrade(qs: qsClient.QueryServerClient, upgradeParams: messages.UpgradeParams):
  Promise<messages.CompileUpgradeResult> {
  const params: messages.CompileUpgradeParams = {
    upgrade: upgradeParams,
    upgradeTempDir: upgradesTmpDir.name
  }

  return helpers.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Compiling database upgrades",
    cancellable: true,
  }, (progress, token) => qs.sendRequest(messages.compileUpgrade, params, token, progress));
}

async function runDatabaseUpgrade(qs: qsClient.QueryServerClient, db: DatabaseItem, upgrades: messages.CompiledUpgrades):
  Promise<messages.RunUpgradeResult> {

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

  return helpers.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Running database upgrades",
    cancellable: true,
  }, (progress, token) => qs.sendRequest(messages.runUpgrade, params, token, progress));
}

export async function clearCacheInDatabase(qs: qsClient.QueryServerClient, dbItem: DatabaseItem):
  Promise<messages.ClearCacheResult> {
  if (dbItem.contents === undefined) {
    throw new Error('Can\'t clear the cache in an invalid database.');
  }

  const db: messages.Dataset = {
    dbDir: dbItem.contents.datasetUri.fsPath,
    workingSet: 'default',
  };

  const params: messages.ClearCacheParams = {
    dryRun: false,
    db,
  };

  return helpers.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Clearing Cache",
    cancellable: false,
  }, (progress, token) =>
    qs.sendRequest(messages.clearCache, params, token, progress)
  );
}

/** Gets the selected position within the given editor. */
function getSelectedPosition(editor: vscode.TextEditor): messages.Position {
  const pos = editor.selection.start;
  const posEnd = editor.selection.end;
  // Convert from 0-based to 1-based line and column numbers.
  return {
    fileName: editor.document.fileName,
    line: pos.line + 1, column: pos.character + 1,
    endLine: posEnd.line + 1, endColumn: posEnd.character + 1
  };
}

/**
 * Compare the dbscheme implied by the query `query` and that of the current database.
 * If they are compatible, do nothing.
 * If they are incompatible but the database can be upgraded, suggest that upgrade.
 * If they are incompatible and the database cannot be upgraded, throw an error.
 */
async function checkDbschemeCompatibility(
  cliServer: cli.CodeQLCliServer,
  qs: qsClient.QueryServerClient,
  query: QueryInfo
): Promise<void> {
  const searchPath = helpers.getOnDiskWorkspaceFolders();

  if (query.dbItem.contents !== undefined && query.dbItem.contents.dbSchemeUri !== undefined) {
    const info = await cliServer.resolveUpgrades(query.dbItem.contents.dbSchemeUri.fsPath, searchPath);
    async function hash(filename: string): Promise<string> {
      return crypto.createHash('sha256').update(await fs.readFile(filename)).digest('hex');
    }

    // At this point, we have learned about three dbschemes:

    // query.program.dbschemePath is the dbscheme of the actual
    // database we're querying.
    const dbschemeOfDb = await hash(query.program.dbschemePath);

    // query.queryDbScheme is the dbscheme of the query we're
    // running, including the library we've resolved it to use.
    const dbschemeOfLib = await hash(query.queryDbscheme);

    // info.finalDbscheme is which database we're able to upgrade to
    const upgradableTo = await hash(info.finalDbscheme);

    if (upgradableTo != dbschemeOfLib) {
      logger.log(`Query ${query.program.queryPath} expects database scheme ${query.queryDbscheme}, but database has scheme ${query.program.dbschemePath}, and no upgrade path found`);
      throw new Error(`Query ${query.program.queryPath} expects database scheme ${query.queryDbscheme}, but the current database has a different scheme, and no database upgrades are available. The current database scheme may be newer than the CodeQL query libraries in your workspace. Please try using a newer version of the query libraries.`);
    }

    if (upgradableTo == dbschemeOfLib &&
      dbschemeOfDb != dbschemeOfLib) {
      // Try to upgrade the database
      await upgradeDatabase(
        qs,
        query.dbItem,
        vscode.Uri.file(info.finalDbscheme),
        searchPath.map(file => vscode.Uri.file(file))
      );
    }
  }
}

/** Prompts the user to save `document` if it has unsaved changes. */
async function promptUserToSaveChanges(document: vscode.TextDocument) {
  if (document.isDirty) {
    // TODO: add 'always save' button which records preference in configuration
    if (await helpers.showBinaryChoiceDialog('Query file has unsaved changes. Save now?')) {
      await document.save();
    }
  }
}

type SelectedQuery = {
  queryPath: string,
  quickEvalPosition?: messages.Position
};

/**
 * Determines which QL file to run during an invocation of `Run Query` or `Quick Evaluation`, as follows:
 * - If the command was called by clicking on a file, then use that file.
 * - Otherwise, use the file open in the current editor.
 * - In either case, prompt the user to save the file if it is open with unsaved changes.
 * - For `Quick Evaluation`, ensure the selected file is also the one open in the editor,
 * and use the selected region.
 * @param selectedResourceUri The selected resource when the command was run.
 * @param quickEval Whether the command being run is `Quick Evaluation`.
*/
async function determineSelectedQuery(selectedResourceUri: vscode.Uri | undefined, quickEval: boolean): Promise<SelectedQuery> {
  const editor = vscode.window.activeTextEditor;

  // Choose which QL file to use.
  let queryUri: vscode.Uri;
  if (selectedResourceUri === undefined) {
    // No resource was passed to the command handler, so obtain it from the active editor.
    // This usually happens when the command is called from the Command Palette.
    if (editor === undefined) {
      throw new Error('No query was selected. Please select a query and try again.');
    } else {
      queryUri = editor.document.uri;
    }
  } else {
    // A resource was passed to the command handler, so use it.
    queryUri = selectedResourceUri;
  }

  if (queryUri.scheme !== 'file') {
    throw new Error('Can only run queries that are on disk.');
  }
  const queryPath = queryUri.fsPath;

  // Whether we chose the file from the active editor or from a context menu,
  // if the same file is open with unsaved changes in the active editor,
  // then prompt the user to save it first.
  if (editor !== undefined && editor.document.uri.fsPath === queryPath) {
    await promptUserToSaveChanges(editor.document);
  }

  let quickEvalPosition: messages.Position | undefined = undefined;
  if (quickEval) {
    if (editor == undefined) {
      throw new Error('Can\'t run quick evaluation without an active editor.');
    }
    if (editor.document.fileName !== queryPath) {
      // For Quick Evaluation we expect these to be the same.
      // Report an error if we end up in this (hopefully unlikely) situation.
      throw new Error('The selected resource for quick evaluation should match the active editor.');
    }
    quickEvalPosition = getSelectedPosition(editor);
  }

  return { queryPath, quickEvalPosition };
}

export async function compileAndRunQueryAgainstDatabase(
  cliServer: cli.CodeQLCliServer,
  qs: qsClient.QueryServerClient,
  db: DatabaseItem,
  quickEval: boolean,
  selectedQueryUri: vscode.Uri | undefined
): Promise<EvaluationInfo> {

  if (!db.contents || !db.contents.dbSchemeUri) {
    throw new Error(`Database ${db.databaseUri} does not have a CodeQL database scheme.`);
  }

  // Determine which query to run, based on the selection and the active editor.
  const { queryPath, quickEvalPosition } = await determineSelectedQuery(selectedQueryUri, quickEval);

  // Get the workspace folder paths.
  const diskWorkspaceFolders = helpers.getOnDiskWorkspaceFolders();
  // Figure out the library path for the query.
  const packConfig = await cliServer.resolveLibraryPath(diskWorkspaceFolders, queryPath);

  // Check whether the query has an entirely different schema from the
  // database. (Queries that merely need the database to be upgraded
  // won't trigger this check)
  // This test will produce confusing results if we ever change the name of the database schema files.
  const querySchemaName = path.basename(packConfig.dbscheme);
  const dbSchemaName = path.basename(db.contents.dbSchemeUri.fsPath);
  if (querySchemaName != dbSchemaName) {
    logger.log(`Query schema was ${querySchemaName}, but database schema was ${dbSchemaName}.`);
    throw new Error(`The query ${path.basename(queryPath)} cannot be run against the selected database: their target languages are different. Please select a different database and try again.`);
  }

  const qlProgram: messages.QlProgram = {
    // The project of the current document determines which library path
    // we use. The `libraryPath` field in this server message is relative
    // to the workspace root, not to the project root.
    libraryPath: packConfig.libraryPath,
    // Since we are compiling and running a query against a database,
    // we use the database's DB scheme here instead of the DB scheme
    // from the current document's project.
    dbschemePath: db.contents.dbSchemeUri.fsPath,
    queryPath: queryPath
  };

  // Read the query metadata if possible, to use in the UI.
  let metadata: cli.QueryMetadata | undefined;
  try {
    metadata = await cliServer.resolveMetadata(qlProgram.queryPath);
  } catch (e) {
    // Ignore errors and provide no metadata.
    logger.log(`Couldn't resolve metadata for ${qlProgram.queryPath}: ${e}`);
  }

  const query = new QueryInfo(qlProgram, db, packConfig.dbscheme, quickEvalPosition, metadata);
  await checkDbschemeCompatibility(cliServer, qs, query);

  const errors = await query.compile(qs);


  if (errors.length == 0) {
    const result = await query.run(qs);
    return {
      query,
      result,
      database: {
        name: db.name,
        databaseUri: db.databaseUri.toString(true)
      }
    };
  } else {
    // Error dialogs are limited in size and scrollability,
    // so we include a general description of the problem,
    // and direct the user to the output window for the detailed compilation messages.
    // However we don't show quick eval errors there so we need to display them anyway.
    qs.logger.log(`Failed to compile query ${query.program.queryPath} against database scheme ${query.program.dbschemePath}:`);

    let formattedMessages: string[] = [];

    for (const error of errors) {
      const message = error.message || "[no error message available]";
      const formatted = `ERROR: ${message} (${error.position.fileName}:${error.position.line}:${error.position.column}:${error.position.endLine}:${error.position.endColumn})`;
      formattedMessages.push(formatted);
      qs.logger.log(formatted);
    }
    if (quickEval && formattedMessages.length <= 3) {
      helpers.showAndLogErrorMessage("Quick evaluation compilation failed: \n" + formattedMessages.join("\n"));
    } else {
      helpers.showAndLogErrorMessage((quickEval ? "Query" : "Quick evaluation") +
        " compilation failed. Please make sure there are no errors in the query, the database is up to date," +
        " and the query and database use the same target language. For more details on the error, go to View > Output," +
        " and choose CodeQL Query Server from the dropdown.");
    }
    return {
      query,
      result: {
        evaluationTime: 0,
        resultType: messages.QueryResultType.OTHER_ERROR,
        queryId: -1,
        runId: -1,
        message: "Query had compilation errors"
      },
      database: {
        name: db.name,
        databaseUri: db.databaseUri.toString(true)
      }
    }
  }
}
