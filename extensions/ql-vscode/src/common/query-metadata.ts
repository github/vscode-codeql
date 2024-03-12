export const SARIF_RESULTS_QUERY_KINDS = [
  "problem",
  "alert",
  "path-problem",
  "path-alert",
];

/**
 * Returns whether this query kind supports producing SARIF results.
 */
export function isSarifResultsQueryKind(kind: string | undefined): boolean {
  if (!kind) {
    return false;
  }

  return SARIF_RESULTS_QUERY_KINDS.includes(kind);
}
