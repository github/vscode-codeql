// Contains models and consts for the data we want to store in the query history store.
// Changes to these models should be done carefully and account for backwards compatibility of data.

import { QueryHistoryLocalQueryDto } from "./query-history-local-query-dto";
import { QueryHistoryVariantAnalysisDto } from "./query-history-variant-analysis-dto";

export const ALLOWED_QUERY_HISTORY_VERSIONS = [1, 2];

export interface QueryHistoryDto {
  version: number;
  queries: QueryHistoryItemDto[];
}

export type QueryHistoryItemDto =
  | QueryHistoryLocalQueryDto
  | QueryHistoryVariantAnalysisDto;
