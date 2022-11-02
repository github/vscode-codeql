import { VariantAnalysisHistoryItem } from '../../../remote-queries/variant-analysis-history-item';
import { QueryStatus } from '../../../query-status';
import { VariantAnalysisStatus } from '../../../remote-queries/shared/variant-analysis';
import { createMockVariantAnalysis } from './shared/variant-analysis';

export function createMockVariantAnalysisHistoryItem(
  historyItemStatus: QueryStatus = QueryStatus.InProgress,
  variantAnalysisStatus: VariantAnalysisStatus = VariantAnalysisStatus.Succeeded,
  failureReason?: string,
  resultCount?: number,
  userSpecifiedLabel?: string
): VariantAnalysisHistoryItem {
  return ({
    t: 'variant-analysis',
    failureReason,
    resultCount,
    status: historyItemStatus,
    completed: false,
    variantAnalysis: createMockVariantAnalysis(variantAnalysisStatus),
    userSpecifiedLabel,
  } as unknown) as VariantAnalysisHistoryItem;
}

