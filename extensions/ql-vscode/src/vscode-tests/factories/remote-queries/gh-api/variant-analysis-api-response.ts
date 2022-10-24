import { faker } from '@faker-js/faker';
import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisStatus,
} from '../../../../remote-queries/gh-api/variant-analysis';
import {
  VariantAnalysisQueryLanguage
} from '../../../../remote-queries/shared/variant-analysis';
import { createMockScannedRepos } from './scanned-repositories';
import { createMockSkippedRepos } from './skipped-repositories';

export function createMockApiResponse(
  status: VariantAnalysisStatus = 'in_progress',
  scannedRepos: VariantAnalysisScannedRepository[] = createMockScannedRepos(),
  skippedRepos: VariantAnalysisSkippedRepositories = createMockSkippedRepos()
): VariantAnalysisApiResponse {

  const variantAnalysis: VariantAnalysisApiResponse = {
    id: faker.datatype.number(),
    controller_repo: {
      id: faker.datatype.number(),
      name: 'pickles',
      full_name: 'github/pickles',
      private: false,
    },
    actor_id: faker.datatype.number(),
    query_language: VariantAnalysisQueryLanguage.Javascript,
    query_pack_url: 'https://example.com/foo',
    created_at: faker.date.recent().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    status: status,
    actions_workflow_run_id: faker.datatype.number(),
    scanned_repositories: scannedRepos,
    skipped_repositories: skippedRepos
  };

  return variantAnalysis;
}

export function createFailedMockApiResponse(
  status: VariantAnalysisStatus = 'in_progress',
  scannedRepos: VariantAnalysisScannedRepository[] = createMockScannedRepos(),
  skippedRepos: VariantAnalysisSkippedRepositories = createMockSkippedRepos(),
): VariantAnalysisApiResponse {
  const variantAnalysis = createMockApiResponse(status, scannedRepos, skippedRepos);
  variantAnalysis.status = status;
  variantAnalysis.failure_reason = 'internal_error';

  return variantAnalysis;
}
