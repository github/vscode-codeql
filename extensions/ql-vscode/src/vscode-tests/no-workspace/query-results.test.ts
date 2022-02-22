import * as chai from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import 'mocha';
import 'sinon-chai';
import * as sinon from 'sinon';
import * as chaiAsPromised from 'chai-as-promised';
import { LocalQueryInfo, InitialQueryInfo, interpretResults } from '../../query-results';
import { QueryEvaluationInfo, QueryWithResults } from '../../run-queries';
import { QueryHistoryConfig } from '../../config';
import { EvaluationResult, QueryResultType } from '../../pure/messages';
import { DatabaseInfo, SortDirection, SortedResultSetInfo } from '../../pure/interface-types';
import { CodeQLCliServer, SourceInfo } from '../../cli';
import { CancellationTokenSource, Uri, env } from 'vscode';
import { tmpDir } from '../../helpers';
import { slurpQueryHistory, splatQueryHistory } from '../../query-serialization';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('query-results', () => {
  let disposeSpy: sinon.SinonSpy;
  let onDidChangeQueryHistoryConfigurationSpy: sinon.SinonSpy;
  let mockConfig: QueryHistoryConfig;
  let sandbox: sinon.SinonSandbox;
  let queryPath: string;
  let cnt = 0;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    disposeSpy = sandbox.spy();
    onDidChangeQueryHistoryConfigurationSpy = sandbox.spy();
    mockConfig = mockQueryHistoryConfig();
    queryPath = path.join(Uri.file(tmpDir.name).fsPath, `query-${cnt++}`);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('FullQueryInfo', () => {
    it('should interpolate', () => {
      const fqi = createMockFullQueryInfo();
      const date = new Date('2022-01-01T00:00:00.000Z');
      const dateStr = date.toLocaleString(env.language);
      (fqi.initialInfo as any).start = date;

      expect(fqi.interpolate('xxx')).to.eq('xxx');
      expect(fqi.interpolate('%t %q %d %s %%')).to.eq(`${dateStr} hucairz a in progress %`);
      expect(fqi.interpolate('%t %q %d %s %%::%t %q %d %s %%')).to.eq(`${dateStr} hucairz a in progress %::${dateStr} hucairz a in progress %`);
    });

    it('should get the query name', () => {
      const fqi = createMockFullQueryInfo();

      // from the query path
      expect(fqi.getQueryName()).to.eq('hucairz');

      fqi.completeThisQuery(createMockQueryWithResults(queryPath));

      // from the metadata
      expect(fqi.getQueryName()).to.eq('vwx');

      // from quick eval position
      (fqi.initialInfo as any).quickEvalPosition = {
        line: 1,
        endLine: 2,
        fileName: '/home/users/yz'
      };
      expect(fqi.getQueryName()).to.eq('Quick evaluation of yz:1-2');
      (fqi.initialInfo as any).quickEvalPosition.endLine = 1;
      expect(fqi.getQueryName()).to.eq('Quick evaluation of yz:1');
    });

    it('should get the query file name', () => {
      const fqi = createMockFullQueryInfo();

      // from the query path
      expect(fqi.getQueryFileName()).to.eq('hucairz');

      // from quick eval position
      (fqi.initialInfo as any).quickEvalPosition = {
        line: 1,
        endLine: 2,
        fileName: '/home/users/yz'
      };
      expect(fqi.getQueryFileName()).to.eq('yz:1-2');
      (fqi.initialInfo as any).quickEvalPosition.endLine = 1;
      expect(fqi.getQueryFileName()).to.eq('yz:1');
    });

    it('should get the label', () => {
      const fqi = createMockFullQueryInfo('db-name');

      // the %q from the config is now replaced by the file name of the query
      expect(fqi.label).to.eq('from config hucairz');

      // the %q from the config is now replaced by the name of the query
      // in the metadata
      fqi.completeThisQuery(createMockQueryWithResults(queryPath));
      expect(fqi.label).to.eq('from config vwx');

      // replace the config with a user specified label
      // must be interpolated
      fqi.initialInfo.userSpecifiedLabel = 'user specified label %d';
      expect(fqi.label).to.eq('user specified label db-name');
    });

    it('should get the getResultsPath', () => {
      const query = createMockQueryWithResults(queryPath);
      const fqi = createMockFullQueryInfo('a', query);
      const completedQuery = fqi.completedQuery!;
      const expectedResultsPath = path.join(queryPath, 'results.bqrs');

      // from results path
      expect(completedQuery.getResultsPath('zxa', false)).to.eq(expectedResultsPath);

      completedQuery.sortedResultsInfo['zxa'] = {
        resultsPath: 'bxa'
      } as SortedResultSetInfo;

      // still from results path
      expect(completedQuery.getResultsPath('zxa', false)).to.eq(expectedResultsPath);

      // from sortedResultsInfo
      expect(completedQuery.getResultsPath('zxa')).to.eq('bxa');
    });

    it('should get the statusString', () => {
      const fqi = createMockFullQueryInfo('a', createMockQueryWithResults(queryPath, false));
      const completedQuery = fqi.completedQuery!;

      completedQuery.result.message = 'Tremendously';
      expect(completedQuery.statusString).to.eq('failed: Tremendously');

      completedQuery.result.resultType = QueryResultType.OTHER_ERROR;
      expect(completedQuery.statusString).to.eq('failed: Tremendously');

      completedQuery.result.resultType = QueryResultType.CANCELLATION;
      completedQuery.result.evaluationTime = 2345;
      expect(completedQuery.statusString).to.eq('cancelled after 2 seconds');

      completedQuery.result.resultType = QueryResultType.OOM;
      expect(completedQuery.statusString).to.eq('out of memory');

      completedQuery.result.resultType = QueryResultType.SUCCESS;
      expect(completedQuery.statusString).to.eq('finished in 2 seconds');

      completedQuery.result.resultType = QueryResultType.TIMEOUT;
      expect(completedQuery.statusString).to.eq('timed out after 2 seconds');
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
      expect(spy).to.have.been.calledWith(
        expectedResultsPath,
        expectedSortedResultsPath,
        'a-result-set-name',
        [sortState.columnIndex],
        [sortState.sortDirection],
      );

      expect(completedQuery.sortedResultsInfo['a-result-set-name']).to.deep.equal({
        resultsPath: expectedSortedResultsPath,
        sortState
      });

      // delete the sort state
      await completedQuery.updateSortState(mockServer, 'a-result-set-name');
      expect(Object.values(completedQuery.sortedResultsInfo).length).to.eq(0);
    });
  });

  it('should interpretResults', async () => {
    const spy = sandbox.mock();
    spy.returns('1234');
    const mockServer = {
      interpretBqrs: spy
    } as unknown as CodeQLCliServer;

    const interpretedResultsPath = path.join(tmpDir.name, 'interpreted.json');
    const resultsPath = '123';
    const sourceInfo = {};
    const metadata = {
      kind: 'my-kind',
      id: 'my-id' as string | undefined,
      scored: undefined
    };
    const results1 = await interpretResults(
      mockServer,
      metadata,
      {
        resultsPath, interpretedResultsPath
      },
      sourceInfo as SourceInfo
    );

    expect(results1).to.eq('1234');
    expect(spy).to.have.been.calledWith(
      metadata,
      resultsPath, interpretedResultsPath, sourceInfo
    );

    // Try again, but with no id
    spy.reset();
    spy.returns('1234');
    delete metadata.id;
    const results2 = await interpretResults(
      mockServer,
      metadata,
      {
        resultsPath, interpretedResultsPath
      },
      sourceInfo as SourceInfo
    );
    expect(results2).to.eq('1234');
    expect(spy).to.have.been.calledWith(
      { kind: 'my-kind', id: 'dummy-id', scored: undefined },
      resultsPath, interpretedResultsPath, sourceInfo
    );

    // try a third time, but this time we get from file
    spy.reset();
    fs.writeFileSync(interpretedResultsPath, JSON.stringify({
      a: 6
    }), 'utf8');
    const results3 = await interpretResults(
      mockServer,
      metadata,
      {
        resultsPath, interpretedResultsPath
      },
      sourceInfo as SourceInfo
    );
    expect(results3).to.deep.eq({ a: 6 });
  });

  describe('splat and slurp', () => {
    it('should splat and slurp query history', async () => {
      const infoSuccessRaw = createMockFullQueryInfo('a', createMockQueryWithResults(`${queryPath}-a`, false, false, '/a/b/c/a', false));
      const infoSuccessInterpreted = createMockFullQueryInfo('b', createMockQueryWithResults(`${queryPath}-b`, true, true, '/a/b/c/b', false));
      const infoEarlyFailure = createMockFullQueryInfo('c', undefined, true);
      const infoLateFailure = createMockFullQueryInfo('d', createMockQueryWithResults(`${queryPath}-c`, false, false, '/a/b/c/d', false));
      const infoInprogress = createMockFullQueryInfo('e');
      const allHistory = [
        infoSuccessRaw,
        infoSuccessInterpreted,
        infoEarlyFailure,
        infoLateFailure,
        infoInprogress
      ];

      // the expected results only contains the history with completed queries
      const expectedHistory = [
        infoSuccessRaw,
        infoSuccessInterpreted,
        infoLateFailure,
      ];

      const allHistoryPath = path.join(tmpDir.name, 'workspace-query-history.json');

      // splat and slurp
      await splatQueryHistory(allHistory, allHistoryPath);
      const allHistoryActual = await slurpQueryHistory(allHistoryPath, mockConfig);

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
        expect(allHistoryActual[i]).to.deep.eq(expectedHistory[i]);
      }
      expect(allHistoryActual.length).to.deep.eq(expectedHistory.length);
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
      mockQueryHistoryConfig(),
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

  function mockQueryHistoryConfig(): QueryHistoryConfig {
    return {
      onDidChangeConfiguration: onDidChangeQueryHistoryConfigurationSpy,
      ttlInMillis: 999999,
      format: 'from config %q'
    };
  }
});
