import { faker } from "@faker-js/faker";
import type {
  VariantAnalysisSkippedRepositories,
  VariantAnalysisSkippedRepositoryGroup,
} from "../../../../src/variant-analysis/shared/variant-analysis";
import { createMockRepositoryWithMetadata } from "./repository";

export function createMockSkippedRepos(): VariantAnalysisSkippedRepositories {
  return {
    accessMismatchRepos: createMockSkippedRepoGroup(),
    noCodeqlDbRepos: createMockSkippedRepoGroup(),
    notFoundRepos: createMockNotFoundRepoGroup(),
    overLimitRepos: createMockSkippedRepoGroup(),
  };
}

function createMockSkippedRepoGroup(): VariantAnalysisSkippedRepositoryGroup {
  return {
    repositoryCount: 2,
    repositories: [
      createMockRepositoryWithMetadata(),
      createMockRepositoryWithMetadata(),
    ],
  };
}

function createMockNotFoundRepoGroup(): VariantAnalysisSkippedRepositoryGroup {
  return {
    repositoryCount: 2,
    repositories: [
      {
        fullName: `github/${faker.word.sample()}`,
      },
      {
        fullName: `github/${faker.word.sample()}`,
      },
    ],
  };
}
