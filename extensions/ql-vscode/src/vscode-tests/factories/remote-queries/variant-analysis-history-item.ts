import { faker } from '@faker-js/faker';
import { VariantAnalysisHistoryItem } from '../../../remote-queries/variant-analysis-history-item';
import { QueryStatus } from '../../../query-status';
import { VariantAnalysisStatus } from '../../../remote-queries/shared/variant-analysis';

export function createMockVariantAnalysisHistoryItem(
  historyItemStatus: QueryStatus = QueryStatus.InProgress,
  variantAnalysisStatus: VariantAnalysisStatus = VariantAnalysisStatus.Succeeded,
  failureReason?: string,
  resultCount?: number,
  userSpecifiedLabel?: string
): VariantAnalysisHistoryItem {
  return ({
    t: 'variant-analysis',
    failureReason,
    resultCount,
    status: historyItemStatus,
    completed: false,
    variantAnalysis: {
      'id': faker.datatype.number(),
      'controllerRepoId': faker.datatype.number(),
      'query': {
        'name': 'Variant Analysis Query History Item',
        'filePath': 'PLACEHOLDER/q2.ql',
        'language': 'ruby',
        'text': '/**\n * @name Variant Analysis Query History Item\n * @kind problem\n * @problem.severity warning\n * @id ruby/example/empty-block\n */\nimport ruby\n\nfrom Block b\nwhere b.getNumberOfStatements() = 0\nselect b, \'This is an empty block.\'\n'
      },
      'databases': {
        'repositories': ['92384123', '1230871']
      },
      'createdAt': faker.date.recent().toISOString(),
      'updatedAt': faker.date.recent().toISOString(),
      'executionStartTime': faker.date.recent().toISOString(),
      'status': variantAnalysisStatus,
      'actionsWorkflowRunId': faker.datatype.number()
    },
    userSpecifiedLabel,
  } as unknown) as VariantAnalysisHistoryItem;
}

