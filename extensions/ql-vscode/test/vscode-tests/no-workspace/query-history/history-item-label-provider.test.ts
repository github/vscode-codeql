import { env } from "vscode";
import type { QueryHistoryConfig } from "../../../../src/config";
import { HistoryItemLabelProvider } from "../../../../src/query-history/history-item-label-provider";
import { createMockLocalQueryInfo } from "../../../factories/query-history/local-query-history-item";
import { createMockVariantAnalysisHistoryItem } from "../../../factories/query-history/variant-analysis-history-item";
import { QueryStatus } from "../../../../src/query-history/query-status";
import {
  VariantAnalysisRepoStatus,
  VariantAnalysisStatus,
} from "../../../../src/variant-analysis/shared/variant-analysis";
import { createMockVariantAnalysis } from "../../../factories/variant-analysis/shared/variant-analysis";
import { createMockScannedRepos } from "../../../factories/variant-analysis/shared/scanned-repositories";

describe("HistoryItemLabelProvider", () => {
  let labelProvider: HistoryItemLabelProvider;
  let config: QueryHistoryConfig;
  const date = new Date("2022-01-01T00:00:00.000Z");
  const dateStr = date.toLocaleString(env.language);
  const executionStartTime = date.getTime();
  const userSpecifiedLabel = "user-specified-name";

  beforeEach(() => {
    config = {
      format: "xxx ${queryName} xxx",
      ttlInMillis: 0,
      onDidChangeConfiguration: jest.fn(),
    };
    labelProvider = new HistoryItemLabelProvider(config);
  });

  describe("modern format", () => {
    describe("local queries", () => {
      it("should interpolate query when user specified", () => {
        const fqi = createMockLocalQueryInfo({
          startTime: date,
          userSpecifiedLabel,
          resultCount: 456,
          hasMetadata: true,
        });

        expect(labelProvider.getLabel(fqi)).toBe("user-specified-name");

        fqi.userSpecifiedLabel =
          "${startTime} ${queryName} ${databaseName} ${status} ${queryFileBasename} ${resultCount} %";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %`,
        );

        fqi.userSpecifiedLabel = "%t %q %d %s %f %r %%::%t %q %d %s %f %r %%";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %::${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %`,
        );
      });

      it("should interpolate query when not user specified", () => {
        const fqi = createMockLocalQueryInfo({
          startTime: date,
          resultCount: 456,
          hasMetadata: true,
        });

        expect(labelProvider.getLabel(fqi)).toBe("xxx query-name xxx");

        config.format =
          "${startTime} ${queryName} ${databaseName} ${status} ${queryFileBasename} ${resultCount} %";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %`,
        );

        config.format =
          "${startTime} ${queryName} ${databaseName} ${status} ${queryFileBasename} ${resultCount} %::${startTime} ${queryName} ${databaseName} ${status} ${queryFileBasename} ${resultCount} %";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %::${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %`,
        );
      });

      it("should get query short label", () => {
        const fqi = createMockLocalQueryInfo({
          startTime: date,
          userSpecifiedLabel,
          hasMetadata: true,
          resultCount: 456,
        });

        // fall back on user specified if one exists.
        expect(labelProvider.getShortLabel(fqi)).toBe("user-specified-name");

        // use query name if no user-specified label exists
        fqi.userSpecifiedLabel = undefined;
        expect(labelProvider.getShortLabel(fqi)).toBe("query-name");

        // use file name if no user-specified label exists and the query is not yet completed (meaning it has no results)
        const fqi2 = createMockLocalQueryInfo({
          startTime: date,
          hasMetadata: true,
        });
        expect(labelProvider.getShortLabel(fqi2)).toBe("query-file.ql");
      });
    });

    describe("variant analyses", () => {
      it("should interpolate query when user specified", () => {
        const fqi = createMockVariantAnalysisHistoryItem({
          userSpecifiedLabel,
          executionStartTime,
        });

        expect(labelProvider.getLabel(fqi)).toBe(userSpecifiedLabel);

        fqi.userSpecifiedLabel =
          "${startTime} ${queryName} ${databaseName} ${status} %";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} a-query-name (javascript) 1/3 repositories in progress %`,
        );

        fqi.userSpecifiedLabel =
          "${startTime} ${queryName} ${databaseName} ${status} %::${startTime} ${queryName} ${databaseName} ${status} %";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} a-query-name (javascript) 1/3 repositories in progress %::${dateStr} a-query-name (javascript) 1/3 repositories in progress %`,
        );
      });

      it("should interpolate query when not user-specified", () => {
        const fqi = createMockVariantAnalysisHistoryItem({
          historyItemStatus: QueryStatus.Completed,
          variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
          executionStartTime,
          resultCount: 16,
        });

        expect(labelProvider.getLabel(fqi)).toBe(
          "xxx a-query-name (javascript) xxx",
        );

        config.format =
          "${startTime} ${queryName} ${databaseName} ${status} ${queryFileBasename} ${resultCount} %";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} a-query-name (javascript) 1/3 repositories completed a-query-file-path (16 results) %`,
        );

        config.format =
          "${startTime} ${queryName} ${databaseName} ${status} ${queryFileBasename} ${resultCount} %::${startTime} ${queryName} ${databaseName} ${status} ${queryFileBasename} ${resultCount} %";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} a-query-name (javascript) 1/3 repositories completed a-query-file-path (16 results) %::${dateStr} a-query-name (javascript) 1/3 repositories completed a-query-file-path (16 results) %`,
        );
      });

      it("should get query short label", () => {
        const fqi = createMockVariantAnalysisHistoryItem({
          historyItemStatus: QueryStatus.Completed,
          variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
          executionStartTime,
          userSpecifiedLabel,
        });

        // fall back on user specified if one exists.
        expect(labelProvider.getShortLabel(fqi)).toBe("user-specified-name");

        // use query name if no user-specified label exists
        const fqi2 = createMockVariantAnalysisHistoryItem({});

        expect(labelProvider.getShortLabel(fqi2)).toBe("a-query-name");
      });

      describe("when results are present", () => {
        it("should display results if there are any", () => {
          const fqi = createMockVariantAnalysisHistoryItem({
            historyItemStatus: QueryStatus.Completed,
            resultCount: 16,
            variantAnalysis: createMockVariantAnalysis({
              status: VariantAnalysisStatus.Succeeded,
              executionStartTime,
              scannedRepos: createMockScannedRepos([
                VariantAnalysisRepoStatus.Succeeded,
                VariantAnalysisRepoStatus.Succeeded,
              ]),
            }),
          });
          config.format =
            "${startTime} ${queryName} ${databaseName} ${status} ${queryFileBasename} ${resultCount} %";
          expect(labelProvider.getLabel(fqi)).toBe(
            `${dateStr} a-query-name (javascript) 2/2 repositories completed a-query-file-path (16 results) %`,
          );
        });
      });

      describe("when results are not present", () => {
        it("should skip displaying them", () => {
          const fqi = createMockVariantAnalysisHistoryItem({
            historyItemStatus: QueryStatus.Completed,
            resultCount: 0,
            variantAnalysis: createMockVariantAnalysis({
              status: VariantAnalysisStatus.Succeeded,
              executionStartTime,
              scannedRepos: createMockScannedRepos([
                VariantAnalysisRepoStatus.Succeeded,
                VariantAnalysisRepoStatus.Succeeded,
              ]),
            }),
          });
          config.format =
            "${startTime} ${queryName} ${databaseName} ${status} ${queryFileBasename} ${resultCount} %";
          expect(labelProvider.getLabel(fqi)).toBe(
            `${dateStr} a-query-name (javascript) 2/2 repositories completed a-query-file-path %`,
          );
        });
      });

      describe("when extra whitespace is present in the middle of the label", () => {
        it("should squash it down to a single whitespace", () => {
          const fqi = createMockVariantAnalysisHistoryItem({
            historyItemStatus: QueryStatus.Completed,
            resultCount: 0,
            variantAnalysis: createMockVariantAnalysis({
              status: VariantAnalysisStatus.Succeeded,
              executionStartTime,
              scannedRepos: createMockScannedRepos([
                VariantAnalysisRepoStatus.Succeeded,
                VariantAnalysisRepoStatus.Succeeded,
              ]),
            }),
          });
          config.format =
            "${startTime}   ${queryName}        ${databaseName} ${status}   ${queryFileBasename}   ${resultCount} %";
          expect(labelProvider.getLabel(fqi)).toBe(
            `${dateStr} a-query-name (javascript) 2/2 repositories completed a-query-file-path %`,
          );
        });
      });

      describe("when extra whitespace is present at the start of the label", () => {
        it("should squash it down to a single whitespace", () => {
          const fqi = createMockVariantAnalysisHistoryItem({
            historyItemStatus: QueryStatus.Completed,
            resultCount: 0,
            variantAnalysis: createMockVariantAnalysis({
              status: VariantAnalysisStatus.Succeeded,
              executionStartTime,
              scannedRepos: createMockScannedRepos([
                VariantAnalysisRepoStatus.Succeeded,
                VariantAnalysisRepoStatus.Succeeded,
              ]),
            }),
          });
          config.format =
            "   ${startTime} ${queryName} ${databaseName} ${status} ${queryFileBasename} ${resultCount} %";
          expect(labelProvider.getLabel(fqi)).toBe(
            ` ${dateStr} a-query-name (javascript) 2/2 repositories completed a-query-file-path %`,
          );
        });
      });

      describe("when extra whitespace is present at the end of the label", () => {
        it("should squash it down to a single whitespace", () => {
          const fqi = createMockVariantAnalysisHistoryItem({
            historyItemStatus: QueryStatus.Completed,
            resultCount: 0,
            variantAnalysis: createMockVariantAnalysis({
              status: VariantAnalysisStatus.Succeeded,
              executionStartTime,
              scannedRepos: createMockScannedRepos([
                VariantAnalysisRepoStatus.Succeeded,
                VariantAnalysisRepoStatus.Succeeded,
              ]),
            }),
          });
          config.format =
            "${startTime} ${queryName} ${databaseName} ${status} ${queryFileBasename} ${resultCount} %   ";
          expect(labelProvider.getLabel(fqi)).toBe(
            `${dateStr} a-query-name (javascript) 2/2 repositories completed a-query-file-path % `,
          );
        });
      });
    });
  });

  describe("legacy format", () => {
    describe("local queries", () => {
      it("should interpolate query when user specified", () => {
        const fqi = createMockLocalQueryInfo({
          startTime: date,
          userSpecifiedLabel,
          resultCount: 456,
          hasMetadata: true,
        });

        expect(labelProvider.getLabel(fqi)).toBe("user-specified-name");

        fqi.userSpecifiedLabel = "%t %q %d %s %f %r %%";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %`,
        );

        fqi.userSpecifiedLabel = "%t %q %d %s %f %r %%::%t %q %d %s %f %r %%";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %::${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %`,
        );
      });

      it("should interpolate query when not user specified", () => {
        const fqi = createMockLocalQueryInfo({
          startTime: date,
          resultCount: 456,
          hasMetadata: true,
        });

        expect(labelProvider.getLabel(fqi)).toBe("xxx query-name xxx");

        config.format = "%t %q %d %s %f %r %%";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %`,
        );

        config.format = "%t %q %d %s %f %r %%::%t %q %d %s %f %r %%";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %::${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %`,
        );
      });

      it("should get query short label", () => {
        const fqi = createMockLocalQueryInfo({
          startTime: date,
          userSpecifiedLabel,
          hasMetadata: true,
          resultCount: 456,
        });

        // fall back on user specified if one exists.
        expect(labelProvider.getShortLabel(fqi)).toBe("user-specified-name");

        // use query name if no user-specified label exists
        fqi.userSpecifiedLabel = undefined;
        expect(labelProvider.getShortLabel(fqi)).toBe("query-name");

        // use file name if no user-specified label exists and the query is not yet completed (meaning it has no results)
        const fqi2 = createMockLocalQueryInfo({
          startTime: date,
          hasMetadata: true,
        });
        expect(labelProvider.getShortLabel(fqi2)).toBe("query-file.ql");
      });
    });

    describe("variant analyses", () => {
      it("should interpolate query when user specified", () => {
        const fqi = createMockVariantAnalysisHistoryItem({
          userSpecifiedLabel,
          executionStartTime,
        });

        expect(labelProvider.getLabel(fqi)).toBe(userSpecifiedLabel);

        fqi.userSpecifiedLabel = "%t %q %d %s %%";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} a-query-name (javascript) 1/3 repositories in progress %`,
        );

        fqi.userSpecifiedLabel = "%t %q %d %s %%::%t %q %d %s %%";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} a-query-name (javascript) 1/3 repositories in progress %::${dateStr} a-query-name (javascript) 1/3 repositories in progress %`,
        );
      });

      it("should interpolate query when not user-specified", () => {
        const fqi = createMockVariantAnalysisHistoryItem({
          historyItemStatus: QueryStatus.Completed,
          variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
          executionStartTime,
          resultCount: 16,
        });

        expect(labelProvider.getLabel(fqi)).toBe(
          "xxx a-query-name (javascript) xxx",
        );

        config.format = "%t %q %d %s %f %r %%";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} a-query-name (javascript) 1/3 repositories completed a-query-file-path (16 results) %`,
        );

        config.format = "%t %q %d %s %f %r %%::%t %q %d %s %f %r %%";
        expect(labelProvider.getLabel(fqi)).toBe(
          `${dateStr} a-query-name (javascript) 1/3 repositories completed a-query-file-path (16 results) %::${dateStr} a-query-name (javascript) 1/3 repositories completed a-query-file-path (16 results) %`,
        );
      });

      it("should get query short label", () => {
        const fqi = createMockVariantAnalysisHistoryItem({
          historyItemStatus: QueryStatus.Completed,
          variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
          executionStartTime,
          userSpecifiedLabel,
        });

        // fall back on user specified if one exists.
        expect(labelProvider.getShortLabel(fqi)).toBe("user-specified-name");

        // use query name if no user-specified label exists
        const fqi2 = createMockVariantAnalysisHistoryItem({});

        expect(labelProvider.getShortLabel(fqi2)).toBe("a-query-name");
      });

      describe("when results are present", () => {
        it("should display results if there are any", () => {
          const fqi = createMockVariantAnalysisHistoryItem({
            historyItemStatus: QueryStatus.Completed,
            resultCount: 16,
            variantAnalysis: createMockVariantAnalysis({
              status: VariantAnalysisStatus.Succeeded,
              executionStartTime,
              scannedRepos: createMockScannedRepos([
                VariantAnalysisRepoStatus.Succeeded,
                VariantAnalysisRepoStatus.Succeeded,
              ]),
            }),
          });
          config.format = "%t %q %d %s %f %r %%";
          expect(labelProvider.getLabel(fqi)).toBe(
            `${dateStr} a-query-name (javascript) 2/2 repositories completed a-query-file-path (16 results) %`,
          );
        });
      });

      describe("when results are not present", () => {
        it("should skip displaying them", () => {
          const fqi = createMockVariantAnalysisHistoryItem({
            historyItemStatus: QueryStatus.Completed,
            resultCount: 0,
            variantAnalysis: createMockVariantAnalysis({
              status: VariantAnalysisStatus.Succeeded,
              executionStartTime,
              scannedRepos: createMockScannedRepos([
                VariantAnalysisRepoStatus.Succeeded,
                VariantAnalysisRepoStatus.Succeeded,
              ]),
            }),
          });
          config.format = "%t %q %d %s %f %r %%";
          expect(labelProvider.getLabel(fqi)).toBe(
            `${dateStr} a-query-name (javascript) 2/2 repositories completed a-query-file-path %`,
          );
        });
      });

      describe("when extra whitespace is present in the middle of the label", () => {
        it("should squash it down to a single whitespace", () => {
          const fqi = createMockVariantAnalysisHistoryItem({
            historyItemStatus: QueryStatus.Completed,
            resultCount: 0,
            variantAnalysis: createMockVariantAnalysis({
              status: VariantAnalysisStatus.Succeeded,
              executionStartTime,
              scannedRepos: createMockScannedRepos([
                VariantAnalysisRepoStatus.Succeeded,
                VariantAnalysisRepoStatus.Succeeded,
              ]),
            }),
          });
          config.format = "%t   %q        %d %s   %f   %r %%";
          expect(labelProvider.getLabel(fqi)).toBe(
            `${dateStr} a-query-name (javascript) 2/2 repositories completed a-query-file-path %`,
          );
        });
      });

      describe("when extra whitespace is present at the start of the label", () => {
        it("should squash it down to a single whitespace", () => {
          const fqi = createMockVariantAnalysisHistoryItem({
            historyItemStatus: QueryStatus.Completed,
            resultCount: 0,
            variantAnalysis: createMockVariantAnalysis({
              status: VariantAnalysisStatus.Succeeded,
              executionStartTime,
              scannedRepos: createMockScannedRepos([
                VariantAnalysisRepoStatus.Succeeded,
                VariantAnalysisRepoStatus.Succeeded,
              ]),
            }),
          });
          config.format = "   %t %q %d %s %f %r %%";
          expect(labelProvider.getLabel(fqi)).toBe(
            ` ${dateStr} a-query-name (javascript) 2/2 repositories completed a-query-file-path %`,
          );
        });
      });

      describe("when extra whitespace is present at the end of the label", () => {
        it("should squash it down to a single whitespace", () => {
          const fqi = createMockVariantAnalysisHistoryItem({
            historyItemStatus: QueryStatus.Completed,
            resultCount: 0,
            variantAnalysis: createMockVariantAnalysis({
              status: VariantAnalysisStatus.Succeeded,
              executionStartTime,
              scannedRepos: createMockScannedRepos([
                VariantAnalysisRepoStatus.Succeeded,
                VariantAnalysisRepoStatus.Succeeded,
              ]),
            }),
          });
          config.format = "%t %q %d %s %f %r %%   ";
          expect(labelProvider.getLabel(fqi)).toBe(
            `${dateStr} a-query-name (javascript) 2/2 repositories completed a-query-file-path % `,
          );
        });
      });
    });
  });
});
