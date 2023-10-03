import { QueryHistoryInfo } from "../query-history-info";
import { QueryHistoryItemDto, QueryLanguageDto } from "./query-history-dto";
import { mapQueryHistoryVariantAnalysisToDomainModel } from "./query-history-variant-analysis-dto-mapper";
import { mapLocalQueryItemToDomainModel } from "./query-history-local-query-dto-mapper";
import { QueryLanguage } from "../../common/query-language";
import { assertNever } from "../../common/helpers-pure";

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

export function mapQueryLanguageToDomainModel(
  language: QueryLanguageDto,
): QueryLanguage {
  switch (language) {
    case QueryLanguageDto.CSharp:
      return QueryLanguage.CSharp;
    case QueryLanguageDto.Cpp:
      return QueryLanguage.Cpp;
    case QueryLanguageDto.Go:
      return QueryLanguage.Go;
    case QueryLanguageDto.Java:
      return QueryLanguage.Java;
    case QueryLanguageDto.Javascript:
      return QueryLanguage.Javascript;
    case QueryLanguageDto.Python:
      return QueryLanguage.Python;
    case QueryLanguageDto.Ruby:
      return QueryLanguage.Ruby;
    case QueryLanguageDto.Swift:
      return QueryLanguage.Swift;
    default:
      assertNever(language);
  }
}
