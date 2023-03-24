import * as messages from "./pure/messages-shared";
import * as legacyMessages from "./pure/legacy-messages";
import { DatabaseInfo, QueryMetadata } from "./pure/interface-types";
import { join, parse, dirname, basename } from "path";
import { createTimestampFile, showAndLogWarningMessage } from "./helpers";
import {
  ConfigurationTarget,
  Range,
  TextDocument,
  TextEditor,
  Uri,
  window,
} from "vscode";
import { isCanary, AUTOSAVE_SETTING } from "./config";
import { UserCancellationException } from "./progress";
import {
  pathExists,
  readFile,
  createWriteStream,
  remove,
  readdir,
} from "fs-extra";
import {
  ensureMetadataIsComplete,
  InitialQueryInfo,
  LocalQueryInfo,
} from "./query-results";
import { isQuickQueryPath } from "./quick-query";
import { nanoid } from "nanoid";
import { CodeQLCliServer } from "./cli";
import { SELECT_QUERY_NAME } from "./contextual/locationFinder";
import { DatabaseManager } from "./local-databases";
import { DecodedBqrsChunk, EntityValue } from "./pure/bqrs-cli-types";
import { extLogger, Logger } from "./common";
import { generateSummarySymbolsFile } from "./log-insights/summary-parser";
import { getErrorMessage } from "./pure/helpers-pure";

/**
 * run-queries.ts
 * --------------
 *
 * Compiling and running QL queries.
 */

export function findQueryLogFile(resultPath: string): string {
  return join(resultPath, "query.log");
}

function findQueryEvalLogFile(resultPath: string): string {
  return join(resultPath, "evaluator-log.jsonl");
}

function findQueryEvalLogSummaryFile(resultPath: string): string {
  return join(resultPath, "evaluator-log.summary");
}

function findJsonQueryEvalLogSummaryFile(resultPath: string): string {
  return join(resultPath, "evaluator-log.summary.jsonl");
}

function findQueryEvalLogSummarySymbolsFile(resultPath: string): string {
  return join(resultPath, "evaluator-log.summary.symbols.json");
}

function findQueryEvalLogEndSummaryFile(resultPath: string): string {
  return join(resultPath, "evaluator-log-end.summary");
}

export class QueryEvaluationInfo {
  /**
   * Note that in the {@link readQueryHistoryFromFile} method, we create a QueryEvaluationInfo instance
   * by explicitly setting the prototype in order to avoid calling this constructor.
   */
  constructor(
    public readonly querySaveDir: string,
    public readonly dbItemPath: string,
    private readonly databaseHasMetadataFile: boolean,
    public readonly quickEvalPosition?: messages.Position,
    public readonly metadata?: QueryMetadata,
  ) {
    /**/
  }

  get dilPath() {
    return join(this.querySaveDir, "results.dil");
  }

  /**
   * Get the path that the compiled query is if it exists. Note that it only exists when using the legacy query server.
   */
  get compileQueryPath() {
    return join(this.querySaveDir, "compiledQuery.qlo");
  }

  get csvPath() {
    return join(this.querySaveDir, "results.csv");
  }

  get logPath() {
    return findQueryLogFile(this.querySaveDir);
  }

  get evalLogPath() {
    return findQueryEvalLogFile(this.querySaveDir);
  }

  get evalLogSummaryPath() {
    return findQueryEvalLogSummaryFile(this.querySaveDir);
  }

  get jsonEvalLogSummaryPath() {
    return findJsonQueryEvalLogSummaryFile(this.querySaveDir);
  }

  get evalLogSummarySymbolsPath() {
    return findQueryEvalLogSummarySymbolsFile(this.querySaveDir);
  }

  get evalLogEndSummaryPath() {
    return findQueryEvalLogEndSummaryFile(this.querySaveDir);
  }

  get resultsPaths() {
    return {
      resultsPath: join(this.querySaveDir, "results.bqrs"),
      interpretedResultsPath: join(
        this.querySaveDir,
        this.metadata?.kind === "graph"
          ? "graphResults"
          : "interpretedResults.sarif",
      ),
    };
  }
  getSortedResultSetPath(resultSetName: string) {
    return join(this.querySaveDir, `sortedResults-${resultSetName}.bqrs`);
  }

  /**
   * Creates a file in the query directory that indicates when this query was created.
   * This is important for keeping track of when queries should be removed.
   */
  async createTimestampFile() {
    await createTimestampFile(this.querySaveDir);
  }

  /**
   * Holds if this query can in principle produce interpreted results.
   */
  canHaveInterpretedResults(): boolean {
    if (!this.databaseHasMetadataFile) {
      void extLogger.log(
        "Cannot produce interpreted results since the database does not have a .dbinfo or codeql-database.yml file.",
      );
      return false;
    }

    const kind = this.metadata?.kind;
    const hasKind = !!kind;
    if (!hasKind) {
      void extLogger.log(
        "Cannot produce interpreted results since the query does not have @kind metadata.",
      );
      return false;
    }

    // Graph queries only return interpreted results if we are in canary mode.
    if (kind === "graph") {
      return isCanary();
    }

    // table is the default query kind. It does not produce interpreted results.
    // any query kind that is not table can, in principle, produce interpreted results.
    return kind !== "table";
  }

  /**
   * Holds if this query actually has produced interpreted results.
   */
  async hasInterpretedResults(): Promise<boolean> {
    return pathExists(this.resultsPaths.interpretedResultsPath);
  }

  /**
   * Holds if this query already has DIL produced
   */
  async hasDil(): Promise<boolean> {
    return pathExists(this.dilPath);
  }

  /**
   * Holds if this query already has CSV results produced
   */
  async hasCsv(): Promise<boolean> {
    return pathExists(this.csvPath);
  }

  /**
   * Returns the path to the DIL file produced by this query. If the query has not yet produced DIL,
   * this will return first create the DIL file and then return the path to the DIL file.
   */
  async ensureDilPath(cliServer: CodeQLCliServer): Promise<string> {
    if (await this.hasDil()) {
      return this.dilPath;
    }
    const compiledQuery = this.compileQueryPath;
    if (!(await pathExists(compiledQuery))) {
      if (await cliServer.cliConstraints.supportsNewQueryServer()) {
        // This could be from the new query server
        // in which case we expect the qlo to be missing so we should ignore it
        throw new Error(
          `DIL was not found. Expected location: '${this.dilPath}'`,
        );
      } else {
        throw new Error(
          `Cannot create DIL because compiled query is missing. ${compiledQuery}`,
        );
      }
    }

    await cliServer.generateDil(compiledQuery, this.dilPath);
    return this.dilPath;
  }

  /**
   * Holds if this query already has a completed structured evaluator log
   */
  async hasEvalLog(): Promise<boolean> {
    return pathExists(this.evalLogPath);
  }

  /**
   * Add the structured evaluator log to the query evaluation info.
   */
  async addQueryLogs(
    queryInfo: LocalQueryInfo,
    cliServer: CodeQLCliServer,
    logger: Logger,
  ) {
    queryInfo.evalLogLocation = this.evalLogPath;
    queryInfo.evalLogSummaryLocation =
      await this.generateHumanReadableLogSummary(cliServer);
    void this.logEndSummary(queryInfo.evalLogSummaryLocation, logger); // Logged asynchrnously
    if (isCanary()) {
      // Generate JSON summary for viewer.
      await cliServer.generateJsonLogSummary(
        this.evalLogPath,
        this.jsonEvalLogSummaryPath,
      );
      queryInfo.jsonEvalLogSummaryLocation = this.jsonEvalLogSummaryPath;
      await generateSummarySymbolsFile(
        this.evalLogSummaryPath,
        this.evalLogSummarySymbolsPath,
      );
      queryInfo.evalLogSummarySymbolsLocation = this.evalLogSummarySymbolsPath;
    }
  }

  /**
   * Calls the appropriate CLI command to generate a human-readable log summary.
   * @param qs The query server client.
   * @returns The path to the log summary, or `undefined` if the summary could not be generated.   */
  private async generateHumanReadableLogSummary(
    cliServer: CodeQLCliServer,
  ): Promise<string | undefined> {
    try {
      await cliServer.generateLogSummary(
        this.evalLogPath,
        this.evalLogSummaryPath,
        this.evalLogEndSummaryPath,
      );
      return this.evalLogSummaryPath;
    } catch (e) {
      void showAndLogWarningMessage(
        `Failed to generate human-readable structured evaluator log summary. Reason: ${getErrorMessage(
          e,
        )}`,
      );
      return undefined;
    }
  }

  /**
   * Logs the end summary to the Output window and log file.
   * @param logSummaryPath Path to the human-readable log summary
   * @param qs The query server client.
   */
  private async logEndSummary(
    logSummaryPath: string | undefined,
    logger: Logger,
  ): Promise<void> {
    if (logSummaryPath === undefined) {
      // Failed to generate the log, so we don't expect an end summary either.
      return;
    }

    try {
      const endSummaryContent = await readFile(
        this.evalLogEndSummaryPath,
        "utf-8",
      );
      void logger.log(" --- Evaluator Log Summary --- ");
      void logger.log(endSummaryContent);
    } catch (e) {
      void showAndLogWarningMessage(
        `Could not read structured evaluator log end of summary file at ${this.evalLogEndSummaryPath}.`,
      );
    }
  }

  /**
   * Creates the CSV file containing the results of this query. This will only be called if the query
   * does not have interpreted results and the CSV file does not already exist.
   *
   * @return Promise<true> if the operation creates the file. Promise<false> if the operation does
   * not create the file.
   *
   * @throws Error if the operation fails.
   */
  async exportCsvResults(
    cliServer: CodeQLCliServer,
    csvPath: string,
  ): Promise<boolean> {
    const resultSet = await this.chooseResultSet(cliServer);
    if (!resultSet) {
      void showAndLogWarningMessage("Query has no result set.");
      return false;
    }
    let stopDecoding = false;
    const out = createWriteStream(csvPath);

    const promise: Promise<boolean> = new Promise((resolve, reject) => {
      out.on("finish", () => resolve(true));
      out.on("error", () => {
        if (!stopDecoding) {
          stopDecoding = true;
          reject(new Error(`Failed to write CSV results to ${csvPath}`));
        }
      });
    });

    let nextOffset: number | undefined = 0;
    do {
      const chunk: DecodedBqrsChunk = await cliServer.bqrsDecode(
        this.resultsPaths.resultsPath,
        resultSet,
        {
          pageSize: 100,
          offset: nextOffset,
        },
      );
      chunk.tuples.forEach((tuple) => {
        out.write(
          `${tuple
            .map((v, i) => {
              if (chunk.columns[i].kind === "String") {
                return `"${
                  typeof v === "string" ? v.replaceAll('"', '""') : v
                }"`;
              } else if (chunk.columns[i].kind === "Entity") {
                return (v as EntityValue).label;
              } else {
                return v;
              }
            })
            .join(",")}\n`,
        );
      });
      nextOffset = chunk.next;
    } while (nextOffset && !stopDecoding);
    out.end();

    return promise;
  }

  /**
   * Choose the name of the result set to run. If the `#select` set exists, use that. Otherwise,
   * arbitrarily choose the first set. Most of the time, this will be correct.
   *
   * If the query has no result sets, then return undefined.
   */
  async chooseResultSet(cliServer: CodeQLCliServer) {
    const resultSets = (
      await cliServer.bqrsInfo(this.resultsPaths.resultsPath, 0)
    )["result-sets"];
    if (!resultSets.length) {
      return undefined;
    }
    if (resultSets.find((r) => r.name === SELECT_QUERY_NAME)) {
      return SELECT_QUERY_NAME;
    }
    return resultSets[0].name;
  }
  /**
   * Returns the path to the CSV alerts interpretation of this query results. If CSV results have
   * not yet been produced, this will return first create the CSV results and then return the path.
   *
   * This method only works for queries with interpreted results.
   */
  async ensureCsvAlerts(
    cliServer: CodeQLCliServer,
    dbm: DatabaseManager,
  ): Promise<string> {
    if (await this.hasCsv()) {
      return this.csvPath;
    }

    const dbItem = dbm.findDatabaseItem(Uri.file(this.dbItemPath));
    if (!dbItem) {
      throw new Error(
        `Cannot produce CSV results because database is missing. ${this.dbItemPath}`,
      );
    }

    let sourceInfo;
    if (dbItem.sourceArchive !== undefined) {
      sourceInfo = {
        sourceArchive: dbItem.sourceArchive.fsPath,
        sourceLocationPrefix: await dbItem.getSourceLocationPrefix(cliServer),
      };
    }
    await cliServer.generateResultsCsv(
      ensureMetadataIsComplete(this.metadata),
      this.resultsPaths.resultsPath,
      this.csvPath,
      sourceInfo,
    );
    return this.csvPath;
  }

  /**
   * Cleans this query's results directory.
   */
  async deleteQuery(): Promise<void> {
    await remove(this.querySaveDir);
  }
}

export interface QueryWithResults {
  readonly query: QueryEvaluationInfo;
  readonly logFileLocati  on?: string;
  readonly successful?: boolean;
  readonly message?: string;
  readonly result: legacyMessages.EvaluationResult;
}

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
  range?: Range,
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
      throw new Error(
        "No query was selected. Please select a query and try again.",
      );
    } else {
      queryUri = editor.document.uri;
    }
  }

  if (queryUri.scheme !== "file") {
    throw new Error("Can only run queries that are on disk.");
  }
  const queryPath = queryUri.fsPath;

  if (quickEval) {
    if (!(queryPath.endsWith(".ql") || queryPath.endsWith(".qll"))) {
      throw new Error(
        'The selected resource is not a CodeQL file; It should have the extension ".ql" or ".qll".',
      );
    }
  } else {
    if (!queryPath.endsWith(".ql")) {
      throw new Error(
        'The selected resource is not a CodeQL query file; It should have the extension ".ql".',
      );
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
    if (editor === undefined) {
      throw new Error("Can't run quick evaluation without an active editor.");
    }
    if (editor.document.fileName !== queryPath) {
      // For Quick Evaluation we expect these to be the same.
      // Report an error if we end up in this (hopefully unlikely) situation.
      throw new Error(
        "The selected resource for quick evaluation should match the active editor.",
      );
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

/** Gets the selected position within the given editor. */
async function getSelectedPosition(
  editor: TextEditor,
  range?: Range,
): Promise<messages.Position> {
  const selectedRange = range || editor.selection;
  const pos = selectedRange.start;
  const posEnd = selectedRange.end;
  // Convert from 0-based to 1-based line and column numbers.
  return {
    fileName: await convertToQlPath(editor.document.fileName),
    line: pos.line + 1,
    column: pos.character + 1,
    endLine: posEnd.line + 1,
    endColumn: posEnd.character + 1,
  };
}

/**
 * Prompts the user to save `document` if it has unsaved changes.
 *
 * @param document The document to save.
 *
 * @returns true if we should save changes and false if we should continue without saving changes.
 * @throws UserCancellationException if we should abort whatever operation triggered this prompt
 */
async function promptUserToSaveChanges(
  document: TextDocument,
): Promise<boolean> {
  if (document.isDirty) {
    if (AUTOSAVE_SETTING.getValue()) {
      return true;
    } else {
      const yesItem = { title: "Yes", isCloseAffordance: false };
      const alwaysItem = { title: "Always Save", isCloseAffordance: false };
      const noItem = {
        title: "No (run version on disk)",
        isCloseAffordance: false,
      };
      const cancelItem = { title: "Cancel", isCloseAffordance: true };
      const message = "Query file has unsaved changes. Save now?";
      const chosenItem = await window.showInformationMessage(
        message,
        { modal: true },
        yesItem,
        alwaysItem,
        noItem,
        cancelItem,
      );

      if (chosenItem === alwaysItem) {
        await AUTOSAVE_SETTING.updateValue(true, ConfigurationTarget.Workspace);
        return true;
      }

      if (chosenItem === yesItem) {
        return true;
      }

      if (chosenItem === cancelItem) {
        throw new UserCancellationException("Query run cancelled.", true);
      }
    }
  }
  return false;
}

/**
 * @param filePath This needs to be equivalent to Java's `Path.toRealPath(NO_FOLLOW_LINKS)`
 */
async function convertToQlPath(filePath: string): Promise<string> {
  if (process.platform === "win32") {
    if (parse(filePath).root === filePath) {
      // Java assumes uppercase drive letters are canonical.
      return filePath.toUpperCase();
    } else {
      const dir = await convertToQlPath(dirname(filePath));
      const fileName = basename(filePath);
      const fileNames = await readdir(dir);
      for (const name of fileNames) {
        // Leave the locale argument empty so that the default OS locale is used.
        // We do this because this operation works on filesystem entities, which
        // use the os locale, regardless of the locale of the running VS Code instance.
        if (
          fileName.localeCompare(name, undefined, { sensitivity: "accent" }) ===
          0
        ) {
          return join(dir, name);
        }
      }
    }
    throw new Error(`Can't convert path to form suitable for QL:${filePath}`);
  } else {
    return filePath;
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
  range?: Range,
): Promise<InitialQueryInfo> {
  // Determine which query to run, based on the selection and the active editor.
  const { queryPath, quickEvalPosition, quickEvalText } =
    await determineSelectedQuery(selectedQueryUri, isQuickEval, range);

  return {
    queryPath,
    isQuickEval,
    isQuickQuery: isQuickQueryPath(queryPath),
    databaseInfo,
    id: `${basename(queryPath)}-${nanoid()}`,
    start: new Date(),
    ...(isQuickEval
      ? {
          queryText: quickEvalText!, // if this query is quick eval, it must have quick eval text
          quickEvalPosition,
        }
      : {
          queryText: await readFile(queryPath, "utf8"),
        }),
  };
}
