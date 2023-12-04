import * as legacyMessages from "./legacy-messages";

// Used for formatting the result of a legacy query which might still be in the
// user's query history.
export function formatLegacyMessage(result: legacyMessages.EvaluationResult) {
  switch (result.resultType) {
    case legacyMessages.QueryResultType.CANCELLATION:
      return `cancelled after ${Math.round(
        result.evaluationTime / 1000,
      )} seconds`;
    case legacyMessages.QueryResultType.OOM:
      return "out of memory";
    case legacyMessages.QueryResultType.SUCCESS:
      return `finished in ${Math.round(result.evaluationTime / 1000)} seconds`;
    case legacyMessages.QueryResultType.TIMEOUT:
      return `timed out after ${Math.round(
        result.evaluationTime / 1000,
      )} seconds`;
    case legacyMessages.QueryResultType.OTHER_ERROR:
    default:
      return result.message ? `failed: ${result.message}` : "failed";
  }
}
