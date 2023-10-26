import { QueryLanguage } from "../../common/query-language";
import { ModelsAsDataLanguage } from "./models-as-data";
import { staticLanguage } from "./static";

const languages: Partial<Record<QueryLanguage, ModelsAsDataLanguage>> = {
  [QueryLanguage.CSharp]: staticLanguage,
  [QueryLanguage.Java]: staticLanguage,
};

export function getModelsAsDataLanguage(
  language: QueryLanguage,
): ModelsAsDataLanguage | undefined {
  return languages[language];
}
