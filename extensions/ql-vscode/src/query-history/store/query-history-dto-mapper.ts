import type { QueryHistoryInfo } from "../query-history-info";
import type { QueryHistoryItemDto } from "./query-history-dto";
import { mapQueryHistoryVariantAnalysisToDomainModel } from "./query-history-variant-analysis-dto-mapper";
import { mapLocalQueryItemToDomainModel } from "./query-history-local-query-dto-mapper";

export function mapQueryHistoryToDomainModel(
  queries: QueryHistoryItemDto[],
): QueryHistoryInfo[] {
  return queries.map((d) => {
    if (d.t === "variant-analysis") {
      return mapQueryHistoryVariantAnalysisToDomainModel(d);
    } else if (d.t === "local") {
      return mapLocalQueryItemToDomainModel(d);
    }

    throw Error(
      `Unexpected or corrupted query history file. Unknown query history item: ${JSON.stringify(
        d,
      )}`,
    );
  });
}
