import { faker } from '@faker-js/faker';
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepository
} from '../../../../remote-queries/gh-api/variant-analysis';

export function createMockScannedRepo(
  name: string,
  isPrivate: boolean,
  analysisStatus: VariantAnalysisRepoStatus,
): VariantAnalysisScannedRepository {
  return {
    repository: {
      id: faker.datatype.number(),
      name: name,
      full_name: 'github/' + name,
      private: isPrivate,
      stargazers_count: faker.datatype.number(),
      updated_at: faker.date.past().toISOString(),
    },
    analysis_status: analysisStatus,
    result_count: faker.datatype.number(),
    artifact_size_in_bytes: faker.datatype.number()
  };
}

export function createMockScannedRepos(
  statuses: VariantAnalysisRepoStatus[] = ['succeeded', 'pending', 'in_progress']
): VariantAnalysisScannedRepository[] {
  return statuses.map(status => createMockScannedRepo(`mona-${status}`, false, status));
}

