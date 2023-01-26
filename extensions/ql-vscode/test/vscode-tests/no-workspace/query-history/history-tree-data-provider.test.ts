import { join } from "path";
import * as vscode from "vscode";

import { extLogger } from "../../../../src/common";
import {
  QueryHistoryConfig,
  QueryHistoryConfigListener,
} from "../../../../src/config";
import { LocalQueryInfo } from "../../../../src/query-results";
import { DatabaseManager } from "../../../../src/databases";
import { tmpDir } from "../../../../src/helpers";
import { HistoryItemLabelProvider } from "../../../../src/query-history/history-item-label-provider";
import { RemoteQueriesManager } from "../../../../src/remote-queries/remote-queries-manager";
import { ResultsView } from "../../../../src/interface";
import { EvalLogViewer } from "../../../../src/eval-log-viewer";
import { QueryRunner } from "../../../../src/queryRunner";
import { VariantAnalysisManager } from "../../../../src/remote-queries/variant-analysis-manager";
import { QueryHistoryInfo } from "../../../../src/query-history/query-history-info";
import {
  createMockLocalQueryInfo,
  createMockQueryWithResults,
} from "../../../factories/query-history/local-query-history-item";
import { createMockRemoteQueryHistoryItem } from "../../../factories/query-history/remote-query-history-item";
import { RemoteQueryHistoryItem } from "../../../../src/remote-queries/remote-query-history-item";
import { shuffleHistoryItems } from "../../utils/query-history-helpers";
import { createMockVariantAnalysisHistoryItem } from "../../../factories/query-history/variant-analysis-history-item";
import { VariantAnalysisHistoryItem } from "../../../../src/query-history/variant-analysis-history-item";
import { QueryStatus } from "../../../../src/query-status";
import { VariantAnalysisStatus } from "../../../../src/remote-queries/shared/variant-analysis";
import { Credentials } from "../../../../src/common/authentication";
import { createMockApp } from "../../../__mocks__/appMock";
import {
  HistoryTreeDataProvider,
  SortOrder,
} from "../../../../src/query-history/history-tree-data-provider";
import { QueryHistoryManager } from "../../../../src/query-history/query-history-manager";

describe("HistoryTreeDataProvider", () => {
  const mockExtensionLocation = join(tmpDir.name, "mock-extension-location");
  let configListener: QueryHistoryConfigListener;
  const doCompareCallback = jest.fn();

  let queryHistoryManager: QueryHistoryManager;

  let localQueriesResultsViewStub: ResultsView;
  let remoteQueriesManagerStub: RemoteQueriesManager;
  let variantAnalysisManagerStub: VariantAnalysisManager;

  let allHistory: QueryHistoryInfo[];
  let localQueryHistory: LocalQueryInfo[];
  let remoteQueryHistory: RemoteQueryHistoryItem[];
  let variantAnalysisHistory: VariantAnalysisHistoryItem[];

  let historyTreeDataProvider: HistoryTreeDataProvider;
  let labelProvider: HistoryItemLabelProvider;

  beforeEach(() => {
    jest.spyOn(extLogger, "log").mockResolvedValue(undefined);

    configListener = new QueryHistoryConfigListener();
    localQueriesResultsViewStub = {
      showResults: jest.fn(),
    } as any as ResultsView;
    remoteQueriesManagerStub = {
      onRemoteQueryAdded: jest.fn(),
      onRemoteQueryRemoved: jest.fn(),
      onRemoteQueryStatusUpdate: jest.fn(),
      removeRemoteQuery: jest.fn(),
      openRemoteQueryResults: jest.fn(),
    } as any as RemoteQueriesManager;

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
    remoteQueryHistory = [
      createMockRemoteQueryHistoryItem({ status: QueryStatus.Completed }),
      createMockRemoteQueryHistoryItem({ status: QueryStatus.Failed }),
      createMockRemoteQueryHistoryItem({ status: QueryStatus.InProgress }),
      createMockRemoteQueryHistoryItem({ status: QueryStatus.InProgress }),
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
    allHistory = shuffleHistoryItems([
      ...localQueryHistory,
      ...remoteQueryHistory,
      ...variantAnalysisHistory,
    ]);

    labelProvider = new HistoryItemLabelProvider({
      /**/
    } as QueryHistoryConfig);
    historyTreeDataProvider = new HistoryTreeDataProvider(labelProvider);
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
      expect(treeItem.iconPath).toEqual(new vscode.ThemeIcon("database"));
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
      expect(treeItem.iconPath).toEqual(new vscode.ThemeIcon("database"));
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
        new vscode.ThemeIcon("error", new vscode.ThemeColor("errorForeground")),
      );
    });

    it("should get a tree item that failed before creating any results", async () => {
      const mockQuery = createMockLocalQueryInfo({
        dbName: "a",
        failureReason: "failure reason",
      });

      const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
      expect(treeItem.iconPath).toEqual(
        new vscode.ThemeIcon("error", new vscode.ThemeColor("errorForeground")),
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
        createMockRemoteQueryHistoryItem({
          userSpecifiedLabel: "a",
          executionStartTime: 2,
          resultCount: 24,
          status: QueryStatus.Completed,
        }),
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
        createMockRemoteQueryHistoryItem({
          userSpecifiedLabel: "h",
          executionStartTime: 6,
          resultCount: 5,
          status: QueryStatus.InProgress,
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
          history[5],
          history[0],
          history[3],
          history[7],
          history[6],
          history[1],
          history[2],
          history[4],
        ];
        treeDataProvider.sortOrder = SortOrder.DateAsc;

        const children = await treeDataProvider.getChildren();
        expect(children).toEqual(expected);
      });

      it("should get children for date descending", async () => {
        const expected = [
          history[5],
          history[0],
          history[3],
          history[7],
          history[6],
          history[1],
          history[2],
          history[4],
        ].reverse();

        treeDataProvider.sortOrder = SortOrder.DateDesc;

        const children = await treeDataProvider.getChildren();
        expect(children).toEqual(expected);
      });

      it("should get children for result count ascending", async () => {
        const expected = [
          history[7],
          history[5],
          history[4],
          history[1],
          history[0],
          history[3],
          history[6],
          history[2],
        ];
        treeDataProvider.sortOrder = SortOrder.CountAsc;

        const children = await treeDataProvider.getChildren();

        expect(children).toEqual(expected);
      });

      it("should get children for result count descending", async () => {
        const expected = [
          history[7],
          history[5],
          history[4],
          history[1],
          history[0],
          history[3],
          history[6],
          history[2],
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
          createMockRemoteQueryHistoryItem({
            userSpecifiedLabel: "d",
            resultCount: 0,
            executionStartTime: 50,
            status: QueryStatus.Completed,
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
          createMockRemoteQueryHistoryItem({
            userSpecifiedLabel: "d",
            resultCount: 0,
            executionStartTime: 50,
            status: QueryStatus.Completed,
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
  });

  async function createMockQueryHistory(
    allHistory: QueryHistoryInfo[],
    credentials?: Credentials,
  ) {
    const qhm = new QueryHistoryManager(
      createMockApp({ credentials }),
      {} as QueryRunner,
      {} as DatabaseManager,
      localQueriesResultsViewStub,
      remoteQueriesManagerStub,
      variantAnalysisManagerStub,
      {} as EvalLogViewer,
      "xxx",
      {
        globalStorageUri: vscode.Uri.file(mockExtensionLocation),
        extensionPath: vscode.Uri.file("/x/y/z").fsPath,
      } as vscode.ExtensionContext,
      configListener,
      new HistoryItemLabelProvider({} as QueryHistoryConfig),
      doCompareCallback,
    );
    (qhm.treeDataProvider as any).history = [...allHistory];
    await vscode.workspace.saveAll();
    await qhm.refreshTreeView();
    return qhm;
  }
});
