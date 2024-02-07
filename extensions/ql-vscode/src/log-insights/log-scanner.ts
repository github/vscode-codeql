import type { SummaryEvent } from "./log-summary";
import { readJsonlFile } from "../common/jsonl-reader";
import type { Disposable } from "../common/disposable-object";

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
