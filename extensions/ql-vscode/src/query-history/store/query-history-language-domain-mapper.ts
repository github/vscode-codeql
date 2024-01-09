import { assertNever } from "../../common/helpers-pure";
import { QueryLanguageDto } from "./query-history-dto";
import { QueryLanguage } from "../../common/query-language";

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
