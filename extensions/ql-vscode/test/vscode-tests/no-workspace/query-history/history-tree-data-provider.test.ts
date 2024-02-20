import { join } from "path";
import type { ExtensionContext } from "vscode";
import { ThemeColor, ThemeIcon, Uri, workspace } from "vscode";

import { extLogger } from "../../../../src/common/logging/vscode";
import { QueryHistoryConfigListener } from "../../../../src/config";
import type { LocalQueryInfo } from "../../../../src/query-results";
import type { DatabaseManager } from "../../../../src/databases/local-databases";
import { tmpDir } from "../../../../src/tmp-dir";
import { HistoryItemLabelProvider } from "../../../../src/query-history/history-item-label-provider";
import type { ResultsView } from "../../../../src/local-queries";
import type { EvalLogViewer } from "../../../../src/query-evaluation-logging";
import type { QueryRunner } from "../../../../src/query-server/query-runner";
import type { VariantAnalysisManager } from "../../../../src/variant-analysis/variant-analysis-manager";
import type { QueryHistoryInfo } from "../../../../src/query-history/query-history-info";
import {
  createMockLocalQueryInfo,
  createMockQueryWithResults,
} from "../../../factories/query-history/local-query-history-item";
import { shuffle } from "../../utils/list-helpers";
import { createMockVariantAnalysisHistoryItem } from "../../../factories/query-history/variant-analysis-history-item";
import type { VariantAnalysisHistoryItem } from "../../../../src/query-history/variant-analysis-history-item";
import { QueryStatus } from "../../../../src/query-history/query-status";
import { VariantAnalysisStatus } from "../../../../src/variant-analysis/shared/variant-analysis";
import {
  HistoryTreeDataProvider,
  SortOrder,
} from "../../../../src/query-history/history-tree-data-provider";
import { QueryHistoryManager } from "../../../../src/query-history/query-history-manager";
import { createMockQueryHistoryDirs } from "../../../factories/query-history/query-history-dirs";
import { createMockApp } from "../../../__mocks__/appMock";
import { LanguageContextStore } from "../../../../src/language-context-store";
import type { App } from "../../../../src/common/app";
import { QueryLanguage } from "../../../../src/common/query-language";

describe("HistoryTreeDataProvider", () => {
  const mockExtensionLocation = join(tmpDir.name, "mock-extension-location");
  let app: App;
  let configListener: QueryHistoryConfigListener;
  const doCompareCallback = jest.fn();

  let queryHistoryManager: QueryHistoryManager;

  let localQueriesResultsViewStub: ResultsView;
  let variantAnalysisManagerStub: VariantAnalysisManager;

  let allHistory: QueryHistoryInfo[];
  let localQueryHistory: LocalQueryInfo[];
  let variantAnalysisHistory: VariantAnalysisHistoryItem[];

  let historyTreeDataProvider: HistoryTreeDataProvider;
  let labelProvider: HistoryItemLabelProvider;
  let languageContext: LanguageContextStore;

  beforeEach(() => {
    jest.spyOn(extLogger, "log").mockResolvedValue(undefined);

    app = createMockApp({});
    configListener = new QueryHistoryConfigListener();
    localQueriesResultsViewStub = {
      showResults: jest.fn(),
    } as any as ResultsView;

    variantAnalysisManagerStub = {
      onVariantAnalysisAdded: jest.fn(),
      onVariantAnalysisStatusUpdated: jest.fn(),
      onVariantAnalysisRemoved: jest.fn(),
      removeVariantAnalysis: jest.fn(),
      showView: jest.fn(),
    } as any as VariantAnalysisManager;

    localQueryHistory = [
      // completed
      createMockLocalQueryInfo({
        dbName: "a",
        queryWithResults: createMockQueryWithResults({
          didRunSuccessfully: true,
        }),
      }),
      // completed
      createMockLocalQueryInfo({
        dbName: "b",
        queryWithResults: createMockQueryWithResults({
          didRunSuccessfully: true,
        }),
      }),
      // failed
      createMockLocalQueryInfo({
        dbName: "a",
        queryWithResults: createMockQueryWithResults({
          didRunSuccessfully: false,
        }),
      }),
      // completed
      createMockLocalQueryInfo({
        dbName: "a",
        queryWithResults: createMockQueryWithResults({
          didRunSuccessfully: true,
        }),
      }),
      // in progress
      createMockLocalQueryInfo({ resultCount: 0 }),
      // in progress
      createMockLocalQueryInfo({ resultCount: 0 }),
    ];
    variantAnalysisHistory = [
      createMockVariantAnalysisHistoryItem({
        historyItemStatus: QueryStatus.Completed,
        variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
      }),
      createMockVariantAnalysisHistoryItem({
        historyItemStatus: QueryStatus.InProgress,
        variantAnalysisStatus: VariantAnalysisStatus.InProgress,
      }),
      createMockVariantAnalysisHistoryItem({
        historyItemStatus: QueryStatus.Failed,
        variantAnalysisStatus: VariantAnalysisStatus.Failed,
      }),
      createMockVariantAnalysisHistoryItem({
        historyItemStatus: QueryStatus.InProgress,
        variantAnalysisStatus: VariantAnalysisStatus.InProgress,
      }),
    ];
    allHistory = shuffle([...localQueryHistory, ...variantAnalysisHistory]);

    labelProvider = new HistoryItemLabelProvider({
      format: "",
      ttlInMillis: 0,
      onDidChangeConfiguration: jest.fn(),
    });
    languageContext = new LanguageContextStore(app);
    historyTreeDataProvider = new HistoryTreeDataProvider(
      labelProvider,
      languageContext,
    );
  });

  afterEach(async () => {
    if (queryHistoryManager) {
      queryHistoryManager.dispose();
    }
    historyTreeDataProvider.dispose();
  });

  describe("getTreeItem", () => {
    it("should get a tree item with raw results", async () => {
      const mockQueryWithRawResults = createMockLocalQueryInfo({
        dbName: "a",
        queryWithResults: createMockQueryWithResults({
          didRunSuccessfully: true,
          hasInterpretedResults: false,
        }),
      });

      const treeItem = await historyTreeDataProvider.getTreeItem(
        mockQueryWithRawResults,
      );
      expect(treeItem.command).toEqual({
        title: "Query History Item",
        command: "codeQLQueryHistory.itemClicked",
        arguments: [mockQueryWithRawResults],
        tooltip: labelProvider.getLabel(mockQueryWithRawResults),
      });
      expect(treeItem.label).toContain("query-file.ql");
      expect(treeItem.contextValue).toBe("rawResultsItem");
      expect(treeItem.iconPath).toEqual(new ThemeIcon("database"));
    });

    it("should get a tree item with interpreted results", async () => {
      const mockQueryWithInterpretedResults = createMockLocalQueryInfo({
        dbName: "a",
        queryWithResults: createMockQueryWithResults({
          didRunSuccessfully: true,
          hasInterpretedResults: true,
        }),
      });

      const treeItem = await historyTreeDataProvider.getTreeItem(
        mockQueryWithInterpretedResults,
      );
      expect(treeItem.contextValue).toBe("interpretedResultsItem");
      expect(treeItem.iconPath).toEqual(new ThemeIcon("database"));
    });

    it("should get a tree item that did not complete successfully", async () => {
      const mockQuery = createMockLocalQueryInfo({
        dbName: "a",
        failureReason: "failure reason",
        queryWithResults: createMockQueryWithResults({
          didRunSuccessfully: false,
        }),
      });

      const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
      expect(treeItem.iconPath).toEqual(
        new ThemeIcon("error", new ThemeColor("errorForeground")),
      );
    });

    it("should get a tree item that failed before creating any results", async () => {
      const mockQuery = createMockLocalQueryInfo({
        dbName: "a",
        failureReason: "failure reason",
      });

      const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
      expect(treeItem.iconPath).toEqual(
        new ThemeIcon("error", new ThemeColor("errorForeground")),
      );
    });

    it("should get a tree item that is in progress", async () => {
      const mockQuery = createMockLocalQueryInfo({ dbName: "a" });

      const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
      expect(treeItem.iconPath).toEqual({
        id: "sync~spin",
        color: undefined,
      });
    });
  });

  describe("getChildren", () => {
    it("fetch children correctly", () => {
      const mockQuery = createMockLocalQueryInfo({});
      historyTreeDataProvider.allHistory.push(mockQuery);
      expect(historyTreeDataProvider.getChildren()).toEqual([mockQuery]);
      expect(historyTreeDataProvider.getChildren(mockQuery)).toEqual([]);
    });

    describe("sorting", () => {
      const history = [
        createMockLocalQueryInfo({
          userSpecifiedLabel: "b",
          startTime: new Date(10),
          resultCount: 20,
        }),
        createMockVariantAnalysisHistoryItem({
          userSpecifiedLabel: "c",
          executionStartTime: 15,
          resultCount: 456,
          historyItemStatus: QueryStatus.Completed,
          variantAnalysisStatus: VariantAnalysisStatus.Succeeded,
        }),
        createMockLocalQueryInfo({
          userSpecifiedLabel: "d",
          startTime: new Date(5),
          resultCount: 30,
        }),
        createMockVariantAnalysisHistoryItem({
          userSpecifiedLabel: "e",
          executionStartTime: 50,
          resultCount: 15,
          historyItemStatus: QueryStatus.InProgress,
          variantAnalysisStatus: VariantAnalysisStatus.InProgress,
        }),
        createMockLocalQueryInfo({
          userSpecifiedLabel: "f",
          startTime: new Date(1),
          resultCount: 13,
        }),
        createMockVariantAnalysisHistoryItem({
          userSpecifiedLabel: "g",
          executionStartTime: 7,
          resultCount: 30,
          historyItemStatus: QueryStatus.Failed,
          variantAnalysisStatus: VariantAnalysisStatus.Failed,
        }),
      ];

      let treeDataProvider: HistoryTreeDataProvider;

      beforeEach(async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);
        (queryHistoryManager.treeDataProvider as any).history = [...history];
        treeDataProvider = queryHistoryManager.treeDataProvider;
      });

      it("should get children for name ascending", async () => {
        const expected = [...history];
        treeDataProvider.sortOrder = SortOrder.NameAsc;

        const children = await treeDataProvider.getChildren();
        expect(children).toEqual(expected);
      });

      it("should get children for name descending", async () => {
        const expected = [...history].reverse();
        treeDataProvider.sortOrder = SortOrder.NameDesc;

        const children = await treeDataProvider.getChildren();
        expect(children).toEqual(expected);
      });

      it("should get children for date ascending", async () => {
        const expected = [
          history[4],
          history[2],
          history[5],
          history[0],
          history[1],
          history[3],
        ];
        treeDataProvider.sortOrder = SortOrder.DateAsc;

        const children = await treeDataProvider.getChildren();
        expect(children).toEqual(expected);
      });

      it("should get children for date descending", async () => {
        const expected = [
          history[4],
          history[2],
          history[5],
          history[0],
          history[1],
          history[3],
        ].reverse();

        treeDataProvider.sortOrder = SortOrder.DateDesc;

        const children = await treeDataProvider.getChildren();
        expect(children).toEqual(expected);
      });

      it("should get children for result count ascending", async () => {
        const expected = [
          history[4],
          history[3],
          history[0],
          history[2],
          history[5],
          history[1],
        ];
        treeDataProvider.sortOrder = SortOrder.CountAsc;

        const children = await treeDataProvider.getChildren();

        expect(children).toEqual(expected);
      });

      it("should get children for result count descending", async () => {
        const expected = [
          history[4],
          history[3],
          history[0],
          history[2],
          history[5],
          history[1],
        ].reverse();
        treeDataProvider.sortOrder = SortOrder.CountDesc;

        const children = await treeDataProvider.getChildren();
        expect(children).toEqual(expected);
      });

      it("should fall back to name ascending when there are no results", async () => {
        const thisHistory = [
          createMockLocalQueryInfo({
            userSpecifiedLabel: "a",
            resultCount: 0,
            startTime: new Date(10),
          }),
          createMockLocalQueryInfo({
            userSpecifiedLabel: "b",
            resultCount: 0,
            startTime: new Date(1),
          }),
          createMockVariantAnalysisHistoryItem({
            userSpecifiedLabel: "c",
            resultCount: 0,
            historyItemStatus: QueryStatus.Completed,
            variantAnalysisStatus: VariantAnalysisStatus.Failed,
          }),
          createMockVariantAnalysisHistoryItem({
            userSpecifiedLabel: "e",
            resultCount: 0,
            historyItemStatus: QueryStatus.InProgress,
            variantAnalysisStatus: VariantAnalysisStatus.Failed,
          }),
        ];
        (queryHistoryManager!.treeDataProvider as any).history = [
          ...thisHistory,
        ];
        const expected = [...thisHistory];

        treeDataProvider.sortOrder = SortOrder.CountAsc;

        const children = await treeDataProvider.getChildren();

        expect(children).toEqual(expected);
      });

      it("should fall back to name descending when there are no results", async () => {
        const thisHistory = [
          createMockLocalQueryInfo({
            userSpecifiedLabel: "a",
            resultCount: 0,
            startTime: new Date(10),
          }),
          createMockLocalQueryInfo({
            userSpecifiedLabel: "b",
            resultCount: 0,
            startTime: new Date(1),
          }),
          createMockVariantAnalysisHistoryItem({
            userSpecifiedLabel: "c",
            resultCount: 0,
            historyItemStatus: QueryStatus.Completed,
            variantAnalysisStatus: VariantAnalysisStatus.Failed,
          }),
          createMockVariantAnalysisHistoryItem({
            userSpecifiedLabel: "e",
            resultCount: 0,
            historyItemStatus: QueryStatus.InProgress,
            variantAnalysisStatus: VariantAnalysisStatus.Failed,
          }),
        ];
        (queryHistoryManager!.treeDataProvider as any).history = [
          ...thisHistory,
        ];
        const expected = [...thisHistory].reverse();
        treeDataProvider.sortOrder = SortOrder.CountDesc;

        const children = await treeDataProvider.getChildren();
        expect(children).toEqual(expected);
      });
    });

    describe("filtering", () => {
      const history = [
        createMockLocalQueryInfo({
          userSpecifiedLabel: "a",
          // No language at all => unknown
        }),
        createMockVariantAnalysisHistoryItem({
          userSpecifiedLabel: "b",
          // No specified language => javascript
        }),
        createMockLocalQueryInfo({
          userSpecifiedLabel: "c",
          language: QueryLanguage.Python,
        }),
        createMockVariantAnalysisHistoryItem({
          userSpecifiedLabel: "d",
          language: QueryLanguage.Java,
        }),
      ];

      let treeDataProvider: HistoryTreeDataProvider;

      beforeEach(async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);
        (queryHistoryManager.treeDataProvider as any).history = [...history];
        treeDataProvider = queryHistoryManager.treeDataProvider;
      });

      it("should get all if no filter is provided", async () => {
        const expected = [history[0], history[1], history[2], history[3]];
        treeDataProvider.sortOrder = SortOrder.NameAsc;

        const children = await treeDataProvider.getChildren();
        expect(children).toEqual(expected);
      });

      it("should filter local runs by language", async () => {
        const expected = [history[3]];
        treeDataProvider.sortOrder = SortOrder.NameAsc;

        await languageContext.setLanguageContext(QueryLanguage.Java);

        const children = await treeDataProvider.getChildren();
        expect(children).toEqual(expected);
      });

      it("should filter variant analysis runs by language", async () => {
        const expected = [history[2]];
        treeDataProvider.sortOrder = SortOrder.NameAsc;

        await languageContext.setLanguageContext(QueryLanguage.Python);

        const children = await treeDataProvider.getChildren();
        expect(children).toEqual(expected);
      });
    });
  });

  async function createMockQueryHistory(allHistory: QueryHistoryInfo[]) {
    const qhm = new QueryHistoryManager(
      app,
      {} as QueryRunner,
      {} as DatabaseManager,
      localQueriesResultsViewStub,
      variantAnalysisManagerStub,
      {} as EvalLogViewer,
      createMockQueryHistoryDirs(),
      {
        globalStorageUri: Uri.file(mockExtensionLocation),
        extensionPath: Uri.file("/x/y/z").fsPath,
      } as ExtensionContext,
      configListener,
      new HistoryItemLabelProvider({
        format: "",
        ttlInMillis: 0,
        onDidChangeConfiguration: jest.fn(),
      }),
      languageContext,
      doCompareCallback,
    );
    (qhm.treeDataProvider as any).history = [...allHistory];
    await workspace.saveAll();
    await qhm.refreshTreeView();
    return qhm;
  }
});
