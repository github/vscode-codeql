import { faker } from '@faker-js/faker';
import {
  VariantAnalysisSkippedRepositories,
  VariantAnalysisSkippedRepositoryGroup
} from '../../../../remote-queries/shared/variant-analysis';

export function createMockSkippedRepos(): VariantAnalysisSkippedRepositories {
  return {
    accessMismatchRepos: createMockSkippedRepoGroup(),
    noCodeqlDbRepos: createMockSkippedRepoGroup(),
    notFoundRepos: createMockNotFoundRepoGroup(),
    overLimitRepos: createMockSkippedRepoGroup()
  };
}

export function createMockSkippedRepoGroup(): VariantAnalysisSkippedRepositoryGroup {
  return {
    repositoryCount: 2,
    repositories: [
      {
        id: faker.datatype.number(),
        fullName: 'github/' + faker.random.word(),
      },
      {
        id: faker.datatype.number(),
        fullName: 'github/' + faker.random.word(),
      }
    ]
  };
}

export function createMockNotFoundRepoGroup(): VariantAnalysisSkippedRepositoryGroup {
  return {
    repositoryCount: 2,
    repositories: [
      {
        fullName: 'github/' + faker.random.word(),
      },
      {
        fullName: 'github/' + faker.random.word(),
      }
    ]
  };
}
