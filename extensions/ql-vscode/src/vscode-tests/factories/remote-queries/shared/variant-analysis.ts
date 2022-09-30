import {
  VariantAnalysis,
  VariantAnalysisQueryLanguage,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisStatus,
} from '../../../../remote-queries/shared/variant-analysis';
import { createMockScannedRepos } from './scanned-repositories';
import { createMockSkippedRepos } from './skipped-repositories';

export function createMockVariantAnalysis(
  status: VariantAnalysisStatus = VariantAnalysisStatus.InProgress,
  scannedRepos: VariantAnalysisScannedRepository[] = createMockScannedRepos(),
  skippedRepos: VariantAnalysisSkippedRepositories = createMockSkippedRepos()
): VariantAnalysis {
  const variantAnalysis: VariantAnalysis = {
    id: 123,
    controllerRepoId: 456,
    query: {
      name: 'a-query-name',
      filePath: 'a-query-file-path',
      language: VariantAnalysisQueryLanguage.Javascript
    },
    databases: {
      repositories: ['1', '2', '3'],
    },
    status: status,
    actionsWorkflowRunId: 789,
    scannedRepos: scannedRepos,
    skippedRepos: skippedRepos
  };

  return variantAnalysis;
}
