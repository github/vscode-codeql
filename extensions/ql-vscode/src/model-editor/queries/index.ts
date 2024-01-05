import { fetchExternalApisQuery as rubyFetchExternalApisQuery } from "./ruby";
import type { Query } from "./query";
import { QueryLanguage } from "../../common/query-language";

export const fetchExternalApiQueries: Partial<Record<QueryLanguage, Query>> = {
  [QueryLanguage.Ruby]: rubyFetchExternalApisQuery,
};
