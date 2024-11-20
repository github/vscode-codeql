import { Diagnostic, DiagnosticSeverity, languages, Range, Uri } from "vscode";
import { DisposableObject } from "../common/disposable-object";
import type { QueryHistoryInfo } from "../query-history/query-history-info";
import type { EvaluationLogProblemReporter } from "./log-scanner";
import { EvaluationLogScannerSet } from "./log-scanner";
import type { PipelineInfo, SummarySymbols } from "./summary-parser";
import { readFile } from "fs-extra";
import { extLogger } from "../common/logging/vscode";
import type { QueryHistoryManager } from "../query-history/query-history-manager";

/**
 * Compute the key used to find a predicate in the summary symbols.
 * @param name The name of the predicate.
 * @param raHash The RA hash of the predicate.
 * @returns The key of the predicate, consisting of `name@shortHash`, where `shortHash` is the first
 * eight characters of `raHash`.
 */
function predicateSymbolKey(name: string, raHash: string): string {
  return `${name}@${raHash.substring(0, 8)}`;
}

/**
 * Implementation of `EvaluationLogProblemReporter` that generates `Diagnostic` objects to display
 * in the VS Code "Problems" view.
 */
class ProblemReporter implements EvaluationLogProblemReporter {
  public readonly diagnostics: Diagnostic[] = [];

  constructor(private readonly symbols: SummarySymbols | undefined) {}

  public reportProblem(
    predicateName: string,
    raHash: string,
    iteration: number,
    message: string,
  ): void {
    const nameWithHash = predicateSymbolKey(predicateName, raHash);
    const predicateSymbol = this.symbols?.predicates[nameWithHash];
    let predicateInfo: PipelineInfo | undefined = undefined;
    if (predicateSymbol !== undefined) {
      predicateInfo = predicateSymbol.iterations[iteration];
    }
    if (predicateInfo !== undefined) {
      const range = new Range(
        predicateInfo.raStartLine,
        0,
        predicateInfo.raEndLine + 1,
        0,
      );
      this.diagnostics.push(
        new Diagnostic(range, message, DiagnosticSeverity.Error),
      );
    }
  }

  public log(message: string): void {
    void extLogger.log(message);
  }
}

export class LogScannerService extends DisposableObject {
  public readonly scanners = new EvaluationLogScannerSet();
  private readonly diagnosticCollection = this.push(
    languages.createDiagnosticCollection("ql-eval-log"),
  );
  private currentItem: QueryHistoryInfo | undefined = undefined;

  constructor(qhm: QueryHistoryManager) {
    super();

    this.push(
      qhm.onDidChangeCurrentQueryItem(async (item) => {
        if (item !== this.currentItem) {
          this.currentItem = item;
          await this.scanEvalLog(item);
        }
      }),
    );

    this.push(
      qhm.onDidCompleteQuery(async (item) => {
        if (item === this.currentItem) {
          await this.scanEvalLog(item);
        }
      }),
    );
  }

  /**
   * Scan the evaluation log for a query, and report any diagnostics.
   *
   * @param query The query whose log is to be scanned.
   */
  public async scanEvalLog(query: QueryHistoryInfo | undefined): Promise<void> {
    this.diagnosticCollection.clear();

    if (query?.t !== "local" || query.evaluatorLogPaths === undefined) {
      return;
    }

    const { summarySymbols, jsonSummary, humanReadableSummary } =
      query.evaluatorLogPaths;

    if (jsonSummary === undefined || humanReadableSummary === undefined) {
      return;
    }

    const diagnostics = await this.scanLog(jsonSummary, summarySymbols);
    const uri = Uri.file(humanReadableSummary);
    this.diagnosticCollection.set(uri, diagnostics);
  }

  /**
   * Scan the evaluator summary log for problems, using the scanners for all registered providers.
   * @param jsonSummaryLocation The file path of the JSON summary log.
   * @param symbolsLocation The file path of the symbols file for the human-readable log summary.
   * @returns An array of `Diagnostic`s representing the problems found by scanners.
   */
  private async scanLog(
    jsonSummaryLocation: string,
    symbolsLocation: string | undefined,
  ): Promise<Diagnostic[]> {
    let symbols: SummarySymbols | undefined = undefined;
    if (symbolsLocation !== undefined) {
      symbols = JSON.parse(
        await readFile(symbolsLocation, { encoding: "utf-8" }),
      );
    }
    const problemReporter = new ProblemReporter(symbols);

    await this.scanners.scanLog(jsonSummaryLocation, problemReporter);

    return problemReporter.diagnostics;
  }
}
