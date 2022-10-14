import { RemoteQueryHistoryItem } from './remote-queries/remote-query-history-item';
import { VariantAnalysisHistoryItem } from './remote-queries/variant-analysis-history-item';
import { LocalQueryInfo } from './query-results';
import { assertNever } from './pure/helpers-pure';

export type QueryHistoryInfo = LocalQueryInfo | RemoteQueryHistoryItem | VariantAnalysisHistoryItem;

export function getRawQueryName(item: QueryHistoryInfo): string {
  switch (item.t) {
    case 'local':
      return item.getQueryName();
    case 'remote':
      return item.remoteQuery.queryName;
    case 'variant-analysis':
      return item.variantAnalysis.query.name;
    default:
      assertNever(item);
  }
}

export function getQueryId(item: QueryHistoryInfo): string {
  switch (item.t) {
    case 'local':
      return item.initialInfo.id;
    case 'remote':
      return item.queryId;
    case 'variant-analysis':
      return item.variantAnalysis.id.toString();
    default:
      assertNever(item);
  }
}
