import { join } from "path";
import type { ExtensionContext } from "vscode";
import { Uri, window, workspace } from "vscode";

import { extLogger } from "../../../../src/common/logging/vscode";
import { QueryHistoryManager } from "../../../../src/query-history/query-history-manager";
import { QueryHistoryConfigListener } from "../../../../src/config";
import type { LocalQueryInfo } from "../../../../src/query-results";
import type { DatabaseManager } from "../../../../src/databases/local-databases";
import { tmpDir } from "../../../../src/tmp-dir";
import { HistoryItemLabelProvider } from "../../../../src/query-history/history-item-label-provider";
import type { ResultsView } from "../../../../src/local-queries";
import { WebviewReveal } from "../../../../src/local-queries";
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
import * as dialog from "../../../../src/common/vscode/dialog";
import { mockedQuickPickItem } from "../../utils/mocking.helpers";
import { createMockQueryHistoryDirs } from "../../../factories/query-history/query-history-dirs";
import { createMockApp } from "../../../__mocks__/appMock";
import type { App } from "../../../../src/common/app";
import { createMockCommandManager } from "../../../__mocks__/commandsMock";
import { LanguageContextStore } from "../../../../src/language-context-store";

describe("QueryHistoryManager", () => {
  const mockExtensionLocation = join(tmpDir.name, "mock-extension-location");
  let configListener: QueryHistoryConfigListener;
  let showQuickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let cancelVariantAnalysisSpy: jest.SpiedFunction<
    typeof variantAnalysisManagerStub.cancelVariantAnalysis
  >;
  const doCompareCallback = jest.fn();

  let executeCommand: jest.MockedFn<
    (commandName: string, ...args: any[]) => Promise<any>
  >;
  let mockApp: App;

  let queryHistoryManager: QueryHistoryManager;

  let localQueriesResultsViewStub: ResultsView;
  let variantAnalysisManagerStub: VariantAnalysisManager;

  let allHistory: QueryHistoryInfo[];
  let localQueryHistory: LocalQueryInfo[];
  let variantAnalysisHistory: VariantAnalysisHistoryItem[];

  beforeEach(() => {
    showQuickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockResolvedValue(undefined);

    executeCommand = jest.fn();
    mockApp = createMockApp({
      commands: createMockCommandManager({ executeCommand }),
    });

    jest.spyOn(extLogger, "log").mockResolvedValue(undefined);

    configListener = new QueryHistoryConfigListener();
    localQueriesResultsViewStub = {
      showResults: jest.fn(),
    } as any as ResultsView;

    variantAnalysisManagerStub = {
      onVariantAnalysisAdded: jest.fn(),
      onVariantAnalysisStatusUpdated: jest.fn(),
      onVariantAnalysisRemoved: jest.fn(),
      removeVariantAnalysis: jest.fn(),
      cancelVariantAnalysis: jest.fn(),
      exportResults: jest.fn(),
      showView: jest.fn(),
    } as any as VariantAnalysisManager;

    cancelVariantAnalysisSpy = jest
      .spyOn(variantAnalysisManagerStub, "cancelVariantAnalysis")
      .mockResolvedValue(undefined);

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
  });

  afterEach(async () => {
    if (queryHistoryManager) {
      queryHistoryManager.dispose();
    }
  });

  describe("handleItemClicked", () => {
    describe("single click", () => {
      describe("local query", () => {
        describe("when complete", () => {
          it("should show results", async () => {
            queryHistoryManager = await createMockQueryHistory(allHistory);
            const itemClicked = localQueryHistory[0];
            await queryHistoryManager.handleItemClicked(itemClicked);

            expect(
              localQueriesResultsViewStub.showResults,
            ).toHaveBeenCalledTimes(1);
            expect(
              localQueriesResultsViewStub.showResults,
            ).toHaveBeenCalledWith(itemClicked, WebviewReveal.Forced, false);
            expect(queryHistoryManager.treeDataProvider.getCurrent()).toBe(
              itemClicked,
            );
          });
        });

        describe("when incomplete", () => {
          it("should do nothing", async () => {
            queryHistoryManager = await createMockQueryHistory(allHistory);
            const itemClicked = localQueryHistory[2];
            await queryHistoryManager.handleItemClicked(itemClicked);

            expect(
              localQueriesResultsViewStub.showResults,
            ).not.toHaveBeenCalled();
          });
        });
      });

      describe("variant analysis", () => {
        describe("when complete", () => {
          it("should show results", async () => {
            queryHistoryManager = await createMockQueryHistory(allHistory);
            const itemClicked = variantAnalysisHistory[0];
            await queryHistoryManager.handleItemClicked(itemClicked);

            expect(variantAnalysisManagerStub.showView).toHaveBeenCalledTimes(
              1,
            );
            expect(variantAnalysisManagerStub.showView).toHaveBeenCalledWith(
              itemClicked.variantAnalysis.id,
            );
            expect(queryHistoryManager.treeDataProvider.getCurrent()).toBe(
              itemClicked,
            );
          });
        });

        describe("when incomplete", () => {
          it("should show results", async () => {
            queryHistoryManager = await createMockQueryHistory(allHistory);
            const itemClicked = variantAnalysisHistory[1];
            await queryHistoryManager.handleItemClicked(itemClicked);

            expect(variantAnalysisManagerStub.showView).toHaveBeenCalledTimes(
              1,
            );
            expect(variantAnalysisManagerStub.showView).toHaveBeenCalledWith(
              itemClicked.variantAnalysis.id,
            );
            expect(queryHistoryManager.treeDataProvider.getCurrent()).toBe(
              itemClicked,
            );
          });
        });
      });
    });
  });

  describe("handleRemoveHistoryItem", () => {
    describe("when the item is a local query", () => {
      describe("when the item being removed is not selected", () => {
        // deleting the first item when a different item is selected
        // will not change the selection
        let toDelete: LocalQueryInfo;
        let selected: LocalQueryInfo;

        beforeEach(async () => {
          toDelete = localQueryHistory[1];
          selected = localQueryHistory[3];

          queryHistoryManager = await createMockQueryHistory(localQueryHistory);
          // initialize the selection
          await queryHistoryManager.treeView.reveal(localQueryHistory[0], {
            select: true,
          });

          // select the item we want
          await queryHistoryManager.treeView.reveal(selected, {
            select: true,
          });

          // should be selected
          expect(queryHistoryManager.treeDataProvider.getCurrent()).toEqual(
            selected,
          );

          // remove an item
          await queryHistoryManager.handleRemoveHistoryItem([toDelete]);
        });

        it("should remove the item", () => {
          expect(queryHistoryManager.treeDataProvider.allHistory).toEqual(
            expect.not.arrayContaining([toDelete]),
          );
        });

        it("should not change the selection", () => {
          expect(queryHistoryManager.treeDataProvider.getCurrent()).toEqual(
            selected,
          );

          expect(localQueriesResultsViewStub.showResults).toHaveBeenCalledTimes(
            1,
          );
          expect(localQueriesResultsViewStub.showResults).toHaveBeenCalledWith(
            selected,
            WebviewReveal.Forced,
            false,
          );
        });
      });

      describe("when the item being removed is selected", () => {
        // deleting the selected item automatically selects next item
        let toDelete: LocalQueryInfo;
        let newSelected: LocalQueryInfo;

        beforeEach(async () => {
          toDelete = localQueryHistory[1];
          newSelected = localQueryHistory[2];

          queryHistoryManager = await createMockQueryHistory(localQueryHistory);

          // select the item we want
          await queryHistoryManager.treeView.reveal(toDelete, {
            select: true,
          });
          await queryHistoryManager.handleRemoveHistoryItem([toDelete]);
        });

        it("should remove the item", () => {
          expect(queryHistoryManager.treeDataProvider.allHistory).toEqual(
            expect.not.arrayContaining([toDelete]),
          );
        });

        it.skip("should change the selection", () => {
          expect(queryHistoryManager.treeDataProvider.getCurrent()).toBe(
            newSelected,
          );

          expect(localQueriesResultsViewStub.showResults).toHaveBeenCalledTimes(
            1,
          );
          expect(localQueriesResultsViewStub.showResults).toHaveBeenCalledWith(
            newSelected,
            WebviewReveal.Forced,
            false,
          );
        });
      });
    });

    describe("when the item is a variant analysis", () => {
      let showBinaryChoiceDialogSpy: jest.SpiedFunction<
        typeof dialog.showBinaryChoiceDialog
      >;
      let showInformationMessageWithActionSpy: jest.SpiedFunction<
        typeof dialog.showInformationMessageWithAction
      >;

      beforeEach(() => {
        // Choose 'Yes' when asked "Are you sure?"
        showBinaryChoiceDialogSpy = jest
          .spyOn(dialog, "showBinaryChoiceDialog")
          .mockResolvedValue(true);

        showInformationMessageWithActionSpy = jest.spyOn(
          dialog,
          "showInformationMessageWithAction",
        );
      });

      describe("when in progress", () => {
        describe("when the item being removed is not selected", () => {
          let toDelete: VariantAnalysisHistoryItem;
          let selected: VariantAnalysisHistoryItem;

          beforeEach(async () => {
            // deleting the first item when a different item is selected
            // will not change the selection
            toDelete = variantAnalysisHistory[1];
            selected = variantAnalysisHistory[3];

            queryHistoryManager = await createMockQueryHistory(allHistory);
            // initialize the selection
            await queryHistoryManager.treeView.reveal(
              variantAnalysisHistory[0],
              {
                select: true,
              },
            );

            // select the item we want
            await queryHistoryManager.treeView.reveal(selected, {
              select: true,
            });

            // should be selected
            expect(queryHistoryManager.treeDataProvider.getCurrent()).toEqual(
              selected,
            );
          });

          it("should remove the item", async () => {
            // remove an item
            await queryHistoryManager.handleRemoveHistoryItem([toDelete]);

            expect(
              variantAnalysisManagerStub.removeVariantAnalysis,
            ).toHaveBeenCalledWith(toDelete.variantAnalysis);
            expect(
              queryHistoryManager.treeDataProvider.allHistory,
            ).not.toContain(toDelete);
          });

          it("should not change the selection", async () => {
            // remove an item
            await queryHistoryManager.handleRemoveHistoryItem([toDelete]);

            expect(queryHistoryManager.treeDataProvider.getCurrent()).toEqual(
              selected,
            );
            expect(variantAnalysisManagerStub.showView).toHaveBeenCalledWith(
              selected.variantAnalysis.id,
            );
          });

          it("should show a modal asking 'Are you sure?'", async () => {
            // remove an item
            await queryHistoryManager.handleRemoveHistoryItem([toDelete]);

            expect(showBinaryChoiceDialogSpy).toHaveBeenCalledWith(
              "You are about to delete this query: a-query-name (javascript). Are you sure?",
            );
          });

          it("should show a toast notification with a link to GitHub Actions", async () => {
            // remove an item
            await queryHistoryManager.handleRemoveHistoryItem([toDelete]);

            expect(showInformationMessageWithActionSpy).toHaveBeenCalled();
          });

          describe("when you choose 'No' in the 'Are you sure?' modal", () => {
            beforeEach(async () => {
              showBinaryChoiceDialogSpy.mockResolvedValue(false);
            });

            it("should not delete the item", async () => {
              // remove an item
              await queryHistoryManager.handleRemoveHistoryItem([toDelete]);

              expect(queryHistoryManager.treeDataProvider.allHistory).toContain(
                toDelete,
              );
            });

            it("should not show a toast notification", async () => {
              // remove an item
              await queryHistoryManager.handleRemoveHistoryItem([toDelete]);

              expect(
                showInformationMessageWithActionSpy,
              ).not.toHaveBeenCalled();
            });
          });
        });

        describe("when the item being removed is selected", () => {
          let toDelete: VariantAnalysisHistoryItem;
          let newSelected: VariantAnalysisHistoryItem;

          beforeEach(async () => {
            // deleting the selected item automatically selects next item
            toDelete = variantAnalysisHistory[1];
            newSelected = variantAnalysisHistory[2];

            queryHistoryManager = await createMockQueryHistory(
              variantAnalysisHistory,
            );

            // select the item we want
            await queryHistoryManager.treeView.reveal(toDelete, {
              select: true,
            });
            await queryHistoryManager.handleRemoveHistoryItem([toDelete]);
          });

          it("should remove the item", () => {
            expect(
              variantAnalysisManagerStub.removeVariantAnalysis,
            ).toHaveBeenCalledWith(toDelete.variantAnalysis);
            expect(
              queryHistoryManager.treeDataProvider.allHistory,
            ).not.toContain(toDelete);
          });

          it.skip("should change the selection", () => {
            expect(queryHistoryManager.treeDataProvider.getCurrent()).toEqual(
              newSelected,
            );
            expect(variantAnalysisManagerStub.showView).toHaveBeenCalledWith(
              newSelected.variantAnalysis.id,
            );
          });

          it("should show a modal asking 'Are you sure?'", () => {
            expect(showBinaryChoiceDialogSpy).toHaveBeenCalledWith(
              "You are about to delete this query: a-query-name (javascript). Are you sure?",
            );
          });
        });
      });

      describe("when not in progress", () => {
        describe("when the item being removed is not selected", () => {
          let toDelete: VariantAnalysisHistoryItem;
          let selected: VariantAnalysisHistoryItem;

          beforeEach(async () => {
            // deleting the first item when a different item is selected
            // will not change the selection
            toDelete = variantAnalysisHistory[2];
            selected = variantAnalysisHistory[3];

            queryHistoryManager = await createMockQueryHistory(allHistory);
            // initialize the selection
            await queryHistoryManager.treeView.reveal(
              variantAnalysisHistory[0],
              {
                select: true,
              },
            );

            // select the item we want
            await queryHistoryManager.treeView.reveal(selected, {
              select: true,
            });

            // should be selected
            expect(queryHistoryManager.treeDataProvider.getCurrent()).toEqual(
              selected,
            );

            // remove an item
            await queryHistoryManager.handleRemoveHistoryItem([toDelete]);
          });

          it("should remove the item", () => {
            expect(
              variantAnalysisManagerStub.removeVariantAnalysis,
            ).toHaveBeenCalledWith(toDelete.variantAnalysis);
            expect(
              queryHistoryManager.treeDataProvider.allHistory,
            ).not.toContain(toDelete);
          });

          it("should not change the selection", () => {
            expect(queryHistoryManager.treeDataProvider.getCurrent()).toEqual(
              selected,
            );
            expect(variantAnalysisManagerStub.showView).toHaveBeenCalledWith(
              selected.variantAnalysis.id,
            );
          });

          it("should not show a modal asking 'Are you sure?'", () => {
            expect(showBinaryChoiceDialogSpy).not.toHaveBeenCalled();
          });
        });

        describe("when the item being removed is selected", () => {
          let toDelete: VariantAnalysisHistoryItem;
          let newSelected: VariantAnalysisHistoryItem;

          beforeEach(async () => {
            // deleting the selected item automatically selects next item
            toDelete = variantAnalysisHistory[0];
            newSelected = variantAnalysisHistory[2];

            queryHistoryManager = await createMockQueryHistory(
              variantAnalysisHistory,
            );

            // select the item we want
            await queryHistoryManager.treeView.reveal(toDelete, {
              select: true,
            });
            await queryHistoryManager.handleRemoveHistoryItem([toDelete]);
          });

          it("should remove the item", () => {
            expect(
              variantAnalysisManagerStub.removeVariantAnalysis,
            ).toHaveBeenCalledWith(toDelete.variantAnalysis);
            expect(
              queryHistoryManager.treeDataProvider.allHistory,
            ).not.toContain(toDelete);
          });

          it.skip("should change the selection", () => {
            expect(queryHistoryManager.treeDataProvider.getCurrent()).toEqual(
              newSelected,
            );
            expect(variantAnalysisManagerStub.showView).toHaveBeenCalledWith(
              newSelected.variantAnalysis.id,
            );
          });

          it("should not show a modal asking 'Are you sure?'", () => {
            expect(showBinaryChoiceDialogSpy).not.toHaveBeenCalled();
          });
        });
      });
    });
  });

  describe("handleCancel", () => {
    describe("if the item is in progress", () => {
      it("should cancel a single local query", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const inProgress1 = localQueryHistory[4];
        const cancelSpy = jest.spyOn(inProgress1, "cancel");

        await queryHistoryManager.handleCancel([inProgress1]);
        expect(cancelSpy).toHaveBeenCalledTimes(1);
      });

      it("should cancel multiple local queries", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const inProgress1 = localQueryHistory[4];
        const inProgress2 = localQueryHistory[5];

        const cancelSpy1 = jest.spyOn(inProgress1, "cancel");
        const cancelSpy2 = jest.spyOn(inProgress2, "cancel");

        await queryHistoryManager.handleCancel([inProgress1, inProgress2]);
        expect(cancelSpy1).toHaveBeenCalled();
        expect(cancelSpy2).toHaveBeenCalled();
      });

      it("should cancel a single variant analysis", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const inProgress1 = variantAnalysisHistory[1];

        await queryHistoryManager.handleCancel([inProgress1]);
        expect(cancelVariantAnalysisSpy).toHaveBeenCalledWith(
          inProgress1.variantAnalysis.id,
        );
      });

      it("should cancel multiple variant analyses", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const inProgress1 = variantAnalysisHistory[1];
        const inProgress2 = variantAnalysisHistory[3];

        await queryHistoryManager.handleCancel([inProgress1, inProgress2]);
        expect(cancelVariantAnalysisSpy).toHaveBeenCalledWith(
          inProgress1.variantAnalysis.id,
        );
        expect(cancelVariantAnalysisSpy).toHaveBeenCalledWith(
          inProgress2.variantAnalysis.id,
        );
      });
    });

    describe("if the item is not in progress", () => {
      it("should not cancel a single local query", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const completed = localQueryHistory[0];
        const cancelSpy = jest.spyOn(completed, "cancel");

        await queryHistoryManager.handleCancel([completed]);
        expect(cancelSpy).not.toHaveBeenCalledTimes(1);
      });

      it("should not cancel multiple local queries", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const completed = localQueryHistory[0];
        const failed = localQueryHistory[2];

        const cancelSpy = jest.spyOn(completed, "cancel");
        const cancelSpy2 = jest.spyOn(failed, "cancel");

        await queryHistoryManager.handleCancel([completed, failed]);
        expect(cancelSpy).not.toHaveBeenCalledTimes(1);
        expect(cancelSpy2).not.toHaveBeenCalledTimes(1);
      });

      it("should not cancel a single variant analysis", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const completedVariantAnalysis = variantAnalysisHistory[0];

        await queryHistoryManager.handleCancel([completedVariantAnalysis]);
        expect(cancelVariantAnalysisSpy).not.toHaveBeenCalledWith(
          completedVariantAnalysis.variantAnalysis,
        );
      });

      it("should not cancel multiple variant analyses", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const completedVariantAnalysis = variantAnalysisHistory[0];
        const failedVariantAnalysis = variantAnalysisHistory[2];

        await queryHistoryManager.handleCancel([
          completedVariantAnalysis,
          failedVariantAnalysis,
        ]);
        expect(cancelVariantAnalysisSpy).not.toHaveBeenCalledWith(
          completedVariantAnalysis.variantAnalysis.id,
        );
        expect(cancelVariantAnalysisSpy).not.toHaveBeenCalledWith(
          failedVariantAnalysis.variantAnalysis.id,
        );
      });
    });
  });

  describe("handleCopyRepoList", () => {
    it("should not call a command for a local query", async () => {
      queryHistoryManager = await createMockQueryHistory(localQueryHistory);

      const item = localQueryHistory[4];
      await queryHistoryManager.handleCopyRepoList(item);

      expect(executeCommand).not.toHaveBeenCalled();
    });

    it("should copy repo list for a single variant analysis", async () => {
      variantAnalysisManagerStub.copyRepoListToClipboard = jest.fn();
      queryHistoryManager = await createMockQueryHistory(allHistory);

      const item = variantAnalysisHistory[1];
      await queryHistoryManager.handleCopyRepoList(item);

      expect(
        variantAnalysisManagerStub.copyRepoListToClipboard,
      ).toHaveBeenCalledWith(item.variantAnalysis.id);
    });
  });

  describe("handleExportResults", () => {
    it("should not call a command for a local query", async () => {
      queryHistoryManager = await createMockQueryHistory(localQueryHistory);

      const item = localQueryHistory[4];
      await queryHistoryManager.handleExportResults(item);

      expect(variantAnalysisManagerStub.exportResults).not.toHaveBeenCalled();
    });

    it("should export results for a single variant analysis", async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);

      const item = variantAnalysisHistory[1];
      await queryHistoryManager.handleExportResults(item);
      expect(variantAnalysisManagerStub.exportResults).toHaveBeenCalledWith(
        item.variantAnalysis.id,
      );
    });
  });

  describe("Local Queries", () => {
    describe("findOtherQueryToCompare", () => {
      it("should find the second query to compare when one is selected", async () => {
        const thisQuery = localQueryHistory[3];
        queryHistoryManager = await createMockQueryHistory(allHistory);
        showQuickPickSpy.mockResolvedValue(
          mockedQuickPickItem({
            label: "Query 1",
            query: localQueryHistory[0],
          }),
        );

        const otherQuery = await (
          queryHistoryManager as any
        ).findOtherQueryToCompare(thisQuery, []);
        expect(otherQuery).toBe(localQueryHistory[0]);

        // only called with first item, other items filtered out
        expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
        expect(showQuickPickSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              query: localQueryHistory[0],
            }),
          ]),
        );
      });

      it("should handle cancelling out of the quick select", async () => {
        const thisQuery = localQueryHistory[3];
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const otherQuery = await (
          queryHistoryManager as any
        ).findOtherQueryToCompare(thisQuery, []);
        expect(otherQuery).toBeUndefined();

        // only called with first item, other items filtered out
        expect(showQuickPickSpy).toHaveBeenCalledTimes(1);
        expect(showQuickPickSpy).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              query: localQueryHistory[0],
            }),
          ]),
        );
      });

      it("should compare against 2 queries", async () => {
        const thisQuery = localQueryHistory[3];
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const otherQuery = await (
          queryHistoryManager as any
        ).findOtherQueryToCompare(thisQuery, [thisQuery, localQueryHistory[0]]);
        expect(otherQuery).toBe(localQueryHistory[0]);
        expect(showQuickPickSpy).not.toHaveBeenCalled();
      });

      it("should throw an error when a databases are not the same", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        // localQueryHistory[0] is database a
        // localQueryHistory[1] is database b
        await expect(
          (queryHistoryManager as any).findOtherQueryToCompare(
            localQueryHistory[0],
            [localQueryHistory[0], localQueryHistory[1]],
          ),
        ).rejects.toThrow("Query databases must be the same.");
      });

      it("should throw an error when more than 2 queries selected", async () => {
        const thisQuery = localQueryHistory[3];
        queryHistoryManager = await createMockQueryHistory(allHistory);

        await expect(
          (queryHistoryManager as any).findOtherQueryToCompare(thisQuery, [
            thisQuery,
            localQueryHistory[0],
            localQueryHistory[1],
          ]),
        ).rejects.toThrow("Please select no more than 2 queries.");
      });
    });

    describe("Compare callback", () => {
      it("should call the compare callback", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);
        await queryHistoryManager.handleCompareWith(localQueryHistory[0], [
          localQueryHistory[0],
          localQueryHistory[3],
        ]);
        expect(doCompareCallback).toHaveBeenCalledTimes(1);
        expect(doCompareCallback).toHaveBeenCalledWith(
          localQueryHistory[0],
          localQueryHistory[3],
        );
      });

      it("should avoid calling the compare callback when only one item is selected", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);
        await queryHistoryManager.handleCompareWith(localQueryHistory[0], [
          localQueryHistory[0],
        ]);
        expect(doCompareCallback).not.toHaveBeenCalled();
      });

      it("should throw an error when a query is not successful", async () => {
        const thisQuery = localQueryHistory[3];
        queryHistoryManager = await createMockQueryHistory(allHistory);
        allHistory[0] = createMockLocalQueryInfo({
          dbName: "a",
          queryWithResults: createMockQueryWithResults({
            didRunSuccessfully: false,
          }),
        });

        await expect(
          queryHistoryManager.handleCompareWith(thisQuery, [
            thisQuery,
            allHistory[0],
          ]),
        ).rejects.toThrow(
          "Please only select local queries that have completed successfully.",
        );
      });
    });

    describe("updateCompareWith", () => {
      it("should update compareWithItem when there is a single item", async () => {
        queryHistoryManager = await createMockQueryHistory([]);
        (queryHistoryManager as any).updateCompareWith(["a"]);
        expect(queryHistoryManager.compareWithItem).toBe("a");
      });

      it("should delete compareWithItem when there are 0 items", async () => {
        queryHistoryManager = await createMockQueryHistory([]);
        queryHistoryManager.compareWithItem = localQueryHistory[0];
        (queryHistoryManager as any).updateCompareWith([]);
        expect(queryHistoryManager.compareWithItem).toBeUndefined();
      });

      it("should delete compareWithItem when there are more than 2 items", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);
        queryHistoryManager.compareWithItem = localQueryHistory[0];
        (queryHistoryManager as any).updateCompareWith([
          localQueryHistory[0],
          localQueryHistory[1],
          localQueryHistory[2],
        ]);
        expect(queryHistoryManager.compareWithItem).toBeUndefined();
      });

      it("should delete compareWithItem when there are 2 items and disjoint from compareWithItem", async () => {
        queryHistoryManager = await createMockQueryHistory([]);
        queryHistoryManager.compareWithItem = localQueryHistory[0];
        (queryHistoryManager as any).updateCompareWith([
          localQueryHistory[1],
          localQueryHistory[2],
        ]);
        expect(queryHistoryManager.compareWithItem).toBeUndefined();
      });

      it("should do nothing when compareWithItem exists and exactly 2 items", async () => {
        queryHistoryManager = await createMockQueryHistory([]);
        queryHistoryManager.compareWithItem = localQueryHistory[0];
        (queryHistoryManager as any).updateCompareWith([
          localQueryHistory[0],
          localQueryHistory[1],
        ]);
        expect(queryHistoryManager.compareWithItem).toBe(localQueryHistory[0]);
      });
    });
  });

  async function createMockQueryHistory(allHistory: QueryHistoryInfo[]) {
    const qhm = new QueryHistoryManager(
      mockApp,
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
      new LanguageContextStore(mockApp),
      doCompareCallback,
    );
    (qhm.treeDataProvider as any).history = [...allHistory];
    await workspace.saveAll();
    await qhm.refreshTreeView();
    return qhm;
  }
});
