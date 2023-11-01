import { QueryLanguage } from "../../common/query-language";
import {
  ModelsAsDataLanguage,
  ModelsAsDataLanguagePredicates,
} from "./models-as-data";
import { staticLanguage } from "./static";

const languages: Partial<Record<QueryLanguage, ModelsAsDataLanguage>> = {
  [QueryLanguage.CSharp]: staticLanguage,
  [QueryLanguage.Java]: staticLanguage,
};

export function getModelsAsDataLanguage(
  language: QueryLanguage,
): ModelsAsDataLanguage {
  const definition = languages[language];
  if (!definition) {
    throw new Error(`No models-as-data definition for ${language}`);
  }
  return definition;
}

export function getModelsAsDataLanguageModel<
  T extends keyof ModelsAsDataLanguagePredicates,
>(
  language: QueryLanguage,
  model: T,
): NonNullable<ModelsAsDataLanguagePredicates[T]> {
  const definition = getModelsAsDataLanguage(language).predicates[model];
  if (!definition) {
    throw new Error(`No models-as-data predicate for ${model}`);
  }
  return definition;
}
