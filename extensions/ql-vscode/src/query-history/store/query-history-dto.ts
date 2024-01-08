// Contains models and consts for the data we want to store in the query history store.
// Changes to these models should be done carefully and account for backwards compatibility of data.

import type { QueryHistoryLocalQueryDto } from "./query-history-local-query-dto";
import type { QueryHistoryVariantAnalysisDto } from "./query-history-variant-analysis-dto";

export interface QueryHistoryDto {
  version: number;
  queries: QueryHistoryItemDto[];
}

export type QueryHistoryItemDto =
  | QueryHistoryLocalQueryDto
  | QueryHistoryVariantAnalysisDto;

export enum QueryLanguageDto {
  CSharp = "csharp",
  Cpp = "cpp",
  Go = "go",
  Java = "java",
  Javascript = "javascript",
  Python = "python",
  Ruby = "ruby",
  Swift = "swift",
}
