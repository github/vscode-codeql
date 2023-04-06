// Contains models and consts for the data we want to store in the query history store.
// Changes to these models should be done carefully and account for backwards compatibility of data.

import { LocalQueryDataItem } from "./local-query-data-item";
import { VariantAnalysisDataItem } from "./variant-analysis-data-item";

export const ALLOWED_QUERY_HISTORY_VERSIONS = [1, 2];

export interface QueryHistoryData {
  version: number;
  queries: QueryHistoryDataItem[];
}

export type QueryHistoryDataItem = LocalQueryDataItem | VariantAnalysisDataItem;
