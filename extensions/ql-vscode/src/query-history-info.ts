import { RemoteQueryHistoryItem } from './remote-queries/remote-query-history-item';
import { VariantAnalysisHistoryItem } from './remote-queries/variant-analysis-history-item';
import { LocalQueryInfo } from './query-results';

export type QueryHistoryInfo = LocalQueryInfo | RemoteQueryHistoryItem | VariantAnalysisHistoryItem;

