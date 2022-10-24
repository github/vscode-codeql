import {
  InitialQueryInfo,
  CompletedQueryInfo,
  CompletedLocalQueryInfo,
  LocalQueryInfo,
} from '../../../query-results';

export function createMockLocalQueryInfo(
  startTime: string,
  userSpecifiedLabel?: string
): LocalQueryInfo {
  return ({
    t: 'local',
    userSpecifiedLabel,
    startTime: startTime,
    getQueryFileName() {
      return 'query-file.ql';
    },
    getQueryName() {
      return 'query-name';
    },
    initialInfo: ({
      databaseInfo: {
        databaseUri: 'unused',
        name: 'db-name',
      },
    } as unknown) as InitialQueryInfo,
    completedQuery: ({
      resultCount: 456,
      statusString: 'in progress',
    } as unknown) as CompletedQueryInfo,
  } as unknown) as CompletedLocalQueryInfo;
}
