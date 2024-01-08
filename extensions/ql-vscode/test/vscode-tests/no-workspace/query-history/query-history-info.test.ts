import { QueryStatus } from "../../../../src/query-history/query-status";
import {
  buildRepoLabel,
  getActionsWorkflowRunUrl,
  getQueryId,
  getQueryText,
  getRawQueryName,
} from "../../../../src/query-history/query-history-info";
import type { VariantAnalysisHistoryItem } from "../../../../src/query-history/variant-analysis-history-item";
import { createMockVariantAnalysis } from "../../../factories/variant-analysis/shared/variant-analysis";
import { createMockScannedRepos } from "../../../factories/variant-analysis/shared/scanned-repositories";
import { createMockLocalQueryInfo } from "../../../factories/query-history/local-query-history-item";
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisStatus,
} from "../../../../src/variant-analysis/shared/variant-analysis";

describe("Query history info", () => {
  const date = new Date("2022-01-01T00:00:00.000Z");
  const localQueryHistoryItem = createMockLocalQueryInfo({ startTime: date });
  const variantAnalysisHistoryItem: VariantAnalysisHistoryItem = {
    t: "variant-analysis",
    status: QueryStatus.InProgress,
    completed: false,
    variantAnalysis: createMockVariantAnalysis({
      status: VariantAnalysisStatus.InProgress,
      scannedRepos: createMockScannedRepos([
        VariantAnalysisRepoStatus.Succeeded,
        VariantAnalysisRepoStatus.Pending,
        VariantAnalysisRepoStatus.InProgress,
        VariantAnalysisRepoStatus.Canceled,
      ]),
    }),
  };

  describe("getRawQueryName", () => {
    it("should get the name for local history items", () => {
      const queryName = getRawQueryName(localQueryHistoryItem);

      expect(queryName).toBe(localQueryHistoryItem.getQueryName());
    });

    it("should get the name for variant analysis history items", () => {
      const queryName = getRawQueryName(variantAnalysisHistoryItem);

      expect(queryName).toBe(
        variantAnalysisHistoryItem.variantAnalysis.query.name,
      );
    });
  });

  describe("getQueryId", () => {
    it("should get the ID for local history items", () => {
      const historyItemId = getQueryId(localQueryHistoryItem);

      expect(historyItemId).toBe(localQueryHistoryItem.initialInfo.id);
    });

    it("should get the ID for variant analysis history items", () => {
      const historyItemId = getQueryId(variantAnalysisHistoryItem);

      expect(historyItemId).toBe(
        variantAnalysisHistoryItem.variantAnalysis.id.toString(),
      );
    });
  });

  describe("getQueryText", () => {
    it("should get the query text for local history items", () => {
      const queryText = getQueryText(localQueryHistoryItem);

      expect(queryText).toBe(localQueryHistoryItem.initialInfo.queryText);
    });

    it("should get the query text for variant analysis history items", () => {
      const queryText = getQueryText(variantAnalysisHistoryItem);

      expect(queryText).toBe(
        variantAnalysisHistoryItem.variantAnalysis.query.text,
      );
    });
  });

  describe("buildRepoLabel", () => {
    describe("repo label for variant analysis history items", () => {
      it("should return label when `totalScannedRepositoryCount` is 0", () => {
        const variantAnalysisHistoryItem0: VariantAnalysisHistoryItem = {
          t: "variant-analysis",
          status: QueryStatus.InProgress,
          completed: false,
          variantAnalysis: createMockVariantAnalysis({
            status: VariantAnalysisStatus.InProgress,
            scannedRepos: createMockScannedRepos([]),
          }),
        };
        const repoLabel0 = buildRepoLabel(variantAnalysisHistoryItem0);

        expect(repoLabel0).toBe("0/0 repositories");
      });
      it("should return label when `totalScannedRepositoryCount` is 1", () => {
        const variantAnalysisHistoryItem1: VariantAnalysisHistoryItem = {
          t: "variant-analysis",
          status: QueryStatus.InProgress,
          completed: false,
          variantAnalysis: createMockVariantAnalysis({
            status: VariantAnalysisStatus.InProgress,
            scannedRepos: createMockScannedRepos([
              VariantAnalysisRepoStatus.Pending,
            ]),
          }),
        };

        const repoLabel1 = buildRepoLabel(variantAnalysisHistoryItem1);
        expect(repoLabel1).toBe("0/1 repository");
      });
      it("should return label when `totalScannedRepositoryCount` is greater than 1", () => {
        const repoLabel = buildRepoLabel(variantAnalysisHistoryItem);

        expect(repoLabel).toBe("2/4 repositories");
      });
    });
  });

  describe("getActionsWorkflowRunUrl", () => {
    it("should get the run url for variant analysis history items", () => {
      const actionsWorkflowRunUrl = getActionsWorkflowRunUrl(
        variantAnalysisHistoryItem,
      );

      const variantAnalysis = variantAnalysisHistoryItem.variantAnalysis;
      const fullName = variantAnalysis.controllerRepo.fullName;
      expect(actionsWorkflowRunUrl).toBe(
        `https://github.com/${fullName}/actions/runs/${variantAnalysis.actionsWorkflowRunId}`,
      );
    });
  });
});
