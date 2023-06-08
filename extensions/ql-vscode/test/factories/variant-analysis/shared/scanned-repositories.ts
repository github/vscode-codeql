import { faker } from "@faker-js/faker";
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepository,
} from "../../../../src/variant-analysis/shared/variant-analysis";
import { createMockRepositoryWithMetadata } from "./repository";

export function createMockScannedRepo(
  name: string = faker.random.word(),
  isPrivate: boolean = faker.datatype.boolean(),
  analysisStatus: VariantAnalysisRepoStatus = VariantAnalysisRepoStatus.Pending,
): VariantAnalysisScannedRepository {
  return {
    repository: {
      ...createMockRepositoryWithMetadata(),
      fullName: `github/${name}`,
      private: isPrivate,
    },
    analysisStatus,
    resultCount: faker.number.int(),
    artifactSizeInBytes: faker.number.int(),
  };
}

export function createMockScannedRepos(
  statuses: VariantAnalysisRepoStatus[] = [
    VariantAnalysisRepoStatus.Succeeded,
    VariantAnalysisRepoStatus.Pending,
    VariantAnalysisRepoStatus.InProgress,
  ],
): VariantAnalysisScannedRepository[] {
  return statuses.map((status) =>
    createMockScannedRepo(`mona-${status}`, false, status),
  );
}
