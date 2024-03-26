import type { ModelsAsDataLanguage } from "../models-as-data";
import { staticLanguage } from "../static";

export const java: ModelsAsDataLanguage = {
  ...staticLanguage,
  predicates: {
    ...staticLanguage.predicates,
    sink: {
      ...staticLanguage.predicates.sink,
      supportedKinds: [
        ...staticLanguage.predicates.sink.supportedKinds,
        // https://github.com/github/codeql/blob/0c5ea975a4c4dc5c439b908c006e440cb9bdf926/shared/mad/codeql/mad/ModelValidation.qll#L32-L37
        "bean-validation",
        "fragment-injection",
        "groovy-injection",
        "hostname-verification",
        "information-leak",
        "intent-redirection",
        "jexl-injection",
        "jndi-injection",
        "mvel-injection",
        "notification",
        "ognl-injection",
        "pending-intents",
        "response-splitting",
        "trust-boundary-violation",
        "template-injection",
        "xpath-injection",
        "xslt-injection",
      ],
    },
    source: {
      ...staticLanguage.predicates.source,
      supportedKinds: [
        ...staticLanguage.predicates.source.supportedKinds,
        // https://github.com/github/codeql/blob/0c5ea975a4c4dc5c439b908c006e440cb9bdf926/shared/mad/codeql/mad/ModelValidation.qll#L120-L121
        "android-external-storage-dir",
        "contentprovider",
      ],
    },
  },
};
