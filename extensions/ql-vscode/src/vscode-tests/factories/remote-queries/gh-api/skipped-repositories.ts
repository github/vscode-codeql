import { faker } from '@faker-js/faker';
import {
  VariantAnalysisNotFoundRepositoryGroup,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisSkippedRepositoryGroup
} from '../../../../remote-queries/gh-api/variant-analysis';

export function createMockSkippedRepos(): VariantAnalysisSkippedRepositories {
  return {
    access_mismatch_repos: createMockSkippedRepoGroup(),
    no_codeql_db_repos: createMockSkippedRepoGroup(),
    not_found_repo_nwos: createMockNotFoundSkippedRepoGroup(),
    over_limit_repos: createMockSkippedRepoGroup()
  };
}

export function createMockSkippedRepoGroup(): VariantAnalysisSkippedRepositoryGroup {
  return {
    repository_count: 2,
    repositories: [
      {
        id: faker.datatype.number(),
        name: faker.random.word(),
        full_name: 'github/' + faker.random.word(),
        private: true
      },
      {
        id: faker.datatype.number(),
        name: faker.random.word(),
        full_name: 'github/' + faker.random.word(),
        private: false
      }
    ]
  };
}

export function createMockNotFoundSkippedRepoGroup(): VariantAnalysisNotFoundRepositoryGroup {
  const repoName1 = 'github/' + faker.random.word();
  const repoName2 = 'github/' + faker.random.word();

  return {
    repository_count: 2,
    repository_full_names: [repoName1, repoName2]
  };
}
