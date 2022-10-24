import { RemoteQueryHistoryItem } from '../../../remote-queries/remote-query-history-item';

export function createMockRemoteQueryHistoryItem({
  date = new Date('2022-01-01T00:00:00.000Z'),
  resultCount = 16,
  userSpecifiedLabel = undefined,
  repositoryCount = 0,
}: {
  date?: Date;
  resultCount?: number;
  userSpecifiedLabel?: string;
  repositoryCount?: number;
}): RemoteQueryHistoryItem {
  return ({
    t: 'remote',
    userSpecifiedLabel,
    remoteQuery: {
      executionStartTime: date.getTime(),
      queryName: 'query-name',
      queryFilePath: 'query-file.ql',
      controllerRepository: {
        owner: 'github',
        name: 'vscode-codeql-integration-tests',
      },
      language: 'javascript',
      repositoryCount,
    },
    status: 'in progress',
    resultCount,
  } as unknown) as RemoteQueryHistoryItem;
}
