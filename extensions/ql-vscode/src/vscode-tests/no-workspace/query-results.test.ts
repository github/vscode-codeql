import * as chai from 'chai';
import * as path from 'path';
import * as fs from 'fs-extra';
import 'mocha';
import 'sinon-chai';
import * as sinon from 'sinon';
import * as chaiAsPromised from 'chai-as-promised';
import { FullQueryInfo, InitialQueryInfo, interpretResults } from '../../query-results';
import { QueryEvaluatonInfo, QueryWithResults, tmpDir } from '../../run-queries';
import { QueryHistoryConfig } from '../../config';
import { EvaluationResult, QueryResultType } from '../../pure/messages';
import { SortDirection, SortedResultSetInfo } from '../../pure/interface-types';
import { CodeQLCliServer, SourceInfo } from '../../cli';
import { env } from 'process';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe('query-results', () => {
  let disposeSpy: sinon.SinonSpy;
  let onDidChangeQueryHistoryConfigurationSpy: sinon.SinonSpy;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    disposeSpy = sandbox.spy();
    onDidChangeQueryHistoryConfigurationSpy = sandbox.spy();
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

      fqi.completeThisQuery(createMockQueryWithResults());

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
      fqi.completeThisQuery(createMockQueryWithResults());
      expect(fqi.label).to.eq('from config vwx');

      // replace the config with a user specified label
      // must be interpolated
      fqi.initialInfo.userSpecifiedLabel = 'user specified label %d';
      expect(fqi.label).to.eq('user specified label db-name');
    });

    it('should get the getResultsPath', () => {
      const fqi = createMockFullQueryInfo('a', createMockQueryWithResults());
      const completedQuery = fqi.completedQuery!;
      // from results path
      expect(completedQuery.getResultsPath('zxa', false)).to.eq('/a/b/c');

      completedQuery.sortedResultsInfo.set('zxa', {
        resultsPath: 'bxa'
      } as SortedResultSetInfo);

      // still from results path
      expect(completedQuery.getResultsPath('zxa', false)).to.eq('/a/b/c');

      // from sortedResultsInfo
      expect(completedQuery.getResultsPath('zxa')).to.eq('bxa');
    });

    it('should get the statusString', () => {
      const fqi = createMockFullQueryInfo('a', createMockQueryWithResults(false));
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
      const fqi = createMockFullQueryInfo('a', createMockQueryWithResults());
      const completedQuery = fqi.completedQuery!;

      const spy = sandbox.spy();
      const mockServer = {
        sortBqrs: spy
      } as unknown as CodeQLCliServer;
      const sortState = {
        columnIndex: 1,
        sortDirection: SortDirection.desc
      };
      await completedQuery.updateSortState(mockServer, 'result-name', sortState);
      const expectedPath = path.join(tmpDir.name, 'sortedResults6789-result-name.bqrs');
      expect(spy).to.have.been.calledWith(
        '/a/b/c',
        expectedPath,
        'result-name',
        [sortState.columnIndex],
        [sortState.sortDirection],
      );

      expect(completedQuery.sortedResultsInfo.get('result-name')).to.deep.equal({
        resultsPath: expectedPath,
        sortState
      });

      // delete the sort stae
      await completedQuery.updateSortState(mockServer, 'result-name');
      expect(completedQuery.sortedResultsInfo.size).to.eq(0);
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

  function createMockQueryWithResults(didRunSuccessfully = true, hasInterpretedResults = true): QueryWithResults {
    return {
      query: {
        hasInterpretedResults: () => Promise.resolve(hasInterpretedResults),
        queryID: 6789,
        metadata: {
          name: 'vwx'
        },
        resultsPaths: {
          resultsPath: '/a/b/c',
          interpretedResultsPath: '/d/e/f'
        }
      } as QueryEvaluatonInfo,
      result: {
        evaluationTime: 12340,
        resultType: didRunSuccessfully
          ? QueryResultType.SUCCESS
          : QueryResultType.OTHER_ERROR
      } as EvaluationResult,
      dispose: disposeSpy,
    };
  }

  function createMockFullQueryInfo(dbName = 'a', queryWitbResults?: QueryWithResults, isFail = false): FullQueryInfo {
    const fqi = new FullQueryInfo(
      {
        databaseInfo: { name: dbName },
        start: new Date(),
        queryPath: 'path/to/hucairz'
      } as InitialQueryInfo,
      mockQueryHistoryConfig()
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
      format: 'from config %q'
    };
  }
});
