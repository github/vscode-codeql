/**
 * Callback interface used to report diagnostics from a log scanner.
 */
export interface EvaluationLogProblemReporter {
  /**
   * Report a potential problem detected in the evaluation log for a non-recursive predicate.
   *
   * @param predicateName The mangled name of the predicate with the problem.
   * @param raHash The RA hash of the predicate with the problem.
   * @param message The problem message.
   */
  reportProblemNonRecursive(
    predicateName: string,
    raHash: string,
    message: string,
  ): void;

  /**
   * Report a potential problem detected in the evaluation log for the summary of a recursive pipeline.
   *
   * @param predicateName The mangled name of the predicate with the problem.
   * @param raHash The RA hash of the predicate with the problem.
   * @param order The particular order (pipeline name) that had the problem.
   * @param message The problem message.
   */
  reportProblemForRecursionSummary(
    predicateName: string,
    raHash: string,
    order: string,
    message: string,
  ): void;

  /**
   * Log a message about a problem in the implementation of the scanner. These will typically be
   * displayed separate from any problems reported via `reportProblem()`.
   */
  log(message: string): void;
}
