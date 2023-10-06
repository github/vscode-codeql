export enum QueryLanguage {
  CSharp = "csharp",
  Cpp = "cpp",
  Go = "go",
  Java = "java",
  Javascript = "javascript",
  Python = "python",
  Ruby = "ruby",
  Swift = "swift",
}

export function getLanguageDisplayName(language: string): string {
  switch (language) {
    case QueryLanguage.CSharp:
      return "C#";
    case QueryLanguage.Cpp:
      return "C / C++";
    case QueryLanguage.Go:
      return "Go";
    case QueryLanguage.Java:
      return "Java";
    case QueryLanguage.Javascript:
      return "JavaScript";
    case QueryLanguage.Python:
      return "Python";
    case QueryLanguage.Ruby:
      return "Ruby";
    case QueryLanguage.Swift:
      return "Swift";
    default:
      return language;
  }
}

export const PACKS_BY_QUERY_LANGUAGE = {
  [QueryLanguage.Cpp]: ["codeql/cpp-queries"],
  [QueryLanguage.CSharp]: [
    "codeql/csharp-queries",
    "codeql/csharp-solorigate-queries",
  ],
  [QueryLanguage.Go]: ["codeql/go-queries"],
  [QueryLanguage.Java]: ["codeql/java-queries"],
  [QueryLanguage.Javascript]: ["codeql/javascript-queries"],
  [QueryLanguage.Python]: ["codeql/python-queries"],
  [QueryLanguage.Ruby]: ["codeql/ruby-queries"],
};

export const dbSchemeToLanguage: Record<string, QueryLanguage> = {
  "semmlecode.javascript.dbscheme": QueryLanguage.Javascript,
  "semmlecode.cpp.dbscheme": QueryLanguage.Cpp,
  "semmlecode.dbscheme": QueryLanguage.Java,
  "semmlecode.python.dbscheme": QueryLanguage.Python,
  "semmlecode.csharp.dbscheme": QueryLanguage.CSharp,
  "go.dbscheme": QueryLanguage.Go,
  "ruby.dbscheme": QueryLanguage.Ruby,
  "swift.dbscheme": QueryLanguage.Swift,
};

export function isQueryLanguage(language: string): language is QueryLanguage {
  return Object.values(QueryLanguage).includes(language as QueryLanguage);
}

export function tryGetQueryLanguage(
  language: string,
): QueryLanguage | undefined {
  return isQueryLanguage(language) ? language : undefined;
}
