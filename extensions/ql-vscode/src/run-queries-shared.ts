import type { Position } from "./query-server/messages-shared";
import type { DatabaseInfo, QueryMetadata } from "./common/interface-types";
import { join, parse, dirname, basename } from "path";
import type { Range, TextEditor } from "vscode";
import { Uri, window, workspace } from "vscode";
import { isCanary, VSCODE_SAVE_BEFORE_START_SETTING } from "./config";
import {
  pathExists,
  readFile,
  createWriteStream,
  remove,
  readdir,
  ensureDir,
  writeFile,
} from "fs-extra";
import type { InitialQueryInfo } from "./query-results";
import { ensureMetadataIsComplete } from "./query-results";
import { isQuickQueryPath } from "./local-queries/quick-query";
import { nanoid } from "nanoid";
import type { CodeQLCliServer } from "./codeql-cli/cli";
import { SELECT_QUERY_NAME } from "./language-support";
import type { DatabaseManager } from "./databases/local-databases";
import type {
  DecodedBqrsChunk,
  BqrsEntityValue,
} from "./common/bqrs-cli-types";
import type { BaseLogger } from "./common/logging";
import { showAndLogWarningMessage } from "./common/logging";
import { extLogger } from "./common/logging/vscode";
import { generateSummarySymbolsFile } from "./log-insights/summary-parser";
import { getErrorMessage } from "./common/helpers-pure";
import { createHash } from "crypto";
import { QueryOutputDir } from "./local-queries/query-output-dir";
import { progressUpdate } from "./common/vscode/progress";
import type { ProgressCallback } from "./common/vscode/progress";

/**
 * run-queries.ts
 * --------------
 *
 * Compiling and running QL queries.
 */

/**
 * Holds the paths to the various structured log summary files generated for a query evaluation.
 */
export interface EvaluatorLogPaths {
  log: string;
  humanReadableSummary: string | undefined;
  endSummary: string | undefined;
  jsonSummary: string | undefined;
  summarySymbols: string | undefined;
}

export class QueryEvaluationInfo extends QueryOutputDir {
  // We extend `QueryOutputDir`, rather than having it as a property, because we need
  // `QueryOutputDir`'s `querySaveDir` property to be a property of `QueryEvaluationInfo`. This is
  // because `QueryEvaluationInfo` is serialized directly as JSON, and before we hoisted
  // `QueryOutputDir` out into a base class, `querySaveDir` was a property on `QueryEvaluationInfo`
  // itself.

  /**
   * Note that in the {@link readQueryHistoryFromFile} method, we create a QueryEvaluationInfo instance
   * by explicitly setting the prototype in order to avoid calling this constructor.
   */
  constructor(
    querySaveDir: string,
    public readonly dbItemPath: string,
    public readonly databaseHasMetadataFile: boolean,
    public readonly quickEvalPosition?: Position,
    public readonly metadata?: QueryMetadata,
  ) {
    super(querySaveDir);
  }

  get resultsPaths() {
    return {
      resultsPath: this.bqrsPath,
      interpretedResultsPath: join(
        this.querySaveDir,
        this.metadata?.kind === "graph"
          ? "graphResults"
          : "interpretedResults.sarif",
      ),
    };
  }
  getSortedResultSetPath(resultSetName: string) {
    const hasher = createHash("sha256");
    hasher.update(resultSetName);
    return join(
      this.querySaveDir,
      `sortedResults-${hasher.digest("hex")}.bqrs`,
    );
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
      // We expect the qlo to be missing so we should ignore it
      throw new Error(
        `DIL was not found. Expected location: '${this.dilPath}'`,
      );
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
      void showAndLogWarningMessage(extLogger, "Query has no result set.");
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
                return (v as BqrsEntityValue).label;
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
      await cliServer.bqrsInfo(this.resultsPaths.resultsPath)
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
  readonly logFileLocation?: string;
  readonly successful: boolean;
  readonly message: string;
}

/**
 * Validates that the specified URI represents a QL query, and returns the file system path to that
 * query.
 *
 * If `allowLibraryFiles` is set, ".qll" files will also be allowed as query files.
 */
export function validateQueryUri(
  queryUri: Uri,
  allowLibraryFiles: boolean,
): string {
  if (queryUri.scheme !== "file") {
    throw new Error("Can only run queries that are on disk.");
  }
  const queryPath = queryUri.fsPath;
  validateQueryPath(queryPath, allowLibraryFiles);
  return queryPath;
}

/**
 * Validates that the specified path represents a QL query
 *
 * If `allowLibraryFiles` is set, ".qll" files will also be allowed as query files.
 */
export function validateQueryPath(
  queryPath: string,
  allowLibraryFiles: boolean,
): void {
  if (allowLibraryFiles) {
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
}

export interface QuickEvalContext {
  quickEvalPosition: Position;
  quickEvalText: string;
  quickEvalCount: boolean;
}

/**
 * Gets the selection to be used for quick evaluation.
 *
 * If `range` is specified, then that range will be used. Otherwise, the current selection will be
 * used.
 */
export async function getQuickEvalContext(
  range: Range | undefined,
  isCountOnly: boolean,
): Promise<QuickEvalContext> {
  const editor = window.activeTextEditor;
  if (editor === undefined) {
    throw new Error("Can't run quick evaluation without an active editor.");
  }
  // For Quick Evaluation, the selected position comes from the active editor, but it's possible
  // that query itself was a different file. We need to validate the path of the file we're using
  // for the QuickEval selection in case it was different.
  validateQueryUri(editor.document.uri, true);
  const quickEvalPosition = await getSelectedPosition(editor, range);
  let quickEvalText: string;
  if (!editor.selection?.isEmpty) {
    quickEvalText = editor.document.getText(editor.selection).trim();
  } else {
    // capture the entire line if the user didn't select anything
    const line = editor.document.lineAt(editor.selection.active.line);
    quickEvalText = line.text.trim();
  }

  return {
    quickEvalPosition,
    quickEvalText,
    quickEvalCount: isCountOnly,
  };
}

/**
 * Information about which query will be to be run, optionally including a QuickEval selection.
 */
export interface SelectedQuery {
  queryPath: string;
  quickEval?: QuickEvalContext;
}

/** Gets the selected position within the given editor. */
async function getSelectedPosition(
  editor: TextEditor,
  range?: Range,
): Promise<Position> {
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

type SaveBeforeStartMode =
  | "nonUntitledEditorsInActiveGroup"
  | "allEditorsInActiveGroup"
  | "none";

/**
 * Saves dirty files before running queries, based on the user's settings.
 */
export async function saveBeforeStart(): Promise<void> {
  const mode: SaveBeforeStartMode =
    (VSCODE_SAVE_BEFORE_START_SETTING.getValue<string>({
      languageId: "ql",
    }) as SaveBeforeStartMode) ?? "nonUntitledEditorsInActiveGroup";

  // Despite the names of the modes, the VS Code implementation doesn't restrict itself to the
  // current tab group. It saves all dirty files in all groups. We'll do the same.
  switch (mode) {
    case "nonUntitledEditorsInActiveGroup":
      await workspace.saveAll(false);
      break;

    case "allEditorsInActiveGroup":
      // The VS Code implementation of this mode only saves an untitled file if it is the document
      // in the active editor. That's too much work for us, so we'll just live with the inconsistency.
      await workspace.saveAll(true);
      break;

    case "none":
      break;

    default:
      // Unexpected value. Fall back to the default behavior.
      await workspace.saveAll(false);
      break;
  }
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
    throw new Error(`Can't convert path to form suitable for QL: ${filePath}`);
  } else {
    return filePath;
  }
}

/**
 * Determines the initial information for a query. This is everything of interest
 * we know about this query that is available before it is run.
 *
 * @param selectedQuery The query to run, including any quickeval info.
 * @param databaseInfo The database to run the query against.
 * @param outputDir The output directory for this query.
 * @returns The initial information for the query to be run.
 */
export async function createInitialQueryInfo(
  selectedQuery: SelectedQuery,
  databaseInfo: DatabaseInfo,
  outputDir: QueryOutputDir,
): Promise<InitialQueryInfo> {
  const isQuickEval = selectedQuery.quickEval !== undefined;
  const isQuickEvalCount = selectedQuery.quickEval?.quickEvalCount;
  return {
    queryPath: selectedQuery.queryPath,
    isQuickEval,
    isQuickEvalCount,
    isQuickQuery: isQuickQueryPath(selectedQuery.queryPath),
    databaseInfo,
    id: `${basename(selectedQuery.queryPath)}-${nanoid()}`,
    start: new Date(),
    ...(selectedQuery.quickEval !== undefined
      ? {
          queryText: selectedQuery.quickEval.quickEvalText,
          quickEvalPosition: selectedQuery.quickEval.quickEvalPosition,
        }
      : {
          queryText: await readFile(selectedQuery.queryPath, "utf8"),
        }),
    outputDir,
  };
}

export async function generateEvalLogSummaries(
  cliServer: CodeQLCliServer,
  outputDir: QueryOutputDir,
  progress: ProgressCallback,
): Promise<EvaluatorLogPaths | undefined> {
  const log = outputDir.evalLogPath;
  if (!(await pathExists(log))) {
    // No raw JSON log, so we can't generate any summaries.
    return undefined;
  }
  let humanReadableSummary: string | undefined = undefined;
  let endSummary: string | undefined = undefined;
  progress(progressUpdate(1, 3, "Generating evaluator log summary"));
  if (await generateHumanReadableLogSummary(cliServer, outputDir)) {
    humanReadableSummary = outputDir.evalLogSummaryPath;
    endSummary = outputDir.evalLogEndSummaryPath;
  }
  let jsonSummary: string | undefined = undefined;
  let summarySymbols: string | undefined = undefined;
  if (isCanary()) {
    // Generate JSON summary for viewer.
    progress(progressUpdate(2, 3, "Generating JSON log summary"));
    jsonSummary = outputDir.jsonEvalLogSummaryPath;
    await cliServer.generateJsonLogSummary(log, jsonSummary);

    if (humanReadableSummary !== undefined) {
      summarySymbols = outputDir.evalLogSummarySymbolsPath;
      if (
        !(await cliServer.cliConstraints.supportsGenerateSummarySymbolMap())
      ) {
        // We're using an old CLI that cannot generate the summary symbols file while generating the
        // human-readable log summary. As a fallback, create it by parsing the human-readable
        // summary.
        progress(progressUpdate(3, 3, "Generating summary symbols file"));
        await generateSummarySymbolsFile(humanReadableSummary, summarySymbols);
      }
    }
  }

  return {
    log,
    humanReadableSummary,
    endSummary,
    jsonSummary,
    summarySymbols,
  };
}

/**
 * Calls the appropriate CLI command to generate a human-readable log summary.
 * @param cliServer The cli server client.
 * @param outputDir The query's output directory, where all of the logs are located.
 * @returns True if the summary and end summary were generated, or false if not.
 */
async function generateHumanReadableLogSummary(
  cliServer: CodeQLCliServer,
  outputDir: QueryOutputDir,
): Promise<boolean> {
  try {
    await cliServer.generateLogSummary(
      outputDir.evalLogPath,
      outputDir.evalLogSummaryPath,
      outputDir.evalLogEndSummaryPath,
    );
    return true;
  } catch (e) {
    void showAndLogWarningMessage(
      extLogger,
      `Failed to generate human-readable structured evaluator log summary. Reason: ${getErrorMessage(
        e,
      )}`,
    );
    return false;
  }
}

/**
 * Logs the end summary to the Output window and log file.
 * @param logSummaryPath Path to the human-readable log summary
 * @param qs The query server client.
 */
export async function logEndSummary(
  endSummary: string,
  logger: BaseLogger,
): Promise<void> {
  try {
    const endSummaryContent = await readFile(endSummary, "utf-8");
    void logger.log(" --- Evaluator Log Summary --- ");
    void logger.log(endSummaryContent);
  } catch {
    void showAndLogWarningMessage(
      extLogger,
      `Could not read structured evaluator log end of summary file at ${endSummary}.`,
    );
  }
}

/**
 * Creates a file in the query directory that indicates when this query was created.
 * This is important for keeping track of when queries should be removed.
 *
 * @param storagePath The directory that will contain all files relevant to a query result.
 * It does not need to exist.
 */
export async function createTimestampFile(storagePath: string) {
  const timestampPath = join(storagePath, "timestamp");
  await ensureDir(storagePath);
  await writeFile(timestampPath, Date.now().toString(), "utf8");
}
