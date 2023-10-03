import { assertNever } from "../../common/helpers-pure";
import { QueryHistoryInfo } from "../query-history-info";
import { mapLocalQueryInfoToDto } from "./query-history-local-query-domain-mapper";
import { QueryHistoryItemDto, QueryLanguageDto } from "./query-history-dto";
import { mapQueryHistoryVariantAnalysisToDto } from "./query-history-variant-analysis-domain-mapper";
import { QueryLanguage } from "../../common/query-language";

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

export function mapQueryLanguageToDto(
  language: QueryLanguage,
): QueryLanguageDto {
  switch (language) {
    case QueryLanguage.CSharp:
      return QueryLanguageDto.CSharp;
    case QueryLanguage.Cpp:
      return QueryLanguageDto.Cpp;
    case QueryLanguage.Go:
      return QueryLanguageDto.Go;
    case QueryLanguage.Java:
      return QueryLanguageDto.Java;
    case QueryLanguage.Javascript:
      return QueryLanguageDto.Javascript;
    case QueryLanguage.Python:
      return QueryLanguageDto.Python;
    case QueryLanguage.Ruby:
      return QueryLanguageDto.Ruby;
    case QueryLanguage.Swift:
      return QueryLanguageDto.Swift;
    default:
      assertNever(language);
  }
}
