import * as path from 'path';
import * as fs from 'fs-extra';
import * as sinon from 'sinon';
import { LocalQueryInfo, InitialQueryInfo, interpretResultsSarif } from '../../query-results';
import { QueryEvaluationInfo, QueryWithResults } from '../../run-queries';
import { EvaluationResult, QueryResultType } from '../../pure/messages';
import { DatabaseInfo, SortDirection, SortedResultSetInfo } from '../../pure/interface-types';
import { CodeQLCliServer, SourceInfo } from '../../cli';
import { CancellationTokenSource, Uri } from 'vscode';
import { tmpDir } from '../../helpers';
import { slurpQueryHistory, splatQueryHistory } from '../../query-serialization';

describe('query-results', () => {
  let disposeSpy: sinon.SinonSpy;
  let sandbox: sinon.SinonSandbox;
  let queryPath: string;
  let cnt = 0;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    disposeSpy = sandbox.spy();
    queryPath = path.join(Uri.file(tmpDir.name).fsPath, `query-${cnt++}`);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('FullQueryInfo', () => {
    it('should get the query name', () => {
      const fqi = createMockFullQueryInfo();

      // from the query path
      expect(fqi.getQueryName()).toBe('hucairz');

      fqi.completeThisQuery(createMockQueryWithResults(queryPath));

      // from the metadata
      expect(fqi.getQueryName()).toBe('vwx');

      // from quick eval position
      (fqi.initialInfo as any).quickEvalPosition = {
        line: 1,
        endLine: 2,
        fileName: '/home/users/yz'
      };
      expect(fqi.getQueryName()).toBe('Quick evaluation of yz:1-2');
      (fqi.initialInfo as any).quickEvalPosition.endLine = 1;
      expect(fqi.getQueryName()).toBe('Quick evaluation of yz:1');
    });

    it('should get the query file name', () => {
      const fqi = createMockFullQueryInfo();

      // from the query path
      expect(fqi.getQueryFileName()).toBe('hucairz');

      // from quick eval position
      (fqi.initialInfo as any).quickEvalPosition = {
        line: 1,
        endLine: 2,
        fileName: '/home/users/yz'
      };
      expect(fqi.getQueryFileName()).toBe('yz:1-2');
      (fqi.initialInfo as any).quickEvalPosition.endLine = 1;
      expect(fqi.getQueryFileName()).toBe('yz:1');
    });

    it('should get the getResultsPath', () => {
      const query = createMockQueryWithResults(queryPath);
      const fqi = createMockFullQueryInfo('a', query);
      const completedQuery = fqi.completedQuery!;
      const expectedResultsPath = path.join(queryPath, 'results.bqrs');

      // from results path
      expect(completedQuery.getResultsPath('zxa', false)).toBe(expectedResultsPath);

      completedQuery.sortedResultsInfo['zxa'] = {
        resultsPath: 'bxa'
      } as SortedResultSetInfo;

      // still from results path
      expect(completedQuery.getResultsPath('zxa', false)).toBe(expectedResultsPath);

      // from sortedResultsInfo
      expect(completedQuery.getResultsPath('zxa')).toBe('bxa');
    });

    it('should get the statusString', () => {
      const fqi = createMockFullQueryInfo('a', createMockQueryWithResults(queryPath, false));
      const completedQuery = fqi.completedQuery!;

      completedQuery.result.message = 'Tremendously';
      expect(completedQuery.statusString).toBe('failed: Tremendously');

      completedQuery.result.resultType = QueryResultType.OTHER_ERROR;
      expect(completedQuery.statusString).toBe('failed: Tremendously');

      completedQuery.result.resultType = QueryResultType.CANCELLATION;
      completedQuery.result.evaluationTime = 2345;
      expect(completedQuery.statusString).toBe('cancelled after 2 seconds');

      completedQuery.result.resultType = QueryResultType.OOM;
      expect(completedQuery.statusString).toBe('out of memory');

      completedQuery.result.resultType = QueryResultType.SUCCESS;
      expect(completedQuery.statusString).toBe('finished in 2 seconds');

      completedQuery.result.resultType = QueryResultType.TIMEOUT;
      expect(completedQuery.statusString).toBe('timed out after 2 seconds');
    });

    it('should updateSortState', async () => {
      // setup
      const fqi = createMockFullQueryInfo('a', createMockQueryWithResults(queryPath));
      const completedQuery = fqi.completedQuery!;

      const spy = sandbox.spy();
      const mockServer = {
        sortBqrs: spy
      } as unknown as CodeQLCliServer;
      const sortState = {
        columnIndex: 1,
        sortDirection: SortDirection.desc
      };

      // test
      await completedQuery.updateSortState(mockServer, 'a-result-set-name', sortState);

      // verify
      const expectedResultsPath = path.join(queryPath, 'results.bqrs');
      const expectedSortedResultsPath = path.join(queryPath, 'sortedResults-a-result-set-name.bqrs');
      expect(spy).toBeCalledWith(
        expectedResultsPath,
        expectedSortedResultsPath,
        'a-result-set-name',
        [sortState.columnIndex],
        [sortState.sortDirection]
      );

      expect(completedQuery.sortedResultsInfo['a-result-set-name']).toEqual({
        resultsPath: expectedSortedResultsPath,
        sortState
      });

      // delete the sort state
      await completedQuery.updateSortState(mockServer, 'a-result-set-name');
      expect(Object.values(completedQuery.sortedResultsInfo).length).toBe(0);
    });
  });

  it('should interpretResultsSarif', async () => {
    const spy = sandbox.mock();
    spy.returns({ a: '1234' });
    const mockServer = {
      interpretBqrsSarif: spy
    } as unknown as CodeQLCliServer;

    const interpretedResultsPath = path.join(tmpDir.name, 'interpreted.json');
    const resultsPath = '123';
    const sourceInfo = {};
    const metadata = {
      kind: 'my-kind',
      id: 'my-id' as string | undefined,
      scored: undefined
    };
    const results1 = await interpretResultsSarif(
      mockServer,
      metadata,
      {
        resultsPath, interpretedResultsPath
      },
      sourceInfo as SourceInfo
    );

    expect(results1).toEqual({ a: '1234', t: 'SarifInterpretationData' });
    expect(spy).toBeCalledWith(metadata, resultsPath, interpretedResultsPath, sourceInfo);

    // Try again, but with no id
    spy.reset();
    spy.returns({ a: '1234' });
    delete metadata.id;
    const results2 = await interpretResultsSarif(
      mockServer,
      metadata,
      {
        resultsPath, interpretedResultsPath
      },
      sourceInfo as SourceInfo
    );
    expect(results2).toEqual({ a: '1234', t: 'SarifInterpretationData' });
    expect(spy).toBeCalledWith(
      { kind: 'my-kind', id: 'dummy-id', scored: undefined },
      resultsPath,
      interpretedResultsPath,
      sourceInfo
    );

    // try a third time, but this time we get from file
    spy.reset();
    fs.writeFileSync(interpretedResultsPath, JSON.stringify({
      a: 6
    }), 'utf8');
    const results3 = await interpretResultsSarif(
      mockServer,
      metadata,
      {
        resultsPath, interpretedResultsPath
      },
      sourceInfo as SourceInfo
    );
    expect(results3).toEqual({ a: 6, t: 'SarifInterpretationData' });
  });

  describe('splat and slurp', () => {

    let infoSuccessRaw: LocalQueryInfo;
    let infoSuccessInterpreted: LocalQueryInfo;
    let infoEarlyFailure: LocalQueryInfo;
    let infoLateFailure: LocalQueryInfo;
    let infoInprogress: LocalQueryInfo;
    let allHistory: LocalQueryInfo[];

    beforeEach(() => {
      infoSuccessRaw = createMockFullQueryInfo('a', createMockQueryWithResults(`${queryPath}-a`, false, false, '/a/b/c/a', false));
      infoSuccessInterpreted = createMockFullQueryInfo('b', createMockQueryWithResults(`${queryPath}-b`, true, true, '/a/b/c/b', false));
      infoEarlyFailure = createMockFullQueryInfo('c', undefined, true);
      infoLateFailure = createMockFullQueryInfo('d', createMockQueryWithResults(`${queryPath}-c`, false, false, '/a/b/c/d', false));
      infoInprogress = createMockFullQueryInfo('e');
      allHistory = [
        infoSuccessRaw,
        infoSuccessInterpreted,
        infoEarlyFailure,
        infoLateFailure,
        infoInprogress
      ];
    });

    it('should splat and slurp query history', async () => {
      // the expected results only contains the history with completed queries
      const expectedHistory = [
        infoSuccessRaw,
        infoSuccessInterpreted,
        infoLateFailure,
      ];

      const allHistoryPath = path.join(tmpDir.name, 'workspace-query-history.json');

      // splat and slurp
      await splatQueryHistory(allHistory, allHistoryPath);
      const allHistoryActual = await slurpQueryHistory(allHistoryPath);

      // the dispose methods will be different. Ignore them.
      allHistoryActual.forEach(info => {
        if (info.t === 'local' && info.completedQuery) {
          const completedQuery = info.completedQuery;
          (completedQuery as any).dispose = undefined;

          // these fields should be missing on the slurped value
          // but they are undefined on the original value
          if (!('logFileLocation' in completedQuery)) {
            (completedQuery as any).logFileLocation = undefined;
          }
          const query = completedQuery.query;
          if (!('quickEvalPosition' in query)) {
            (query as any).quickEvalPosition = undefined;
          }
          if (!('templates' in query)) {
            (query as any).templates = undefined;
          }
        }
      });
      expectedHistory.forEach(info => {
        if (info.completedQuery) {
          (info.completedQuery as any).dispose = undefined;
        }
      });

      // make the diffs somewhat sane by comparing each element directly
      for (let i = 0; i < allHistoryActual.length; i++) {
        expect(allHistoryActual[i]).toEqual(expectedHistory[i]);
      }
      expect(allHistoryActual.length).toEqual(expectedHistory.length);
    });

    it('should handle an invalid query history version', async () => {
      const badPath = path.join(tmpDir.name, 'bad-query-history.json');
      fs.writeFileSync(badPath, JSON.stringify({
        version: 2,
        queries: allHistory
      }), 'utf8');

      const allHistoryActual = await slurpQueryHistory(badPath);
      // version number is invalid. Should return an empty array.
      expect(allHistoryActual).toEqual([]);
    });
  });

  function createMockQueryWithResults(
    queryPath: string,
    didRunSuccessfully = true,
    hasInterpretedResults = true,
    dbPath = '/a/b/c',
    includeSpies = true
  ): QueryWithResults {
    // pretend that the results path exists
    const resultsPath = path.join(queryPath, 'results.bqrs');
    fs.mkdirpSync(queryPath);
    fs.writeFileSync(resultsPath, '', 'utf8');

    const query = new QueryEvaluationInfo(
      queryPath,
      Uri.file(dbPath).fsPath,
      true,
      'queryDbscheme',
      undefined,
      {
        name: 'vwx'
      },
    );

    const result = {
      query,
      result: {
        evaluationTime: 12340,
        resultType: didRunSuccessfully
          ? QueryResultType.SUCCESS
          : QueryResultType.OTHER_ERROR
      } as EvaluationResult,
      dispose: disposeSpy,
    };

    if (includeSpies) {
      (query as any).hasInterpretedResults = () => Promise.resolve(hasInterpretedResults);
    }

    return result;
  }

  function createMockFullQueryInfo(dbName = 'a', queryWitbResults?: QueryWithResults, isFail = false): LocalQueryInfo {
    const fqi = new LocalQueryInfo(
      {
        databaseInfo: {
          name: dbName,
          databaseUri: Uri.parse(`/a/b/c/${dbName}`).fsPath
        } as unknown as DatabaseInfo,
        start: new Date(),
        queryPath: 'path/to/hucairz',
        queryText: 'some query',
        isQuickQuery: false,
        isQuickEval: false,
        id: `some-id-${dbName}`,
      } as InitialQueryInfo,
      {
        dispose: () => { /**/ },
      } as CancellationTokenSource
    );

    if (queryWitbResults) {
      fqi.completeThisQuery(queryWitbResults);
    }
    if (isFail) {
      fqi.failureReason = 'failure reason';
    }
    return fqi;
  }
});
