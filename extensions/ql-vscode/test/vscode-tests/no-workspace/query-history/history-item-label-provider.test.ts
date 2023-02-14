import { env } from "vscode";
import { QueryHistoryConfig } from "../../../../src/config";
import { HistoryItemLabelProvider } from "../../../../src/query-history/history-item-label-provider";
import { createMockLocalQueryInfo } from "../../../factories/query-history/local-query-history-item";

describe("HistoryItemLabelProvider", () => {
  let labelProvider: HistoryItemLabelProvider;
  let config: QueryHistoryConfig;
  const date = new Date("2022-01-01T00:00:00.000Z");
  const dateStr = date.toLocaleString(env.language);
  const userSpecifiedLabel = "user-specified-name";

  beforeEach(() => {
    config = {
      format: "xxx %q xxx",
    } as unknown as QueryHistoryConfig;
    labelProvider = new HistoryItemLabelProvider(config);
  });

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
});
