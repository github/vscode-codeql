import { faker } from "@faker-js/faker";
import { VariantAnalysisRepoTask } from "../../../../src/variant-analysis/gh-api/variant-analysis";
import { VariantAnalysisRepoStatus } from "../../../../src/variant-analysis/shared/variant-analysis";
import { createMockRepository } from "./repository";

export function createMockVariantAnalysisRepoTask(): VariantAnalysisRepoTask {
  return {
    repository: {
      ...createMockRepository(),
      private: false,
    },
    analysis_status: VariantAnalysisRepoStatus.Succeeded,
    result_count: faker.number.int(),
    artifact_size_in_bytes: faker.number.int(),
    artifact_url: "https://www.pickles.com",
  };
}
