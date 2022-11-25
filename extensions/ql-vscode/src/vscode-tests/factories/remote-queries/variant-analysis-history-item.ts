import { VariantAnalysisHistoryItem } from "../../../remote-queries/variant-analysis-history-item";
import { QueryStatus } from "../../../query-status";
import { VariantAnalysisStatus } from "../../../remote-queries/shared/variant-analysis";
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
      executionStartTime: executionStartTime,
    }),
    userSpecifiedLabel,
  };
}
