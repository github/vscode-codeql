/**
 * Location information for a single pipeline invocation in the RA.
 */
export interface PipelineInfo {
  startLine: number;
  raStartLine: number;
  raEndLine: number;
}

/**
 * Location information for a single predicate in the RA.
 */
interface PredicateSymbol {
  /**
   * `PipelineInfo` for each iteration. A non-recursive predicate will have a single iteration `0`.
   */
  iterations: Record<number, PipelineInfo>;

  /**
   * `PipelineInfo` for each order, summarised for all iterations that used that order. Empty for non-recursive predicates.
   */
  recursionSummaries: Record<string, PipelineInfo>;
}

/**
 * Location information for the RA from an evaluation log. Line numbers point into the
 * human-readable log summary.
 */
export interface SummarySymbols {
  predicates: Record<string, PredicateSymbol>;
}
