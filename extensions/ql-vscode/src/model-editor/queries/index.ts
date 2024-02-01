import type { Query } from "./query";
import type { QueryLanguage } from "../../common/query-language";

export const fetchExternalApiQueries: Partial<Record<QueryLanguage, Query>> = {
  // Right now, there are no bundled queries. However, if we're adding a new
  // language for the model editor, we can add the query here.
};
