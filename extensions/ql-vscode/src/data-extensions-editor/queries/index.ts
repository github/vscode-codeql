import { fetchExternalApisQuery as javaFetchExternalApisQuery } from "./java";
import { Query } from "./query";

export const fetchExternalApiQueries: Record<string, Query> = {
  java: javaFetchExternalApisQuery,
};
