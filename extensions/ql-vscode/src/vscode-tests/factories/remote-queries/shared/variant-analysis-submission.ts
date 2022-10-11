import { faker } from '@faker-js/faker';
import { VariantAnalysisQueryLanguage, VariantAnalysisSubmission } from '../../../../remote-queries/shared/variant-analysis';

export function createMockSubmission(): VariantAnalysisSubmission {
  return {
    startTime: faker.datatype.number(),
    controllerRepoId: faker.datatype.number(),
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
