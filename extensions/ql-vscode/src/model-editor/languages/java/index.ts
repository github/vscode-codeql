import type { ModelsAsDataLanguage } from "../models-as-data";
import { staticLanguage } from "../static";

export const java: ModelsAsDataLanguage = {
  ...staticLanguage,
  predicates: {
    ...staticLanguage.predicates,
    sink: {
      ...staticLanguage.predicates.sink,
    },
    source: {
      ...staticLanguage.predicates.source,
    },
  },
};
