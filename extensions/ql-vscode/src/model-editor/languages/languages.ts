import { QueryLanguage } from "../../common/query-language";
import type {
  ModelsAsDataLanguage,
  ModelsAsDataLanguagePredicates,
} from "./models-as-data";
import { csharp } from "./csharp";
import { java } from "./java";
import { python } from "./python";
import { ruby } from "./ruby";

const languages: Partial<Record<QueryLanguage, ModelsAsDataLanguage>> = {
  [QueryLanguage.CSharp]: csharp,
  [QueryLanguage.Java]: java,
  [QueryLanguage.Python]: python,
  [QueryLanguage.Ruby]: ruby,
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
