import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as tmp from 'tmp-promise';
import * as path from 'path';
import { nanoid } from 'nanoid';
import {
  CancellationToken,
  ConfigurationTarget,
  Range,
  TextDocument,
  TextEditor,
  Uri,
  window
} from 'vscode';
import { ErrorCodes, ResponseError } from 'vscode-languageclient';

import * as cli from './cli';
import * as config from './config';
import { DatabaseItem, DatabaseManager } from './databases';
import {
  createTimestampFile,
  getOnDiskWorkspaceFolders,
  showAndLogErrorMessage,
  showAndLogWarningMessage,
  tryGetQueryMetadata,
  upgradesTmpDir
} from './helpers';
import { ProgressCallback, UserCancellationException } from './commandRunner';
import { DatabaseInfo, QueryMetadata } from './pure/interface-types';
import { logger } from './logging';
import * as messages from './pure/messages';
import { InitialQueryInfo } from './query-results';
import * as qsClient from './queryserver-client';
import { isQuickQueryPath } from './quick-query';
import { compileDatabaseUpgradeSequence, hasNondestructiveUpgradeCapabilities, upgradeDatabaseExplicit } from './upgrades';
import { ensureMetadataIsComplete } from './query-results';
import { SELECT_QUERY_NAME } from './contextual/locationFinder';
import { DecodedBqrsChunk } from './pure/bqrs-cli-types';

/**
 * run-queries.ts
 * --------------
 *
 * Compiling and running QL queries.
 */

/**
 * Information about which query will be to be run. `quickEvalPosition` and `quickEvalText`
 * is only filled in if the query is a quick query.
 */
interface SelectedQuery {
  queryPath: string;
  quickEvalPosition?: messages.Position;
  quickEvalText?: string;
}

/**
 * A collection of evaluation-time information about a query,
 * including the query itself, and where we have decided to put
 * temporary files associated with it, such as the compiled query
 * output and results.
 */
export class QueryEvaluationInfo {

  /**
   * Note that in the {@link FullQueryInfo.slurp} method, we create a QueryEvaluationInfo instance
   * by explicitly setting the prototype in order to avoid calling this constructor.
   */
  constructor(
    public readonly querySaveDir: string,
    public readonly dbItemPath: string,
    private readonly databaseHasMetadataFile: boolean,
    public readonly queryDbscheme: string, // the dbscheme file the query expects, based on library path resolution
    public readonly quickEvalPosition?: messages.Position,
    public readonly metadata?: QueryMetadata,
    public readonly templates?: messages.TemplateDefinitions
  ) {
    /**/
  }

  get dilPath() {
    return path.join(this.querySaveDir, 'results.dil');
  }

  get csvPath() {
    return path.join(this.querySaveDir, 'results.csv');
  }

  get compiledQueryPath() {
    return path.join(this.querySaveDir, 'compiledQuery.qlo');
  }

  get logPath() {
    return qsClient.findQueryLogFile(this.querySaveDir);
  }

  get resultsPaths() {
    return {
      resultsPath: path.join(this.querySaveDir, 'results.bqrs'),
      interpretedResultsPath: path.join(this.querySaveDir,
        this.metadata?.kind === 'graph'
          ? 'graphResults'
          : 'interpretedResults.sarif'
      ),
    };
  }

  getSortedResultSetPath(resultSetName: string) {
    return path.join(this.querySaveDir, `sortedResults-${resultSetName}.bqrs`);
  }

  /**
   * Creates a file in the query directory that indicates when this query was created.
   * This is important for keeping track of when queries should be removed.
   */
  async createTimestampFile() {
    await createTimestampFile(this.querySaveDir);
  }

  async run(
    qs: qsClient.QueryServerClient,
    upgradeQlo: string | undefined,
    availableMlModels: cli.MlModelInfo[],
    dbItem: DatabaseItem,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<messages.EvaluationResult> {
    if (!dbItem.contents || dbItem.error) {
      throw new Error('Can\'t run query on invalid database.');
    }

    let result: messages.EvaluationResult | null = null;

    const callbackId = qs.registerCallback(res => {
      result = {
        ...res,
        logFileLocation: this.logPath
      };
    });

    const availableMlModelUris: messages.MlModel[] = availableMlModels.map(model => ({ uri: Uri.file(model.path).toString(true) }));

    const queryToRun: messages.QueryToRun = {
      resultsPath: this.resultsPaths.resultsPath,
      qlo: Uri.file(this.compiledQueryPath).toString(),
      compiledUpgrade: upgradeQlo && Uri.file(upgradeQlo).toString(),
      allowUnknownTemplates: true,
      templateValues: this.templates,
      availableMlModels: availableMlModelUris,
      id: callbackId,
      timeoutSecs: qs.config.timeoutSecs,
    };

    const dataset: messages.Dataset = {
      dbDir: dbItem.contents.datasetUri.fsPath,
      workingSet: 'default'
    };
    const params: messages.EvaluateQueriesParams = {
      db: dataset,
      evaluateId: callbackId,
      queries: [queryToRun],
      stopOnError: false,
      useSequenceHint: false
    };
    try {
      await qs.sendRequest(messages.runQueries, params, token, progress);
      if (qs.config.customLogDirectory) {
        void showAndLogWarningMessage(
          `Custom log directories are no longer supported. The "codeQL.runningQueries.customLogDirectory" setting is deprecated. Unset the setting to stop seeing this message. Query logs saved to ${this.logPath}.`
        );
      }
    } finally {
      qs.unRegisterCallback(callbackId);
    }
    return result || {
      evaluationTime: 0,
      message: 'No result from server',
      queryId: -1,
      runId: callbackId,
      resultType: messages.QueryResultType.OTHER_ERROR
    };
  }

  async compile(
    qs: qsClient.QueryServerClient,
    program: messages.QlProgram,
    progress: ProgressCallback,
    token: CancellationToken,
  ): Promise<messages.CompilationMessage[]> {
    let compiled: messages.CheckQueryResult | undefined;
    try {
      const target = this.quickEvalPosition ? {
        quickEval: { quickEvalPos: this.quickEvalPosition }
      } : { query: {} };
      const params: messages.CompileQueryParams = {
        compilationOptions: {
          computeNoLocationUrls: true,
          failOnWarnings: false,
          fastCompilation: false,
          includeDilInQlo: true,
          localChecking: false,
          noComputeGetUrl: false,
          noComputeToString: false,
          computeDefaultStrings: true
        },
        extraOptions: {
          timeoutSecs: qs.config.timeoutSecs
        },
        queryToCheck: program,
        resultPath: this.compiledQueryPath,
        target,
      };

      compiled = await qs.sendRequest(messages.compileQuery, params, token, progress);
    } finally {
      void qs.logger.log(' - - - COMPILATION DONE - - - ', { additionalLogLocation: this.logPath });
    }
    return (compiled?.messages || []).filter(msg => msg.severity === messages.Severity.ERROR);
  }

  /**
   * Holds if this query can in principle produce interpreted results.
   */
  canHaveInterpretedResults(): boolean {
    if (!this.databaseHasMetadataFile) {
      void logger.log('Cannot produce interpreted results since the database does not have a .dbinfo or codeql-database.yml file.');
      return false;
    }

    const kind = this.metadata?.kind;
    const hasKind = !!kind;
    if (!hasKind) {
      void logger.log('Cannot produce interpreted results since the query does not have @kind metadata.');
      return false;
    }

    // Graph queries only return interpreted results if we are in canary mode.
    if (kind === 'graph') {
      return config.isCanary();
    }

    // table is the default query kind. It does not produce interpreted results.
    // any query kind that is not table can, in principle, produce interpreted results.
    return kind !== 'table';
  }

  /**
   * Holds if this query actually has produced interpreted results.
   */
  async hasInterpretedResults(): Promise<boolean> {
    return fs.pathExists(this.resultsPaths.interpretedResultsPath);
  }

  /**
   * Holds if this query already has DIL produced
   */
  async hasDil(): Promise<boolean> {
    return fs.pathExists(this.dilPath);
  }

  /**
   * Holds if this query already has CSV results produced
   */
  async hasCsv(): Promise<boolean> {
    return fs.pathExists(this.csvPath);
  }

  /**
   * Returns the path to the DIL file produced by this query. If the query has not yet produced DIL,
   * this will return first create the DIL file and then return the path to the DIL file.
   */
  async ensureDilPath(qs: qsClient.QueryServerClient): Promise<string> {
    if (await this.hasDil()) {
      return this.dilPath;
    }

    if (!(await fs.pathExists(this.compiledQueryPath))) {
      throw new Error(
        `Cannot create DIL because compiled query is missing. ${this.compiledQueryPath}`
      );
    }

    await qs.cliServer.generateDil(this.compiledQueryPath, this.dilPath);
    return this.dilPath;
  }

  /**
   * Creates the CSV file containing the results of this query. This will only be called if the query
   * does not have interpreted results and the CSV file does not already exist.
   */
  async exportCsvResults(qs: qsClient.QueryServerClient, csvPath: string, onFinish: () => void): Promise<void> {
    let stopDecoding = false;
    const out = fs.createWriteStream(csvPath);
    out.on('finish', onFinish);
    out.on('error', () => {
      if (!stopDecoding) {
        stopDecoding = true;
        void showAndLogErrorMessage(`Failed to write CSV results to ${csvPath}`);
      }
    });
    let nextOffset: number | undefined = 0;
    while (nextOffset !== undefined && !stopDecoding) {
      const chunk: DecodedBqrsChunk = await qs.cliServer.bqrsDecode(this.resultsPaths.resultsPath, SELECT_QUERY_NAME, {
        pageSize: 100,
        offset: nextOffset,
      });
      for (const tuple of chunk.tuples) {
        out.write(tuple.join(',') + '\n');
      }
      nextOffset = chunk.next;
    }
    out.end();
  }

  /**
   * Returns the path to the CSV alerts interpretation of this query results. If CSV results have
   * not yet been produced, this will return first create the CSV results and then return the path.
   *
   * This method only works for queries with interpreted results.
   */
  async ensureCsvAlerts(qs: qsClient.QueryServerClient, dbm: DatabaseManager): Promise<string> {
    if (await this.hasCsv()) {
      return this.csvPath;
    }

    const dbItem = dbm.findDatabaseItem(Uri.file(this.dbItemPath));
    if (!dbItem) {
      throw new Error(`Cannot produce CSV results because database is missing. ${this.dbItemPath}`);
    }

    let sourceInfo;
    if (dbItem.sourceArchive !== undefined) {
      sourceInfo = {
        sourceArchive: dbItem.sourceArchive.fsPath,
        sourceLocationPrefix: await dbItem.getSourceLocationPrefix(
          qs.cliServer
        ),
      };
    }

    await qs.cliServer.generateResultsCsv(ensureMetadataIsComplete(this.metadata), this.resultsPaths.resultsPath, this.csvPath, sourceInfo);
    return this.csvPath;
  }

  /**
   * Cleans this query's results directory.
   */
  async deleteQuery(): Promise<void> {
    await fs.remove(this.querySaveDir);
  }
}

export interface QueryWithResults {
  readonly query: QueryEvaluationInfo;
  readonly result: messages.EvaluationResult;
  readonly logFileLocation?: string;
  readonly dispose: () => void;
}

export async function clearCacheInDatabase(
  qs: qsClient.QueryServerClient,
  dbItem: DatabaseItem,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<messages.ClearCacheResult> {
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

  return qs.sendRequest(messages.clearCache, params, token, progress);
}

/**
 * @param filePath This needs to be equivalent to Java's `Path.toRealPath(NO_FOLLOW_LINKS)`
 */
async function convertToQlPath(filePath: string): Promise<string> {
  if (process.platform === 'win32') {

    if (path.parse(filePath).root === filePath) {
      // Java assumes uppercase drive letters are canonical.
      return filePath.toUpperCase();
    } else {
      const dir = await convertToQlPath(path.dirname(filePath));
      const fileName = path.basename(filePath);
      const fileNames = await fs.readdir(dir);
      for (const name of fileNames) {
        // Leave the locale argument empty so that the default OS locale is used.
        // We do this because this operation works on filesystem entities, which
        // use the os locale, regardless of the locale of the running VS Code instance.
        if (fileName.localeCompare(name, undefined, { sensitivity: 'accent' }) === 0) {
          return path.join(dir, name);
        }
      }
    }
    throw new Error('Can\'t convert path to form suitable for QL:' + filePath);
  } else {
    return filePath;
  }
}



/** Gets the selected position within the given editor. */
async function getSelectedPosition(editor: TextEditor, range?: Range): Promise<messages.Position> {
  const selectedRange = range || editor.selection;
  const pos = selectedRange.start;
  const posEnd = selectedRange.end;
  // Convert from 0-based to 1-based line and column numbers.
  return {
    fileName: await convertToQlPath(editor.document.fileName),
    line: pos.line + 1,
    column: pos.character + 1,
    endLine: posEnd.line + 1,
    endColumn: posEnd.character + 1
  };
}

/**
 * Compare the dbscheme implied by the query `query` and that of the current database.
 * - If they are compatible, do nothing.
 * - If they are incompatible but the database can be upgraded, suggest that upgrade.
 * - If they are incompatible and the database cannot be upgraded, throw an error.
 */
async function checkDbschemeCompatibility(
  cliServer: cli.CodeQLCliServer,
  qs: qsClient.QueryServerClient,
  query: QueryEvaluationInfo,
  qlProgram: messages.QlProgram,
  dbItem: DatabaseItem,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<void> {
  const searchPath = getOnDiskWorkspaceFolders();

  if (dbItem.contents?.dbSchemeUri !== undefined) {
    const { finalDbscheme } = await cliServer.resolveUpgrades(dbItem.contents.dbSchemeUri.fsPath, searchPath, false);
    const hash = async function(filename: string): Promise<string> {
      return crypto.createHash('sha256').update(await fs.readFile(filename)).digest('hex');
    };

    // At this point, we have learned about three dbschemes:

    // the dbscheme of the actual database we're querying.
    const dbschemeOfDb = await hash(dbItem.contents.dbSchemeUri.fsPath);

    // the dbscheme of the query we're running, including the library we've resolved it to use.
    const dbschemeOfLib = await hash(query.queryDbscheme);

    // the database we're able to upgrade to
    const upgradableTo = await hash(finalDbscheme);

    if (upgradableTo != dbschemeOfLib) {
      reportNoUpgradePath(qlProgram, query);
    }

    if (upgradableTo == dbschemeOfLib &&
      dbschemeOfDb != dbschemeOfLib) {
      // Try to upgrade the database
      await upgradeDatabaseExplicit(
        qs,
        dbItem,
        progress,
        token
      );
    }
  }
}

function reportNoUpgradePath(qlProgram: messages.QlProgram, query: QueryEvaluationInfo): void {
  throw new Error(
    `Query ${qlProgram.queryPath} expects database scheme ${query.queryDbscheme}, but the current database has a different scheme, and no database upgrades are available. The current database scheme may be newer than the CodeQL query libraries in your workspace.\n\nPlease try using a newer version of the query libraries.`
  );
}

/**
 * Compile a non-destructive upgrade.
 */
async function compileNonDestructiveUpgrade(
  qs: qsClient.QueryServerClient,
  upgradeTemp: tmp.DirectoryResult,
  query: QueryEvaluationInfo,
  qlProgram: messages.QlProgram,
  dbItem: DatabaseItem,
  progress: ProgressCallback,
  token: CancellationToken,
): Promise<string> {

  if (!dbItem?.contents?.dbSchemeUri) {
    throw new Error('Database is invalid, and cannot be upgraded.');
  }

  // When packaging is used, dependencies may exist outside of the workspace and they are always on the resolved search path.
  // When packaging is not used, all dependencies are in the workspace.
  const upgradesPath = (await qs.cliServer.cliConstraints.supportsPackaging())
    ? qlProgram.libraryPath
    : getOnDiskWorkspaceFolders();

  const { scripts, matchesTarget } = await qs.cliServer.resolveUpgrades(
    dbItem.contents.dbSchemeUri.fsPath,
    upgradesPath,
    true,
    query.queryDbscheme
  );

  if (!matchesTarget) {
    reportNoUpgradePath(qlProgram, query);
  }
  const result = await compileDatabaseUpgradeSequence(qs, dbItem, scripts, upgradeTemp, progress, token);
  if (result.compiledUpgrade === undefined) {
    const error = result.error || '[no error message available]';
    throw new Error(error);
  }
  // We can upgrade to the actual target
  qlProgram.dbschemePath = query.queryDbscheme;
  // We are new enough that we will always support single file upgrades.
  return result.compiledUpgrade;
}

/**
 * Prompts the user to save `document` if it has unsaved changes.
 *
 * @param document The document to save.
 *
 * @returns true if we should save changes and false if we should continue without saving changes.
 * @throws UserCancellationException if we should abort whatever operation triggered this prompt
 */
async function promptUserToSaveChanges(document: TextDocument): Promise<boolean> {
  if (document.isDirty) {
    if (config.AUTOSAVE_SETTING.getValue()) {
      return true;
    }
    else {
      const yesItem = { title: 'Yes', isCloseAffordance: false };
      const alwaysItem = { title: 'Always Save', isCloseAffordance: false };
      const noItem = { title: 'No (run version on disk)', isCloseAffordance: false };
      const cancelItem = { title: 'Cancel', isCloseAffordance: true };
      const message = 'Query file has unsaved changes. Save now?';
      const chosenItem = await window.showInformationMessage(
        message,
        { modal: true },
        yesItem, alwaysItem, noItem, cancelItem
      );

      if (chosenItem === alwaysItem) {
        await config.AUTOSAVE_SETTING.updateValue(true, ConfigurationTarget.Workspace);
        return true;
      }

      if (chosenItem === yesItem) {
        return true;
      }

      if (chosenItem === cancelItem) {
        throw new UserCancellationException('Query run cancelled.', true);
      }
    }
  }
  return false;
}

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
export async function determineSelectedQuery(
  selectedResourceUri: Uri | undefined,
  quickEval: boolean,
  range?: Range
): Promise<SelectedQuery> {
  const editor = window.activeTextEditor;

  // Choose which QL file to use.
  let queryUri: Uri;
  if (selectedResourceUri) {
    // A resource was passed to the command handler, so use it.
    queryUri = selectedResourceUri;
  } else {
    // No resource was passed to the command handler, so obtain it from the active editor.
    // This usually happens when the command is called from the Command Palette.
    if (editor === undefined) {
      throw new Error('No query was selected. Please select a query and try again.');
    } else {
      queryUri = editor.document.uri;
    }
  }

  if (queryUri.scheme !== 'file') {
    throw new Error('Can only run queries that are on disk.');
  }
  const queryPath = queryUri.fsPath;

  if (quickEval) {
    if (!(queryPath.endsWith('.ql') || queryPath.endsWith('.qll'))) {
      throw new Error('The selected resource is not a CodeQL file; It should have the extension ".ql" or ".qll".');
    }
  } else {
    if (!(queryPath.endsWith('.ql'))) {
      throw new Error('The selected resource is not a CodeQL query file; It should have the extension ".ql".');
    }
  }

  // Whether we chose the file from the active editor or from a context menu,
  // if the same file is open with unsaved changes in the active editor,
  // then prompt the user to save it first.
  if (editor !== undefined && editor.document.uri.fsPath === queryPath) {
    if (await promptUserToSaveChanges(editor.document)) {
      await editor.document.save();
    }
  }

  let quickEvalPosition: messages.Position | undefined = undefined;
  let quickEvalText: string | undefined = undefined;
  if (quickEval) {
    if (editor == undefined) {
      throw new Error('Can\'t run quick evaluation without an active editor.');
    }
    if (editor.document.fileName !== queryPath) {
      // For Quick Evaluation we expect these to be the same.
      // Report an error if we end up in this (hopefully unlikely) situation.
      throw new Error('The selected resource for quick evaluation should match the active editor.');
    }
    quickEvalPosition = await getSelectedPosition(editor, range);
    if (!editor.selection?.isEmpty) {
      quickEvalText = editor.document.getText(editor.selection);
    } else {
      // capture the entire line if the user didn't select anything
      const line = editor.document.lineAt(editor.selection.active.line);
      quickEvalText = line.text.trim();
    }
  }

  return { queryPath, quickEvalPosition, quickEvalText };
}

export async function compileAndRunQueryAgainstDatabase(
  cliServer: cli.CodeQLCliServer,
  qs: qsClient.QueryServerClient,
  dbItem: DatabaseItem,
  initialInfo: InitialQueryInfo,
  queryStorageDir: string,
  progress: ProgressCallback,
  token: CancellationToken,
  templates?: messages.TemplateDefinitions,
): Promise<QueryWithResults> {
  if (!dbItem.contents || !dbItem.contents.dbSchemeUri) {
    throw new Error(`Database ${dbItem.databaseUri} does not have a CodeQL database scheme.`);
  }

  // Get the workspace folder paths.
  const diskWorkspaceFolders = getOnDiskWorkspaceFolders();
  // Figure out the library path for the query.
  const packConfig = await cliServer.resolveLibraryPath(diskWorkspaceFolders, initialInfo.queryPath);

  if (!packConfig.dbscheme) {
    throw new Error('Could not find a database scheme for this query. Please check that you have a valid qlpack.yml file for this query, which refers to a database scheme either in the `dbscheme` field or through one of its dependencies.');
  }

  // Check whether the query has an entirely different schema from the
  // database. (Queries that merely need the database to be upgraded
  // won't trigger this check)
  // This test will produce confusing results if we ever change the name of the database schema files.
  const querySchemaName = path.basename(packConfig.dbscheme);
  const dbSchemaName = path.basename(dbItem.contents.dbSchemeUri.fsPath);
  if (querySchemaName != dbSchemaName) {
    void logger.log(`Query schema was ${querySchemaName}, but database schema was ${dbSchemaName}.`);
    throw new Error(`The query ${path.basename(initialInfo.queryPath)} cannot be run against the selected database (${dbItem.name}): their target languages are different. Please select a different database and try again.`);
  }

  const qlProgram: messages.QlProgram = {
    // The project of the current document determines which library path
    // we use. The `libraryPath` field in this server message is relative
    // to the workspace root, not to the project root.
    libraryPath: packConfig.libraryPath,
    // Since we are compiling and running a query against a database,
    // we use the database's DB scheme here instead of the DB scheme
    // from the current document's project.
    dbschemePath: dbItem.contents.dbSchemeUri.fsPath,
    queryPath: initialInfo.queryPath
  };

  // Read the query metadata if possible, to use in the UI.
  const metadata = await tryGetQueryMetadata(cliServer, qlProgram.queryPath);

  let availableMlModels: cli.MlModelInfo[] = [];
  if (await cliServer.cliConstraints.supportsResolveMlModels()) {
    try {
      availableMlModels = (await cliServer.resolveMlModels(diskWorkspaceFolders)).models;
      void logger.log(`Found available ML models at the following paths: ${availableMlModels.map(x => `'${x.path}'`).join(', ')}.`);
    } catch (e) {
      const message = `Couldn't resolve available ML models for ${qlProgram.queryPath}. Running the ` +
        `query without any ML models: ${e}.`;
      void showAndLogErrorMessage(message);
    }
  }

  const hasMetadataFile = (await dbItem.hasMetadataFile());
  const query = new QueryEvaluationInfo(
    path.join(queryStorageDir, initialInfo.id),
    dbItem.databaseUri.fsPath,
    hasMetadataFile,
    packConfig.dbscheme,
    initialInfo.quickEvalPosition,
    metadata,
    templates
  );
  await query.createTimestampFile();

  let upgradeDir: tmp.DirectoryResult | undefined;
  try {
    let upgradeQlo;
    if (await hasNondestructiveUpgradeCapabilities(qs)) {
      upgradeDir = await tmp.dir({ dir: upgradesTmpDir, unsafeCleanup: true });
      upgradeQlo = await compileNonDestructiveUpgrade(qs, upgradeDir, query, qlProgram, dbItem, progress, token);
    } else {
      await checkDbschemeCompatibility(cliServer, qs, query, qlProgram, dbItem, progress, token);
    }
    let errors;
    try {
      errors = await query.compile(qs, qlProgram, progress, token);
    } catch (e) {
      if (e instanceof ResponseError && e.code == ErrorCodes.RequestCancelled) {
        return createSyntheticResult(query, 'Query cancelled', messages.QueryResultType.CANCELLATION);
      } else {
        throw e;
      }
    }

    if (errors.length === 0) {
      const result = await query.run(qs, upgradeQlo, availableMlModels, dbItem, progress, token);
      if (result.resultType !== messages.QueryResultType.SUCCESS) {
        const message = result.message || 'Failed to run query';
        void logger.log(message);
        void showAndLogErrorMessage(message);
      }
      return {
        query,
        result,
        logFileLocation: result.logFileLocation,
        dispose: () => {
          qs.logger.removeAdditionalLogLocation(result.logFileLocation);
        }
      };
    } else {
      // Error dialogs are limited in size and scrollability,
      // so we include a general description of the problem,
      // and direct the user to the output window for the detailed compilation messages.
      // However we don't show quick eval errors there so we need to display them anyway.
      void qs.logger.log(
        `Failed to compile query ${initialInfo.queryPath} against database scheme ${qlProgram.dbschemePath}:`,
        { additionalLogLocation: query.logPath }
      );

      const formattedMessages: string[] = [];

      for (const error of errors) {
        const message = error.message || '[no error message available]';
        const formatted = `ERROR: ${message} (${error.position.fileName}:${error.position.line}:${error.position.column}:${error.position.endLine}:${error.position.endColumn})`;
        formattedMessages.push(formatted);
        void qs.logger.log(formatted, { additionalLogLocation: query.logPath });
      }
      if (initialInfo.isQuickEval && formattedMessages.length <= 2) {
        // If there are more than 2 error messages, they will not be displayed well in a popup
        // and will be trimmed by the function displaying the error popup. Accordingly, we only
        // try to show the errors if there are 2 or less, otherwise we direct the user to the log.
        void showAndLogErrorMessage('Quick evaluation compilation failed: ' + formattedMessages.join('\n'));
      } else {
        void showAndLogErrorMessage((initialInfo.isQuickEval ? 'Quick evaluation' : 'Query') + compilationFailedErrorTail);
      }

      return createSyntheticResult(query, 'Query had compilation errors', messages.QueryResultType.OTHER_ERROR);
    }
  } finally {
    try {
      await upgradeDir?.cleanup();
    } catch (e) {
      void qs.logger.log(
        `Could not clean up the upgrades dir. Reason: ${e.message || e}`,
        { additionalLogLocation: query.logPath }
      );
    }
  }
}

/**
 * Determines the initial information for a query. This is everything of interest
 * we know about this query that is available before it is run.
 *
 * @param selectedQueryUri The Uri of the document containing the query to be run.
 * @param databaseInfo The database to run the query against.
 * @param isQuickEval true if this is a quick evaluation.
 * @param range the selection range of the query to be run. Only used if isQuickEval is true.
 * @returns The initial information for the query to be run.
 */
export async function createInitialQueryInfo(
  selectedQueryUri: Uri | undefined,
  databaseInfo: DatabaseInfo,
  isQuickEval: boolean,
  range?: Range
): Promise<InitialQueryInfo> {
  // Determine which query to run, based on the selection and the active editor.
  const { queryPath, quickEvalPosition, quickEvalText } = await determineSelectedQuery(selectedQueryUri, isQuickEval, range);

  return {
    queryPath,
    isQuickEval,
    isQuickQuery: isQuickQueryPath(queryPath),
    databaseInfo,
    id: `${path.basename(queryPath)}-${nanoid()}`,
    start: new Date(),
    ... (isQuickEval ? {
      queryText: quickEvalText!, // if this query is quick eval, it must have quick eval text
      quickEvalPosition: quickEvalPosition
    } : {
      queryText: await fs.readFile(queryPath, 'utf8')
    })
  };
}


const compilationFailedErrorTail = ' compilation failed. Please make sure there are no errors in the query, the database is up to date,' +
  ' and the query and database use the same target language. For more details on the error, go to View > Output,' +
  ' and choose CodeQL Query Server from the dropdown.';

/**
 * Create a synthetic result for a query that failed to compile.
 */
function createSyntheticResult(
  query: QueryEvaluationInfo,
  message: string,
  resultType: number
): QueryWithResults {
  return {
    query,
    result: {
      evaluationTime: 0,
      resultType: resultType,
      queryId: -1,
      runId: -1,
      message
    },
    dispose: () => { /**/ },
  };
}
