import { faker } from "@faker-js/faker";
import type {
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepository,
} from "../../../../src/variant-analysis/gh-api/variant-analysis";
import { createMockRepositoryWithMetadata } from "./repository";

export function createMockScannedRepo(
  name: string,
  isPrivate: boolean,
  analysisStatus: VariantAnalysisRepoStatus,
): VariantAnalysisScannedRepository {
  return {
    repository: {
      ...createMockRepositoryWithMetadata(),
      name,
      full_name: `github/${name}`,
      private: isPrivate,
    },
    analysis_status: analysisStatus,
    result_count: faker.number.int(),
    artifact_size_in_bytes: faker.number.int(),
  };
}

export function createMockScannedRepos(
  statuses: VariantAnalysisRepoStatus[] = [
    "succeeded",
    "pending",
    "in_progress",
  ],
): VariantAnalysisScannedRepository[] {
  return statuses.map((status) =>
    createMockScannedRepo(`mona-${status}`, false, status),
  );
}
