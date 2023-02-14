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

export const PACKS_BY_QUERY_LANGUAGE = {
  [QueryLanguage.Cpp]: ["codeql/cpp-queries"],
  [QueryLanguage.CSharp]: [
    "codeql/csharp-queries",
    "codeql/csharp-solorigate-queries",
  ],
  [QueryLanguage.Go]: ["codeql/go-queries"],
  [QueryLanguage.Java]: ["codeql/java-queries"],
  [QueryLanguage.Javascript]: [
    "codeql/javascript-queries",
    "codeql/javascript-experimental-atm-queries",
  ],
  [QueryLanguage.Python]: ["codeql/python-queries"],
  [QueryLanguage.Ruby]: ["codeql/ruby-queries"],
};
