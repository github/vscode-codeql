import { fetchExternalApisQuery as javaFetchExternalApisQuery } from "./java";
import { Query } from "./query";
import { QueryLanguage } from "../../common/query-language";

export const fetchExternalApiQueries: Partial<Record<QueryLanguage, Query>> = {
  [QueryLanguage.Java]: javaFetchExternalApisQuery,
};
