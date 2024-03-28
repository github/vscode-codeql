import type { ModelsAsDataLanguage } from "../models-as-data";
import { staticLanguage } from "../static";

export const csharp: ModelsAsDataLanguage = {
  ...staticLanguage,
  predicates: {
    ...staticLanguage.predicates,
    sink: {
      ...staticLanguage.predicates.sink,
    },
    source: {
      ...staticLanguage.predicates.source,
      supportedKinds: [
        ...staticLanguage.predicates.source.supportedKinds,
        // https://github.com/github/codeql/blob/0c5ea975a4c4dc5c439b908c006e440cb9bdf926/shared/mad/codeql/mad/ModelValidation.qll#L122-L123
        "file-write",
        "windows-registry",
      ],
    },
  },
};
