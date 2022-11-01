import { RemoteQueryHistoryItem } from '../../../remote-queries/remote-query-history-item';
import { QueryStatus } from '../../../query-status';

export function createMockRemoteQueryHistoryItem({
  date = new Date('2022-01-01T00:00:00.000Z'),
  status = QueryStatus.InProgress,
  failureReason = undefined,
  resultCount = 16,
  repositoryCount = 0,
  userSpecifiedLabel = undefined,
}: {
  date?: Date;
  status?: QueryStatus;
  failureReason?: string;
  resultCount?: number;
  repositoryCount?: number;
  userSpecifiedLabel?: string;
}): RemoteQueryHistoryItem {
  return ({
    t: 'remote',
    failureReason,
    resultCount,
    status,
    completed: false,
    queryId: 'queryId',
    remoteQuery: {
      queryName: 'query-name',
      queryFilePath: 'query-file.ql',
      queryText: 'select 1',
      language: 'javascript',
      controllerRepository: {
        owner: 'github',
        name: 'vscode-codeql-integration-tests',
      },
      executionStartTime: date.getTime(),
      actionsWorkflowRunId: 1,
      repositoryCount,
    },
    userSpecifiedLabel,
  } as unknown) as RemoteQueryHistoryItem;
}
