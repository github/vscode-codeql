import { env } from 'vscode';
import { expect } from 'chai';
import { QueryHistoryConfig } from '../../config';
import { HistoryItemLabelProvider } from '../../history-item-label-provider';
import { CompletedLocalQueryInfo, CompletedQueryInfo, InitialQueryInfo } from '../../query-results';
import { RemoteQueryHistoryItem } from '../../remote-queries/remote-query-history-item';


describe('HistoryItemLabelProvider', () => {

  let labelProvider: HistoryItemLabelProvider;
  let config: QueryHistoryConfig;
  const date = new Date('2022-01-01T00:00:00.000Z');
  const dateStr = date.toLocaleString(env.language);

  beforeEach(() => {
    config = {
      format: 'xxx %q xxx'
    } as unknown as QueryHistoryConfig;
    labelProvider = new HistoryItemLabelProvider(config);
  });

  describe('local queries', () => {
    it('should interpolate query when user specified', () => {
      const fqi = createMockLocalQueryInfo('xxx');

      expect(labelProvider.getLabel(fqi)).to.eq('xxx');

      fqi.userSpecifiedLabel = '%t %q %d %s %f %r %%';
      expect(labelProvider.getLabel(fqi)).to.eq(`${dateStr} query-name db-name in progress query-file.ql 456 results %`);

      fqi.userSpecifiedLabel = '%t %q %d %s %f %r %%::%t %q %d %s %f %r %%';
      expect(labelProvider.getLabel(fqi)).to.eq(`${dateStr} query-name db-name in progress query-file.ql 456 results %::${dateStr} query-name db-name in progress query-file.ql 456 results %`);
    });

    it('should interpolate query when not user specified', () => {
      const fqi = createMockLocalQueryInfo();

      expect(labelProvider.getLabel(fqi)).to.eq('xxx query-name xxx');


      config.format = '%t %q %d %s %f %r %%';
      expect(labelProvider.getLabel(fqi)).to.eq(`${dateStr} query-name db-name in progress query-file.ql 456 results %`);

      config.format = '%t %q %d %s %f %r %%::%t %q %d %s %f %r %%';
      expect(labelProvider.getLabel(fqi)).to.eq(`${dateStr} query-name db-name in progress query-file.ql 456 results %::${dateStr} query-name db-name in progress query-file.ql 456 results %`);
    });

    it('should get query short label', () => {
      const fqi = createMockLocalQueryInfo('xxx');

      // fall back on user specified if one exists.
      expect(labelProvider.getShortLabel(fqi)).to.eq('xxx');

      // use query name if no user-specified label exists
      delete (fqi as any).userSpecifiedLabel;
      expect(labelProvider.getShortLabel(fqi)).to.eq('query-name');
    });

    function createMockLocalQueryInfo(userSpecifiedLabel?: string) {
      return {
        t: 'local',
        userSpecifiedLabel,
        startTime: date.toLocaleString(env.language),
        getQueryFileName() {
          return 'query-file.ql';
        },
        getQueryName() {
          return 'query-name';
        },
        initialInfo: {
          databaseInfo: {
            databaseUri: 'unused',
            name: 'db-name'
          }
        } as unknown as InitialQueryInfo,
        completedQuery: {
          resultCount: 456,
          statusString: 'in progress',
        } as unknown as CompletedQueryInfo,
      } as unknown as CompletedLocalQueryInfo;
    }
  });

  describe('remote queries', () => {
    it('should interpolate query when user specified', () => {
      const fqi = createMockRemoteQueryInfo('xxx');

      expect(labelProvider.getLabel(fqi)).to.eq('xxx');

      fqi.userSpecifiedLabel = '%t %q %d %s %%';
      expect(labelProvider.getLabel(fqi)).to.eq(`${dateStr} query-name (javascript) github/vscode-codeql-integration-tests in progress %`);

      fqi.userSpecifiedLabel = '%t %q %d %s %%::%t %q %d %s %%';
      expect(labelProvider.getLabel(fqi)).to.eq(`${dateStr} query-name (javascript) github/vscode-codeql-integration-tests in progress %::${dateStr} query-name (javascript) github/vscode-codeql-integration-tests in progress %`);
    });

    it('should interpolate query when not user specified', () => {
      const fqi = createMockRemoteQueryInfo();

      expect(labelProvider.getLabel(fqi)).to.eq('xxx query-name (javascript) xxx');


      config.format = '%t %q %d %s %f %r %%';
      expect(labelProvider.getLabel(fqi)).to.eq(`${dateStr} query-name (javascript) github/vscode-codeql-integration-tests in progress query-file.ql (16 results) %`);

      config.format = '%t %q %d %s %f %r %%::%t %q %d %s %f %r %%';
      expect(labelProvider.getLabel(fqi)).to.eq(`${dateStr} query-name (javascript) github/vscode-codeql-integration-tests in progress query-file.ql (16 results) %::${dateStr} query-name (javascript) github/vscode-codeql-integration-tests in progress query-file.ql (16 results) %`);
    });

    it('should use number of repositories instead of controller repo if available', () => {
      const fqi = createMockRemoteQueryInfo(undefined, 2);

      config.format = '%t %q %d %s %f %r %%';
      expect(labelProvider.getLabel(fqi)).to.eq(`${dateStr} query-name (javascript) 2 repositories in progress query-file.ql (16 results) %`);
    });

    it('should get query short label', () => {
      const fqi = createMockRemoteQueryInfo('xxx');

      // fall back on user specified if one exists.
      expect(labelProvider.getShortLabel(fqi)).to.eq('xxx');

      // use query name if no user-specified label exists
      delete (fqi as any).userSpecifiedLabel;
      expect(labelProvider.getShortLabel(fqi)).to.eq('query-name');
    });

    function createMockRemoteQueryInfo(userSpecifiedLabel?: string, numRepositoriesQueried?: number) {
      return {
        t: 'remote',
        userSpecifiedLabel,
        remoteQuery: {
          executionStartTime: date.getTime(),
          queryName: 'query-name',
          queryFilePath: 'query-file.ql',
          controllerRepository: {
            owner: 'github',
            name: 'vscode-codeql-integration-tests'
          },
          language: 'javascript',
          numRepositoriesQueried,
        },
        status: 'in progress',
        resultCount: 16,
      } as unknown as RemoteQueryHistoryItem;
    }
  });
});
