import { assertNever } from "../../common/helpers-pure";
import { QueryHistoryInfo } from "../query-history-info";
import { mapLocalQueryInfoToDto } from "./query-history-local-query-domain-mapper";
import { QueryHistoryItemDto } from "./query-history-dto";
import { mapQueryHistoryVariantAnalysisToDto } from "./query-history-variant-analysis-domain-mapper";

export function mapQueryHistoryToDto(
  queries: QueryHistoryInfo[],
): QueryHistoryItemDto[] {
  return queries.map((q) => {
    if (q.t === "variant-analysis") {
      return mapQueryHistoryVariantAnalysisToDto(q);
    } else if (q.t === "local") {
      return mapLocalQueryInfoToDto(q);
    } else {
      assertNever(q);
    }
  });
}
