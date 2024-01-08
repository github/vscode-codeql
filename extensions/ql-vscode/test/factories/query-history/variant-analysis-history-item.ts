import type { VariantAnalysisHistoryItem } from "../../../src/query-history/variant-analysis-history-item";
import { QueryStatus } from "../../../src/query-history/query-status";
import type { VariantAnalysis } from "../../../src/variant-analysis/shared/variant-analysis";
import { VariantAnalysisStatus } from "../../../src/variant-analysis/shared/variant-analysis";
import { createMockVariantAnalysis } from "../variant-analysis/shared/variant-analysis";
import { QueryLanguage } from "../../../src/common/query-language";

export function createMockVariantAnalysisHistoryItem({
  historyItemStatus = QueryStatus.InProgress,
  variantAnalysisStatus = VariantAnalysisStatus.Succeeded,
  failureReason = undefined,
  resultCount = 0,
  userSpecifiedLabel = undefined,
  executionStartTime = undefined,
  variantAnalysis = undefined,
  language = QueryLanguage.Javascript,
}: {
  historyItemStatus?: QueryStatus;
  variantAnalysisStatus?: VariantAnalysisStatus;
  failureReason?: string | undefined;
  resultCount?: number;
  userSpecifiedLabel?: string;
  executionStartTime?: number;
  variantAnalysis?: VariantAnalysis;
  language?: QueryLanguage;
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
        language,
      }),
    userSpecifiedLabel,
  };
}
