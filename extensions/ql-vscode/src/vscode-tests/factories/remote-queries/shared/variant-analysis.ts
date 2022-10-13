import { faker } from '@faker-js/faker';
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
    id: faker.datatype.number(),
    controllerRepoId: faker.datatype.number(),
    query: {
      name: 'a-query-name',
      filePath: 'a-query-file-path',
      language: VariantAnalysisQueryLanguage.Javascript,
      text: 'a-query-text',
    },
    databases: {
      repositories: ['1', '2', '3'],
    },
    executionStartTime: faker.datatype.number(),
    status: status,
    actionsWorkflowRunId: faker.datatype.number(),
    scannedRepos: scannedRepos,
    skippedRepos: skippedRepos
  };

  return variantAnalysis;
}
