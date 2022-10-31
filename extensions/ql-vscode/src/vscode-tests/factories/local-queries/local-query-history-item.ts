import {
  InitialQueryInfo,
  CompletedQueryInfo,
  CompletedLocalQueryInfo,
  LocalQueryInfo,
} from '../../../query-results';
import { QueryWithResults } from '../../../run-queries-shared';
import { CancellationTokenSource } from 'vscode';

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

export function createMockLocalQuery(
  dbName = 'a',
  queryWithResults?: QueryWithResults,
  isFail = false
): LocalQueryInfo {
  const initialQueryInfo = {
    databaseInfo: { name: dbName },
    start: new Date(),
    queryPath: 'hucairz'
  } as InitialQueryInfo;

  const cancellationToken = {
    dispose: () => { /**/ },
  } as CancellationTokenSource;

  const fqi = new LocalQueryInfo(
    initialQueryInfo,
    cancellationToken,
  );

  if (queryWithResults) {
    fqi.completeThisQuery(queryWithResults);
  }

  if (isFail) {
    fqi.failureReason = 'failure reason';
  }

  return fqi;
}
