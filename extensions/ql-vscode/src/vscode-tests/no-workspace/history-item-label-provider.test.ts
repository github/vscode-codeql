import { env } from "vscode";
import { expect } from "chai";
import { QueryHistoryConfig } from "../../config";
import { HistoryItemLabelProvider } from "../../history-item-label-provider";
import { createMockLocalQueryInfo } from "../factories/local-queries/local-query-history-item";
import { createMockRemoteQueryHistoryItem } from "../factories/remote-queries/remote-query-history-item";
import { QueryStatus } from "../../query-status";

describe("HistoryItemLabelProvider", () => {
  let labelProvider: HistoryItemLabelProvider;
  let config: QueryHistoryConfig;
  const date = new Date("2022-01-01T00:00:00.000Z");
  const dateStr = date.toLocaleString(env.language);
  const executionStartTime = date.getTime();
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

      expect(labelProvider.getLabel(fqi)).to.eq("user-specified-name");

      fqi.userSpecifiedLabel = "%t %q %d %s %f %r %%";
      expect(labelProvider.getLabel(fqi)).to.eq(
        `${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %`,
      );

      fqi.userSpecifiedLabel = "%t %q %d %s %f %r %%::%t %q %d %s %f %r %%";
      expect(labelProvider.getLabel(fqi)).to.eq(
        `${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %::${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %`,
      );
    });

    it("should interpolate query when not user specified", () => {
      const fqi = createMockLocalQueryInfo({
        startTime: date,
        resultCount: 456,
        hasMetadata: true,
      });

      expect(labelProvider.getLabel(fqi)).to.eq("xxx query-name xxx");

      config.format = "%t %q %d %s %f %r %%";
      expect(labelProvider.getLabel(fqi)).to.eq(
        `${dateStr} query-name db-name finished in 0 seconds query-file.ql (456 results) %`,
      );

      config.format = "%t %q %d %s %f %r %%::%t %q %d %s %f %r %%";
      expect(labelProvider.getLabel(fqi)).to.eq(
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
      expect(labelProvider.getShortLabel(fqi)).to.eq("user-specified-name");

      // use query name if no user-specified label exists
      fqi.userSpecifiedLabel = undefined;
      expect(labelProvider.getShortLabel(fqi)).to.eq("query-name");

      // use file name if no user-specified label exists and the query is not yet completed (meaning it has no results)
      const fqi2 = createMockLocalQueryInfo({
        startTime: date,
        hasMetadata: true,
      });
      expect(labelProvider.getShortLabel(fqi2)).to.eq("query-file.ql");
    });
  });

  describe("remote queries", () => {
    it("should interpolate query when user specified", () => {
      const fqi = createMockRemoteQueryHistoryItem({ userSpecifiedLabel });

      expect(labelProvider.getLabel(fqi)).to.eq(userSpecifiedLabel);

      fqi.userSpecifiedLabel = "%t %q %d %s %%";
      expect(labelProvider.getLabel(fqi)).to.eq(
        `${dateStr} query-name (javascript) github/vscode-codeql-integration-tests in progress %`,
      );

      fqi.userSpecifiedLabel = "%t %q %d %s %%::%t %q %d %s %%";
      expect(labelProvider.getLabel(fqi)).to.eq(
        `${dateStr} query-name (javascript) github/vscode-codeql-integration-tests in progress %::${dateStr} query-name (javascript) github/vscode-codeql-integration-tests in progress %`,
      );
    });

    it("should interpolate query when not user-specified", () => {
      const fqi = createMockRemoteQueryHistoryItem({
        status: QueryStatus.Completed,
        executionStartTime,
        resultCount: 16,
      });

      expect(labelProvider.getLabel(fqi)).to.eq(
        "xxx query-name (javascript) xxx",
      );

      config.format = "%t %q %d %s %f %r %%";
      expect(labelProvider.getLabel(fqi)).to.eq(
        `${dateStr} query-name (javascript) github/vscode-codeql-integration-tests completed query-file.ql (16 results) %`,
      );

      config.format = "%t %q %d %s %f %r %%::%t %q %d %s %f %r %%";
      expect(labelProvider.getLabel(fqi)).to.eq(
        `${dateStr} query-name (javascript) github/vscode-codeql-integration-tests completed query-file.ql (16 results) %::${dateStr} query-name (javascript) github/vscode-codeql-integration-tests completed query-file.ql (16 results) %`,
      );
    });

    it("should use number of repositories instead of controller repo if available", () => {
      const fqi = createMockRemoteQueryHistoryItem({
        status: QueryStatus.Completed,
        executionStartTime,
        resultCount: 16,
        repositoryCount: 2,
      });

      config.format = "%t %q %d %s %f %r %%";
      expect(labelProvider.getLabel(fqi)).to.eq(
        `${dateStr} query-name (javascript) 2 repositories completed query-file.ql (16 results) %`,
      );
    });

    it("should get query short label", () => {
      const fqi = createMockRemoteQueryHistoryItem({
        status: QueryStatus.Completed,
        executionStartTime,
        userSpecifiedLabel,
      });

      // fall back on user specified if one exists.
      expect(labelProvider.getShortLabel(fqi)).to.eq("user-specified-name");

      // use query name if no user-specified label exists
      const fqi2 = createMockRemoteQueryHistoryItem({});

      expect(labelProvider.getShortLabel(fqi2)).to.eq("query-name");
    });

    describe("when results are present", () => {
      it("should display results if there are any", () => {
        const fqi = createMockRemoteQueryHistoryItem({
          status: QueryStatus.Completed,
          executionStartTime,
          resultCount: 16,
          repositoryCount: 2,
        });
        config.format = "%t %q %d %s %f %r %%";
        expect(labelProvider.getLabel(fqi)).to.eq(
          `${dateStr} query-name (javascript) 2 repositories completed query-file.ql (16 results) %`,
        );
      });
    });

    describe("when results are not present", () => {
      it("should skip displaying them", () => {
        const fqi = createMockRemoteQueryHistoryItem({
          status: QueryStatus.Completed,
          executionStartTime,
          resultCount: 0,
          repositoryCount: 2,
        });
        config.format = "%t %q %d %s %f %r %%";
        expect(labelProvider.getLabel(fqi)).to.eq(
          `${dateStr} query-name (javascript) 2 repositories completed query-file.ql %`,
        );
      });
    });

    describe("when extra whitespace is present in the middle of the label", () => {
      it("should squash it down to a single whitespace", () => {
        const fqi = createMockRemoteQueryHistoryItem({
          status: QueryStatus.Completed,
          executionStartTime,
          resultCount: 0,
          repositoryCount: 2,
        });
        config.format = "%t   %q        %d %s   %f   %r %%";
        expect(labelProvider.getLabel(fqi)).to.eq(
          `${dateStr} query-name (javascript) 2 repositories completed query-file.ql %`,
        );
      });
    });

    describe("when extra whitespace is present at the start of the label", () => {
      it("should squash it down to a single whitespace", () => {
        const fqi = createMockRemoteQueryHistoryItem({
          status: QueryStatus.Completed,
          executionStartTime,
          resultCount: 0,
          repositoryCount: 2,
        });
        config.format = "   %t %q %d %s %f %r %%";
        expect(labelProvider.getLabel(fqi)).to.eq(
          ` ${dateStr} query-name (javascript) 2 repositories completed query-file.ql %`,
        );
      });
    });

    describe("when extra whitespace is present at the end of the label", () => {
      it("should squash it down to a single whitespace", () => {
        const fqi = createMockRemoteQueryHistoryItem({
          status: QueryStatus.Completed,
          executionStartTime,
          resultCount: 0,
          repositoryCount: 2,
        });
        config.format = "%t %q %d %s %f %r %%   ";
        expect(labelProvider.getLabel(fqi)).to.eq(
          `${dateStr} query-name (javascript) 2 repositories completed query-file.ql % `,
        );
      });
    });
  });
});
