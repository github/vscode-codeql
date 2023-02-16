import { VariantAnalysisHistoryItem } from "../../../src/query-history/variant-analysis-history-item";
import { QueryStatus } from "../../../src/query-status";
import {
  VariantAnalysis,
  VariantAnalysisStatus,
} from "../../../src/remote-queries/shared/variant-analysis";
import { createMockVariantAnalysis } from "../remote-queries/shared/variant-analysis";

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
