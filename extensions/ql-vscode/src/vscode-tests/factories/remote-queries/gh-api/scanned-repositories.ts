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
    },
    analysis_status: analysisStatus,
    result_count: faker.datatype.number(),
    artifact_size_in_bytes: faker.datatype.number(),
    failure_message: ''
  };
}

export function createMockScannedRepos(): VariantAnalysisScannedRepository[] {
  const scannedRepo1 = createMockScannedRepo('mona1', false, 'succeeded');
  const scannedRepo2 = createMockScannedRepo('mona2', false, 'pending');
  const scannedRepo3 = createMockScannedRepo('mona3', false, 'in_progress');

  return [scannedRepo1, scannedRepo2, scannedRepo3];
}

