import { VariantAnalysisQueryLanguage, VariantAnalysisSubmission } from '../../../../remote-queries/shared/variant-analysis';

export function createMockSubmission(): VariantAnalysisSubmission {
  return {
    startTime: 1234,
    controllerRepoId: 5678,
    actionRepoRef: 'repo-ref',
    query: {
      name: 'query-name',
      filePath: 'query-file-path',
      language: VariantAnalysisQueryLanguage.Javascript,
      pack: 'base64-encoded-string',
    },
    databases: {
      repositories: ['1', '2', '3'],
    }
  };
}
