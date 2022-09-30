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
    id: 123,
    controller_repo: {
      id: 456,
      name: 'pickles',
      full_name: 'github/pickles',
      private: false,
    },
    actor_id: 123,
    query_language: VariantAnalysisQueryLanguage.Javascript,
    query_pack_url: 'https://example.com/foo',
    status: status,
    actions_workflow_run_id: 456,
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
