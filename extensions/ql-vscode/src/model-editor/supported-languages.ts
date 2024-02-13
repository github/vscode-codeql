import { QueryLanguage } from "../common/query-language";
import type { ModelConfig } from "../config";
import { isCanary } from "../config";

/**
 * Languages that are always supported by the model editor. These languages
 * do not require a separate config setting to enable them.
 */
export const SUPPORTED_LANGUAGES: QueryLanguage[] = [
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
    // Ruby is only enabled when in canary mode
    return isCanary();
  }

  if (language === QueryLanguage.Python) {
    // Python is only enabled when the config setting is set
    return modelConfig.enablePython;
  }

  return false;
}
