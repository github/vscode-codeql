import { faker } from "@faker-js/faker";
import {
  VariantAnalysisNotFoundRepositoryGroup,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisSkippedRepositoryGroup,
} from "../../../../remote-queries/gh-api/variant-analysis";
import { createMockRepositoryWithMetadata } from "./repository";

export function createMockSkippedRepos(): VariantAnalysisSkippedRepositories {
  return {
    access_mismatch_repos: createMockSkippedRepoGroup(),
    no_codeql_db_repos: createMockSkippedRepoGroup(),
    not_found_repos: createMockNotFoundSkippedRepoGroup(),
    over_limit_repos: createMockSkippedRepoGroup(),
  };
}

export function createMockSkippedRepoGroup(): VariantAnalysisSkippedRepositoryGroup {
  return {
    repository_count: 2,
    repositories: [
      createMockRepositoryWithMetadata(),
      createMockRepositoryWithMetadata(),
    ],
  };
}

export function createMockNotFoundSkippedRepoGroup(): VariantAnalysisNotFoundRepositoryGroup {
  const repoName1 = "github/" + faker.random.word();
  const repoName2 = "github/" + faker.random.word();

  return {
    repository_count: 2,
    repository_full_names: [repoName1, repoName2],
  };
}
