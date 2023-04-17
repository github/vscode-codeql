import { fetchExternalApisQuery as csharpFetchExternalApisQuery } from "./csharp";
import { fetchExternalApisQuery as javaFetchExternalApisQuery } from "./java";
import { Query } from "./query";
import { QueryLanguage } from "../../common/query-language";

export const fetchExternalApiQueries: Partial<Record<QueryLanguage, Query>> = {
  [QueryLanguage.CSharp]: csharpFetchExternalApisQuery,
  [QueryLanguage.Java]: javaFetchExternalApisQuery,
};
