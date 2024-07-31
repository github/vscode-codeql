import { QueryLanguage } from "../common/query-language";
import type { ModelConfig } from "../config";

/**
 * Languages that are always supported by the model editor. These languages
 * do not require a separate config setting to enable them.
 */
export const SUPPORTED_LANGUAGES: QueryLanguage[] = [
  QueryLanguage.Java,
  QueryLanguage.CSharp,
  QueryLanguage.Ruby,
  QueryLanguage.Python,
];

export function isSupportedLanguage(
  language: QueryLanguage,
  _modelConfig: ModelConfig,
) {
  if (SUPPORTED_LANGUAGES.includes(language)) {
    return true;
  }

  return false;
}
