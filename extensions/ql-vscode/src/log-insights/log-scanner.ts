import type { Disposable } from "../common/disposable-object";
import { readJsonlFile } from "../common/jsonl-reader";
import type { ProgressCallback } from "../common/vscode/progress";
import type { SummaryEvent } from "./log-summary";

/**
 * Callback interface used to report diagnostics from a log scanner.
 */
export interface EvaluationLogProblemReporter {
  /**
   * Report a potential problem detected in the evaluation log.
   *
   * @param predicateName The mangled name of the predicate with the problem.
   * @param raHash The RA hash of the predicate with the problem.
   * @param iteration The iteration number with the problem. For a non-recursive predicate, this
   * must be zero.
   * @param message The problem message.
   */
  reportProblem(
    predicateName: string,
    raHash: string,
    iteration: number,
    message: string,
  ): void;

  /**
   * Log a message about a problem in the implementation of the scanner. These will typically be
   * displayed separate from any problems reported via `reportProblem()`.
   */
  log(message: string): void;
}

/**
 * Interface implemented by a log scanner. Instances are created via
 * `EvaluationLogScannerProvider.createScanner()`.
 */
export interface EvaluationLogScanner {
  /**
   * Called for each event in the log summary, in order. The implementation can report problems via
   * the `EvaluationLogProblemReporter` interface that was supplied to `createScanner()`.
   * @param event The log summary event.
   */
  onEvent(event: SummaryEvent): void;
  /**
   * Called after all events in the log summary have been processed. The implementation can report
   * problems via the `EvaluationLogProblemReporter` interface that was supplied to
   * `createScanner()`.
   */
  onDone(): void;
}

/**
 * A factory for log scanners. When a log is to be scanned, all registered
 * `EvaluationLogScannerProviders` will be asked to create a new instance of `EvaluationLogScanner`
 * to do the scanning.
 */
export interface EvaluationLogScannerProvider {
  /**
   * Create a new instance of `EvaluationLogScanner` to scan a single summary log.
   * @param problemReporter Callback interface for reporting any problems discovered.
   */
  createScanner(
    problemReporter: EvaluationLogProblemReporter,
  ): EvaluationLogScanner;
}

export class EvaluationLogScannerSet {
  private readonly scannerProviders = new Map<
    number,
    EvaluationLogScannerProvider
  >();
  private nextScannerProviderId = 0;

  /**
   * Register a provider that can create instances of `EvaluationLogScanner` to scan evaluation logs
   * for problems.
   * @param provider The provider.
   * @returns A `Disposable` that, when disposed, will unregister the provider.
   */
  public registerLogScannerProvider(
    provider: EvaluationLogScannerProvider,
  ): Disposable {
    const id = this.nextScannerProviderId;
    this.nextScannerProviderId++;

    this.scannerProviders.set(id, provider);
    return {
      dispose: () => {
        this.scannerProviders.delete(id);
      },
    };
  }

  /**
   * Scan the evaluator summary log for problems, using the scanners for all registered providers.
   * @param jsonSummaryLocation The file path of the JSON summary log.
   * @param problemReporter Callback interface for reporting any problems discovered.
   */
  public async scanLog(
    jsonSummaryLocation: string,
    problemReporter: EvaluationLogProblemReporter,
  ): Promise<void> {
    const scanners = [...this.scannerProviders.values()].map((p) =>
      p.createScanner(problemReporter),
    );

    await readJsonlFile<SummaryEvent>(jsonSummaryLocation, async (obj) => {
      scanners.forEach((scanner) => {
        scanner.onEvent(obj);
      });
    });

    scanners.forEach((scanner) => scanner.onDone());
  }
}

/**
 * Scan the evaluator summary log using the given scanner. For convenience, returns the scanner.
 *
 * @param jsonSummaryLocation The file path of the JSON summary log.
 * @param scanner The scanner to process events from the log
 */
export async function scanLog<T extends EvaluationLogScanner>(
  jsonSummaryLocation: string,
  scanner: T,
  progress?: ProgressCallback,
): Promise<T> {
  progress?.({
    // all scans have step 1 - the backing progress tracker allows increments instead of steps - but for now we are happy with a tiny UI that says what is happening
    message: `Scanning ...`,
    step: 1,
    maxStep: 2,
  });
  await readJsonlFile<SummaryEvent>(jsonSummaryLocation, async (obj) => {
    scanner.onEvent(obj);
  });
  scanner.onDone();
  return scanner;
}
