import { faker } from "@faker-js/faker";
import type { VariantAnalysisRepositoryTask } from "../../../../src/variant-analysis/shared/variant-analysis";
import { VariantAnalysisRepoStatus } from "../../../../src/variant-analysis/shared/variant-analysis";
import { createMockRepositoryWithMetadata } from "./repository";

export function createMockVariantAnalysisRepositoryTask(
  data?: Partial<VariantAnalysisRepositoryTask>,
): VariantAnalysisRepositoryTask &
  Required<Pick<VariantAnalysisRepositoryTask, "artifactUrl">> {
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
