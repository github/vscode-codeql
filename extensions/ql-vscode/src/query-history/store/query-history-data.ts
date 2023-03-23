// Contains models and consts for the data we want to store in the query history store.
// Changes to these models should be done carefully and account for backwards compatibility of data.

import { LocalQueryHistoryItem } from "./local-query-history-item";
import { VariantAnalysisQueryHistoryItem } from "./variant-analysis-query-history-item";

export const ALLOWED_QUERY_HISTORY_VERSIONS = [1, 2];

export interface QueryHistoryData {
  version: number;
  queries: QueryHistoryDataItem[];
}

export type QueryHistoryDataItem =
  | LocalQueryHistoryItem
  | VariantAnalysisQueryHistoryItem;
