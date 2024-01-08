import { QueryLanguageDto } from "./query-history-dto";
import { QueryLanguage } from "../../common/query-language";
import { assertNever } from "../../common/helpers-pure";

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
