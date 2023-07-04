import { VariantAnalysisHistoryItem } from "../../../src/query-history/variant-analysis-history-item";
import { QueryStatus } from "../../../src/query-history/query-status";
import {
  VariantAnalysis,
  VariantAnalysisStatus,
} from "../../../src/variant-analysis/shared/variant-analysis";
import { createMockVariantAnalysis } from "../variant-analysis/shared/variant-analysis";

export function createMockVariantAnalysisHistoryItem({
  historyItemStatus = QueryStatus.InProgress,
  variantAnalysisStatus = VariantAnalysisStatus.Succeeded,
  failureReason = undefined,
  resultCount = 0,
  userSpecifiedLabel = undefined,
  executionStartTime = undefined,
  variantAnalysis = undefined,
}: {
  historyItemStatus?: QueryStatus;
  variantAnalysisStatus?: VariantAnalysisStatus;
  failureReason?: string | undefined;
  resultCount?: number;
  userSpecifiedLabel?: string;
  executionStartTime?: number;
  variantAnalysis?: VariantAnalysis;
}): VariantAnalysisHistoryItem {
  return {
    t: "variant-analysis",
    failureReason,
    resultCount,
    status: historyItemStatus,
    completed: false,
    variantAnalysis:
      variantAnalysis ??
      createMockVariantAnalysis({
        status: variantAnalysisStatus,
        executionStartTime,
      }),
    userSpecifiedLabel,
  };
}
