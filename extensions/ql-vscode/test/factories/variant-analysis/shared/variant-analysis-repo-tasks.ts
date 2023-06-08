import { faker } from "@faker-js/faker";
import {
  VariantAnalysisRepositoryTask,
  VariantAnalysisRepoStatus,
} from "../../../../src/variant-analysis/shared/variant-analysis";
import { createMockRepositoryWithMetadata } from "./repository";

export function createMockVariantAnalysisRepositoryTask(
  data?: Partial<VariantAnalysisRepositoryTask>,
): VariantAnalysisRepositoryTask {
  return {
    repository: createMockRepositoryWithMetadata(),
    analysisStatus: VariantAnalysisRepoStatus.Pending,
    resultCount: faker.number.int(),
    artifactSizeInBytes: faker.number.int(),
    databaseCommitSha: faker.git.commitSha(),
    sourceLocationPrefix: faker.system.filePath(),
    artifactUrl: faker.internet.url(),
    ...data,
  };
}
