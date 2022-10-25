import { faker } from '@faker-js/faker';
import { VariantAnalysisScannedRepositoryResult } from '../../../../remote-queries/shared/variant-analysis';

export function createMockScannedRepoResult(): VariantAnalysisScannedRepositoryResult {
  return {
    variantAnalysisId: faker.datatype.number(),
    repositoryId: faker.datatype.number()
  };
}
