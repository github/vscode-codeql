import { faker } from "@faker-js/faker";
import type { VariantAnalysisSubmission } from "../../../../src/variant-analysis/shared/variant-analysis";
import { QueryLanguage } from "../../../../src/common/query-language";

export function createMockSubmission(): VariantAnalysisSubmission {
  return {
    startTime: faker.number.int(),
    controllerRepoId: faker.number.int(),
    actionRepoRef: "repo-ref",
    language: QueryLanguage.Javascript,
    pack: "base64-encoded-string",
    query: {
      name: "query-name",
      filePath: "query-file-path",
      text: "query-text",
      kind: "table",
    },
    databases: {
      repositories: ["1", "2", "3"],
    },
  };
}
