export enum QueryLanguage {
  Actions = "actions",
  CSharp = "csharp",
  Cpp = "cpp",
  Go = "go",
  Java = "java",
  Javascript = "javascript",
  Python = "python",
  Ruby = "ruby",
  Rust = "rust",
  Swift = "swift",
}

export function getLanguageDisplayName(language: string): string {
  switch (language) {
    case QueryLanguage.Actions:
      return "Actions";
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
    case QueryLanguage.Rust:
      return "Rust";
    case QueryLanguage.Swift:
      return "Swift";
    default:
      return language;
  }
}

export const PACKS_BY_QUERY_LANGUAGE = {
  [QueryLanguage.Actions]: ["codeql/actions-queries"],
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
  [QueryLanguage.Rust]: ["codeql/rust-queries"],
};

export const dbSchemeToLanguage: Record<string, QueryLanguage> = {
  "semmlecode.javascript.dbscheme": QueryLanguage.Javascript, // This can also be QueryLanguage.Actions
  "semmlecode.cpp.dbscheme": QueryLanguage.Cpp,
  "semmlecode.dbscheme": QueryLanguage.Java,
  "semmlecode.python.dbscheme": QueryLanguage.Python,
  "semmlecode.csharp.dbscheme": QueryLanguage.CSharp,
  "go.dbscheme": QueryLanguage.Go,
  "ruby.dbscheme": QueryLanguage.Ruby,
  "rust.dbscheme": QueryLanguage.Rust,
  "swift.dbscheme": QueryLanguage.Swift,
};

export const languageToDbScheme = Object.entries(dbSchemeToLanguage).reduce(
  (acc, [k, v]) => {
    acc[v] = k;
    return acc;
  },
  {} as { [k: string]: string },
);

// Actions dbscheme is the same as Javascript dbscheme
languageToDbScheme[QueryLanguage.Actions] =
  languageToDbScheme[QueryLanguage.Javascript];

export function isQueryLanguage(language: string): language is QueryLanguage {
  return Object.values(QueryLanguage).includes(language as QueryLanguage);
}

export function tryGetQueryLanguage(
  language: string,
): QueryLanguage | undefined {
  return isQueryLanguage(language) ? language : undefined;
}
