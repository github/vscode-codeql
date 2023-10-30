import { QueryLanguage } from "../common/query-language";
import { ModelConfig } from "../config";

/**
 * Languages that are always supported by the model editor. These languages
 * do not require a separate config setting to enable them.
 */
const SUPPORTED_LANGUAGES: QueryLanguage[] = [
  QueryLanguage.Java,
  QueryLanguage.CSharp,
];

export function isSupportedLanguage(
  language: QueryLanguage,
  modelConfig: ModelConfig,
) {
  if (SUPPORTED_LANGUAGES.includes(language)) {
    return true;
  }

  if (language === QueryLanguage.Ruby) {
    // Ruby is only enabled when the config setting is set
    return modelConfig.enableRuby;
  }

  return false;
}
