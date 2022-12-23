import { VariantAnalysisHistoryItem } from "../../../src/remote-queries/variant-analysis-history-item";
import { QueryStatus } from "../../../src/query-status";
import { VariantAnalysisStatus } from "../../../src/remote-queries/shared/variant-analysis";
import { createMockVariantAnalysis } from "./shared/variant-analysis";

export function createMockVariantAnalysisHistoryItem({
  historyItemStatus = QueryStatus.InProgress,
  variantAnalysisStatus = VariantAnalysisStatus.Succeeded,
  failureReason = undefined,
  resultCount = 0,
  userSpecifiedLabel = "query-name",
  executionStartTime = undefined,
}: {
  historyItemStatus?: QueryStatus;
  variantAnalysisStatus?: VariantAnalysisStatus;
  failureReason?: string | undefined;
  resultCount?: number;
  userSpecifiedLabel?: string;
  executionStartTime?: number;
}): VariantAnalysisHistoryItem {
  return {
    t: "variant-analysis",
    failureReason,
    resultCount,
    status: historyItemStatus,
    completed: false,
    variantAnalysis: createMockVariantAnalysis({
      status: variantAnalysisStatus,
      executionStartTime,
    }),
    userSpecifiedLabel,
  };
}
