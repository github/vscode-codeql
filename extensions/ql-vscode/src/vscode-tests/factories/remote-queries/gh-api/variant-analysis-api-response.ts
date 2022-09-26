import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
} from '../../../../remote-queries/gh-api/variant-analysis';
import {
  VariantAnalysisQueryLanguage
} from '../../../../remote-queries/shared/variant-analysis';

export function createMockApiResponse(
  scannedRepos: VariantAnalysisScannedRepository[],
  skippedRepos: VariantAnalysisSkippedRepositories
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
    status: 'in_progress',
    actions_workflow_run_id: 456,
    scanned_repositories: scannedRepos,
    skipped_repositories: skippedRepos
  };

  return variantAnalysis;
}

export function createFailedMockApiResponse(
  scannedRepos: VariantAnalysisScannedRepository[],
  skippedRepos: VariantAnalysisSkippedRepositories
): VariantAnalysisApiResponse {
  const variantAnalysis = createMockApiResponse(scannedRepos, skippedRepos);
  variantAnalysis.status = 'completed';
  variantAnalysis.failure_reason = 'internal_error';

  return variantAnalysis;
}
