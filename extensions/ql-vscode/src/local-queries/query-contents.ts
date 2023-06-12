import { basename } from "path";
import { dbSchemeToLanguage } from "../common/query-language";

/**
 * Returns the initial contents for an empty query, based on the language of the selected
 * databse.
 *
 * First try to use the given language name. If that doesn't exist, try to infer it based on
 * dbscheme. Otherwise return no import statement.
 *
 * @param language the database language or empty string if unknown
 * @param dbscheme path to the dbscheme file
 *
 * @returns an import and empty select statement appropriate for the selected language
 */
export function getInitialQueryContents(language: string, dbscheme: string) {
  if (!language) {
    const dbschemeBase = basename(dbscheme) as keyof typeof dbSchemeToLanguage;
    language = dbSchemeToLanguage[dbschemeBase];
  }

  return language ? `import ${language}\n\nselect ""` : 'select ""';
}
