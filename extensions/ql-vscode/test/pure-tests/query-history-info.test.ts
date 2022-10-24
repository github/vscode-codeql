import { expect } from 'chai';

import { QueryStatus } from '../../src/query-status';
import { getQueryHistoryItemId, getQueryText, getRawQueryName } from '../../src/query-history-info';
import { VariantAnalysisHistoryItem } from '../../src/remote-queries/variant-analysis-history-item';
import { createMockVariantAnalysis } from '../../src/vscode-tests/factories/remote-queries/shared/variant-analysis';
import { createMockLocalQueryInfo } from '../../src/vscode-tests/factories/local-queries/local-query-history-item';
import { createMockRemoteQueryHistoryItem } from '../../src/vscode-tests/factories/remote-queries/remote-query-history-item';

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
    variantAnalysis: createMockVariantAnalysis()
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
});
