import { faker } from '@faker-js/faker';
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisScannedRepository
} from '../../../../remote-queries/shared/variant-analysis';

export function createMockScannedRepo(
  name: string,
  isPrivate: boolean,
  analysisStatus: VariantAnalysisRepoStatus,
): VariantAnalysisScannedRepository {
  return {
    repository: {
      id: faker.datatype.number(),
      fullName: 'github/' + name,
      private: isPrivate,
    },
    analysisStatus: analysisStatus,
    resultCount: faker.datatype.number(),
    artifactSizeInBytes: faker.datatype.number()
  };
}

export function createMockScannedRepos(
  statuses: VariantAnalysisRepoStatus[] = [
    VariantAnalysisRepoStatus.Succeeded,
    VariantAnalysisRepoStatus.Pending,
    VariantAnalysisRepoStatus.InProgress,
  ]
): VariantAnalysisScannedRepository[] {
  return statuses.map(status => createMockScannedRepo(`mona-${status}`, false, status));
}

