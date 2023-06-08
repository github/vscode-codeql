import { faker } from "@faker-js/faker";
import { VariantAnalysisSubmission } from "../../../../src/variant-analysis/shared/variant-analysis";
import { QueryLanguage } from "../../../../src/common/query-language";

export function createMockSubmission(): VariantAnalysisSubmission {
  return {
    startTime: faker.number.int(),
    controllerRepoId: faker.number.int(),
    actionRepoRef: "repo-ref",
    query: {
      name: "query-name",
      filePath: "query-file-path",
      language: QueryLanguage.Javascript,
      text: "query-text",
      pack: "base64-encoded-string",
    },
    databases: {
      repositories: ["1", "2", "3"],
    },
  };
}
