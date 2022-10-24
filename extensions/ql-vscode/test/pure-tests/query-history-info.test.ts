import { expect } from 'chai';

import { QueryStatus } from '../../src/query-status';
import { buildRepoLabel, getQueryHistoryItemId, getQueryText, getRawQueryName } from '../../src/query-history-info';
import { VariantAnalysisHistoryItem } from '../../src/remote-queries/variant-analysis-history-item';
import { createMockVariantAnalysis } from '../../src/vscode-tests/factories/remote-queries/shared/variant-analysis';
import { createMockScannedRepos } from '../../src/vscode-tests/factories/remote-queries/shared/scanned-repositories';
import { createMockLocalQueryInfo } from '../../src/vscode-tests/factories/local-queries/local-query-history-item';
import { createMockRemoteQueryHistoryItem } from '../../src/vscode-tests/factories/remote-queries/remote-query-history-item';
import { VariantAnalysisRepoStatus, VariantAnalysisStatus } from '../../src/remote-queries/shared/variant-analysis';

describe('Query history info', () => {

  const date = new Date('2022-01-01T00:00:00.000Z');
  const dateStr = date.toLocaleString();
  const localQueryHistoryItem = createMockLocalQueryInfo(dateStr);
  const remoteQueryHistoryItem = createMockRemoteQueryHistoryItem({});
  const variantAnalysisHistoryItem: VariantAnalysisHistoryItem = {
    t: 'variant-analysis',
    status: QueryStatus.InProgress,
    completed: false,
    historyItemId: 'abc123',
    variantAnalysis: createMockVariantAnalysis(
      VariantAnalysisStatus.InProgress,
      createMockScannedRepos([
        VariantAnalysisRepoStatus.Succeeded,
        VariantAnalysisRepoStatus.Pending,
        VariantAnalysisRepoStatus.InProgress,
        VariantAnalysisRepoStatus.Canceled,
      ])
    ),
  };

  describe('getRawQueryName', () => {
    it('should get the name for local history items', () => {
      const queryName = getRawQueryName(localQueryHistoryItem);

      expect(queryName).to.equal(localQueryHistoryItem.getQueryName());
    });

    it('should get the name for remote query history items', () => {
      const queryName = getRawQueryName(remoteQueryHistoryItem);

      expect(queryName).to.equal(remoteQueryHistoryItem.remoteQuery.queryName);
    });

    it('should get the name for variant analysis history items', () => {
      const queryName = getRawQueryName(variantAnalysisHistoryItem);

      expect(queryName).to.equal(variantAnalysisHistoryItem.variantAnalysis.query.name);
    });
  });

  describe('getQueryHistoryItemId', () => {
    it('should get the ID for local history items', () => {
      const historyItemId = getQueryHistoryItemId(localQueryHistoryItem);

      expect(historyItemId).to.equal(localQueryHistoryItem.initialInfo.id);
    });

    it('should get the ID for remote query history items', () => {
      const historyItemId = getQueryHistoryItemId(remoteQueryHistoryItem);

      expect(historyItemId).to.equal(remoteQueryHistoryItem.queryId);
    });

    it('should get the ID for variant analysis history items', () => {
      const historyItemId = getQueryHistoryItemId(variantAnalysisHistoryItem);

      expect(historyItemId).to.equal(variantAnalysisHistoryItem.historyItemId);
    });
  });

  describe('getQueryText', () => {
    it('should get the query text for local history items', () => {
      const queryText = getQueryText(localQueryHistoryItem);

      expect(queryText).to.equal(localQueryHistoryItem.initialInfo.queryText);
    });

    it('should get the query text for remote query history items', () => {
      const queryText = getQueryText(remoteQueryHistoryItem);

      expect(queryText).to.equal(remoteQueryHistoryItem.remoteQuery.queryText);
    });

    it('should get the query text for variant analysis history items', () => {
      const queryText = getQueryText(variantAnalysisHistoryItem);

      expect(queryText).to.equal(variantAnalysisHistoryItem.variantAnalysis.query.text);
    });
  });

  describe('buildRepoLabel', () => {
    describe('repo label for remote query history items', () => {
      it('should return controller repo when `repositoryCount` is 0', () => {
        const repoLabel = buildRepoLabel(remoteQueryHistoryItem);
        const expectedRepoLabel = `${remoteQueryHistoryItem.remoteQuery.controllerRepository.owner}/${remoteQueryHistoryItem.remoteQuery.controllerRepository.name}`;

        expect(repoLabel).to.equal(expectedRepoLabel);
      });
      it('should return number of repositories when `repositoryCount` is non-zero', () => {
        const remoteQueryHistoryItem2 = createMockRemoteQueryHistoryItem({repositoryCount: 3});
        const repoLabel2 = buildRepoLabel(remoteQueryHistoryItem2);
        const expectedRepoLabel2 = '3 repositories';
  
        expect(repoLabel2).to.equal(expectedRepoLabel2);
      });
    });
    describe('repo label for variant analysis history items', () => {
      it('should return label when `totalScannedRepositoryCount` is 0', () => {
        const variantAnalysisHistoryItem0: VariantAnalysisHistoryItem = {
          t: 'variant-analysis',
          status: QueryStatus.InProgress,
          completed: false,
          historyItemId: 'abc123',
          variantAnalysis: createMockVariantAnalysis(
            VariantAnalysisStatus.InProgress,
            createMockScannedRepos([])
          ),
        };
        const repoLabel0 = buildRepoLabel(variantAnalysisHistoryItem0);

        expect(repoLabel0).to.equal('0/0 repositories');
      });
      it('should return label when `totalScannedRepositoryCount` is 1', () => {
        const variantAnalysisHistoryItem1: VariantAnalysisHistoryItem = {
          t: 'variant-analysis',
          status: QueryStatus.InProgress,
          completed: false,
          historyItemId: 'abc123',
          variantAnalysis: createMockVariantAnalysis(
            VariantAnalysisStatus.InProgress,
            createMockScannedRepos([
              VariantAnalysisRepoStatus.Pending,
            ])
          ),
        };

        const repoLabel1 = buildRepoLabel(variantAnalysisHistoryItem1);
        expect(repoLabel1).to.equal('0/1 repository');
      });
      it('should return label when `totalScannedRepositoryCount` is greater than 1', () => {
        const repoLabel = buildRepoLabel(variantAnalysisHistoryItem);
        
        expect(repoLabel).to.equal('2/4 repositories');
      });
    });
  });  
});
