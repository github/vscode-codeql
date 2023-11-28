import * as legacyMessages from "./legacy-messages";

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
