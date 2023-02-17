import { join } from "path";
import * as vscode from "vscode";

import { extLogger } from "../../../../src/common";
import { QueryHistoryManager } from "../../../../src/query-history/query-history-manager";
import {
  QueryHistoryConfig,
  QueryHistoryConfigListener,
} from "../../../../src/config";
import { LocalQueryInfo } from "../../../../src/query-results";
import { DatabaseManager } from "../../../../src/databases";
import { tmpDir } from "../../../../src/helpers";
import { HistoryItemLabelProvider } from "../../../../src/query-history/history-item-label-provider";
import { ResultsView } from "../../../../src/interface";
import { EvalLogViewer } from "../../../../src/eval-log-viewer";
import { QueryRunner } from "../../../../src/queryRunner";
import { VariantAnalysisManager } from "../../../../src/variant-analysis/variant-analysis-manager";
import { QueryHistoryInfo } from "../../../../src/query-history/query-history-info";
import {
  createMockLocalQueryInfo,
  createMockQueryWithResults,
} from "../../../factories/query-history/local-query-history-item";
import { shuffleHistoryItems } from "../../utils/query-history-helpers";
import { createMockVariantAnalysisHistoryItem } from "../../../factories/query-history/variant-analysis-history-item";
import { VariantAnalysisHistoryItem } from "../../../../src/query-history/variant-analysis-history-item";
import { QueryStatus } from "../../../../src/query-status";
import { VariantAnalysisStatus } from "../../../../src/variant-analysis/shared/variant-analysis";
import { QuickPickItem, TextEditor } from "vscode";
import { WebviewReveal } from "../../../../src/interface-utils";
import * as helpers from "../../../../src/helpers";

describe("QueryHistoryManager", () => {
  const mockExtensionLocation = join(tmpDir.name, "mock-extension-location");
  let configListener: QueryHistoryConfigListener;
  let showTextDocumentSpy: jest.SpiedFunction<
    typeof vscode.window.showTextDocument
  >;
  let showInformationMessageSpy: jest.SpiedFunction<
    typeof vscode.window.showInformationMessage
  >;
  let showQuickPickSpy: jest.SpiedFunction<typeof vscode.window.showQuickPick>;
  let executeCommandSpy: jest.SpiedFunction<
    typeof vscode.commands.executeCommand
  >;
  const doCompareCallback = jest.fn();

  let queryHistoryManager: QueryHistoryManager;

  let localQueriesResultsViewStub: ResultsView;
  let variantAnalysisManagerStub: VariantAnalysisManager;

  let tryOpenExternalFile: Function;

  let allHistory: QueryHistoryInfo[];
  let localQueryHistory: LocalQueryInfo[];
  let variantAnalysisHistory: VariantAnalysisHistoryItem[];

  beforeEach(() => {
    showTextDocumentSpy = jest
      .spyOn(vscode.window, "showTextDocument")
      .mockResolvedValue(undefined as unknown as TextEditor);
    showInformationMessageSpy = jest
      .spyOn(vscode.window, "showInformationMessage")
      .mockResolvedValue(undefined);
    showQuickPickSpy = jest
      .spyOn(vscode.window, "showQuickPick")
      .mockResolvedValue(undefined);
    executeCommandSpy = jest
      .spyOn(vscode.commands, "executeCommand")
      .mockResolvedValue(undefined);

    jest.spyOn(extLogger, "log").mockResolvedValue(undefined);

    tryOpenExternalFile = (QueryHistoryManager.prototype as any)
      .tryOpenExternalFile;
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
    allHistory = shuffleHistoryItems([
      ...localQueryHistory,
      ...variantAnalysisHistory,
    ]);
  });

  afterEach(async () => {
    if (queryHistoryManager) {
      queryHistoryManager.dispose();
    }
  });
  describe("tryOpenExternalFile", () => {
    it("should open an external file", async () => {
      await tryOpenExternalFile("xxx");
      expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
      expect(showTextDocumentSpy).toHaveBeenCalledWith(
        vscode.Uri.file("xxx"),
        expect.anything(),
      );
      expect(executeCommandSpy).not.toBeCalled();
    });

    [
      "too large to open",
      "Files above 50MB cannot be synchronized with extensions",
    ].forEach((msg) => {
      it(`should fail to open a file because "${msg}" and open externally`, async () => {
        showTextDocumentSpy.mockRejectedValue(new Error(msg));
        showInformationMessageSpy.mockResolvedValue({ title: "Yes" });

        await tryOpenExternalFile("xxx");
        const uri = vscode.Uri.file("xxx");
        expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
        expect(showTextDocumentSpy).toHaveBeenCalledWith(
          uri,
          expect.anything(),
        );
        expect(executeCommandSpy).toHaveBeenCalledWith("revealFileInOS", uri);
      });

      it(`should fail to open a file because "${msg}" and NOT open externally`, async () => {
        showTextDocumentSpy.mockRejectedValue(new Error(msg));
        showInformationMessageSpy.mockResolvedValue({ title: "No" });

        await tryOpenExternalFile("xxx");
        const uri = vscode.Uri.file("xxx");
        expect(showTextDocumentSpy).toHaveBeenCalledTimes(1);
        expect(showTextDocumentSpy).toHaveBeenCalledWith(
          uri,
          expect.anything(),
        );
        expect(showInformationMessageSpy).toBeCalled();
        expect(executeCommandSpy).not.toBeCalled();
      });
    });
  });

  describe("handleItemClicked", () => {
    describe("single click", () => {
      describe("local query", () => {
        describe("when complete", () => {
          it("should show results", async () => {
            queryHistoryManager = await createMockQueryHistory(allHistory);
            const itemClicked = localQueryHistory[0];
            await queryHistoryManager.handleItemClicked(itemClicked, [
              itemClicked,
            ]);

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
            await queryHistoryManager.handleItemClicked(itemClicked, [
              itemClicked,
            ]);

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
            await queryHistoryManager.handleItemClicked(itemClicked, [
              itemClicked,
            ]);

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
            await queryHistoryManager.handleItemClicked(itemClicked, [
              itemClicked,
            ]);

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

    describe("double click", () => {
      it("should do nothing", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);
        const itemClicked = allHistory[0];
        const secondItemClicked = allHistory[1];

        await queryHistoryManager.handleItemClicked(itemClicked, [
          itemClicked,
          secondItemClicked,
        ]);

        expect(localQueriesResultsViewStub.showResults).not.toHaveBeenCalled();
        expect(variantAnalysisManagerStub.showView).not.toBeCalled();
        expect(
          queryHistoryManager.treeDataProvider.getCurrent(),
        ).toBeUndefined();
      });
    });

    describe("no selection", () => {
      it("should do nothing", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        await queryHistoryManager.handleItemClicked(undefined!, []);

        expect(localQueriesResultsViewStub.showResults).not.toHaveBeenCalled();
        expect(variantAnalysisManagerStub.showView).not.toHaveBeenCalled();
        expect(
          queryHistoryManager.treeDataProvider.getCurrent(),
        ).toBeUndefined();
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
          await queryHistoryManager.handleRemoveHistoryItem(toDelete, [
            toDelete,
          ]);
        });

        it("should remove the item", () => {
          expect(toDelete.completedQuery!.dispose).toBeCalledTimes(1);
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
          await queryHistoryManager.handleRemoveHistoryItem(toDelete, [
            toDelete,
          ]);
        });

        it("should remove the item", () => {
          expect(toDelete.completedQuery!.dispose).toBeCalledTimes(1);
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
        typeof helpers.showBinaryChoiceDialog
      >;
      let showInformationMessageWithActionSpy: jest.SpiedFunction<
        typeof helpers.showInformationMessageWithAction
      >;

      beforeEach(() => {
        // Choose 'Yes' when asked "Are you sure?"
        showBinaryChoiceDialogSpy = jest
          .spyOn(helpers, "showBinaryChoiceDialog")
          .mockResolvedValue(true);

        showInformationMessageWithActionSpy = jest.spyOn(
          helpers,
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
            await queryHistoryManager.handleRemoveHistoryItem(toDelete, [
              toDelete,
            ]);

            expect(
              variantAnalysisManagerStub.removeVariantAnalysis,
            ).toHaveBeenCalledWith(toDelete.variantAnalysis);
            expect(
              queryHistoryManager.treeDataProvider.allHistory,
            ).not.toContain(toDelete);
          });

          it("should not change the selection", async () => {
            // remove an item
            await queryHistoryManager.handleRemoveHistoryItem(toDelete, [
              toDelete,
            ]);

            expect(queryHistoryManager.treeDataProvider.getCurrent()).toEqual(
              selected,
            );
            expect(variantAnalysisManagerStub.showView).toHaveBeenCalledWith(
              selected.variantAnalysis.id,
            );
          });

          it("should show a modal asking 'Are you sure?'", async () => {
            // remove an item
            await queryHistoryManager.handleRemoveHistoryItem(toDelete, [
              toDelete,
            ]);

            expect(showBinaryChoiceDialogSpy).toHaveBeenCalledWith(
              "You are about to delete this query: a-query-name (javascript). Are you sure?",
            );
          });

          it("should show a toast notification with a link to GitHub Actions", async () => {
            // remove an item
            await queryHistoryManager.handleRemoveHistoryItem(toDelete, [
              toDelete,
            ]);

            expect(showInformationMessageWithActionSpy).toHaveBeenCalled();
          });

          describe("when you choose 'No' in the 'Are you sure?' modal", () => {
            beforeEach(async () => {
              showBinaryChoiceDialogSpy.mockResolvedValue(false);
            });

            it("should not delete the item", async () => {
              // remove an item
              await queryHistoryManager.handleRemoveHistoryItem(toDelete, [
                toDelete,
              ]);

              expect(queryHistoryManager.treeDataProvider.allHistory).toContain(
                toDelete,
              );
            });

            it("should not show a toast notification", async () => {
              // remove an item
              await queryHistoryManager.handleRemoveHistoryItem(toDelete, [
                toDelete,
              ]);

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
            await queryHistoryManager.handleRemoveHistoryItem(toDelete, [
              toDelete,
            ]);
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
            await queryHistoryManager.handleRemoveHistoryItem(toDelete, [
              toDelete,
            ]);
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
            await queryHistoryManager.handleRemoveHistoryItem(toDelete, [
              toDelete,
            ]);
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

        await queryHistoryManager.handleCancel(inProgress1, [inProgress1]);
        expect(cancelSpy).toBeCalledTimes(1);
      });

      it("should cancel multiple local queries", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const inProgress1 = localQueryHistory[4];
        const inProgress2 = localQueryHistory[5];

        const cancelSpy1 = jest.spyOn(inProgress1, "cancel");
        const cancelSpy2 = jest.spyOn(inProgress2, "cancel");

        await queryHistoryManager.handleCancel(inProgress1, [
          inProgress1,
          inProgress2,
        ]);
        expect(cancelSpy1).toBeCalled();
        expect(cancelSpy2).toBeCalled();
      });

      it("should cancel a single variant analysis", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const inProgress1 = variantAnalysisHistory[1];

        await queryHistoryManager.handleCancel(inProgress1, [inProgress1]);
        expect(executeCommandSpy).toBeCalledWith(
          "codeQL.cancelVariantAnalysis",
          inProgress1.variantAnalysis.id,
        );
      });

      it("should cancel multiple variant analyses", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const inProgress1 = variantAnalysisHistory[1];
        const inProgress2 = variantAnalysisHistory[3];

        await queryHistoryManager.handleCancel(inProgress1, [
          inProgress1,
          inProgress2,
        ]);
        expect(executeCommandSpy).toBeCalledWith(
          "codeQL.cancelVariantAnalysis",
          inProgress1.variantAnalysis.id,
        );
        expect(executeCommandSpy).toBeCalledWith(
          "codeQL.cancelVariantAnalysis",
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

        await queryHistoryManager.handleCancel(completed, [completed]);
        expect(cancelSpy).not.toBeCalledTimes(1);
      });

      it("should not cancel multiple local queries", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const completed = localQueryHistory[0];
        const failed = localQueryHistory[2];

        const cancelSpy = jest.spyOn(completed, "cancel");
        const cancelSpy2 = jest.spyOn(failed, "cancel");

        await queryHistoryManager.handleCancel(completed, [completed, failed]);
        expect(cancelSpy).not.toBeCalledTimes(1);
        expect(cancelSpy2).not.toBeCalledTimes(1);
      });

      it("should not cancel a single variant analysis", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const completedVariantAnalysis = variantAnalysisHistory[0];

        await queryHistoryManager.handleCancel(completedVariantAnalysis, [
          completedVariantAnalysis,
        ]);
        expect(executeCommandSpy).not.toBeCalledWith(
          "codeQL.cancelVariantAnalysis",
          completedVariantAnalysis.variantAnalysis,
        );
      });

      it("should not cancel multiple variant analyses", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // cancelling the selected item
        const completedVariantAnalysis = variantAnalysisHistory[0];
        const failedVariantAnalysis = variantAnalysisHistory[2];

        await queryHistoryManager.handleCancel(completedVariantAnalysis, [
          completedVariantAnalysis,
          failedVariantAnalysis,
        ]);
        expect(executeCommandSpy).not.toBeCalledWith(
          "codeQL.cancelVariantAnalysis",
          completedVariantAnalysis.variantAnalysis.id,
        );
        expect(executeCommandSpy).not.toBeCalledWith(
          "codeQL.cancelVariantAnalysis",
          failedVariantAnalysis.variantAnalysis.id,
        );
      });
    });
  });

  describe("handleCopyRepoList", () => {
    it("should not call a command for a local query", async () => {
      queryHistoryManager = await createMockQueryHistory(localQueryHistory);

      const item = localQueryHistory[4];
      await queryHistoryManager.handleCopyRepoList(item, [item]);

      expect(executeCommandSpy).not.toBeCalled();
    });

    it("should copy repo list for a single variant analysis", async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);

      const item = variantAnalysisHistory[1];
      await queryHistoryManager.handleCopyRepoList(item, [item]);
      expect(executeCommandSpy).toBeCalledWith(
        "codeQL.copyVariantAnalysisRepoList",
        item.variantAnalysis.id,
      );
    });

    it("should not copy repo list for multiple variant analyses", async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);

      const item1 = variantAnalysisHistory[1];
      const item2 = variantAnalysisHistory[3];
      await queryHistoryManager.handleCopyRepoList(item1, [item1, item2]);
      expect(executeCommandSpy).not.toBeCalled();
    });
  });

  describe("handleExportResults", () => {
    it("should not call a command for a local query", async () => {
      queryHistoryManager = await createMockQueryHistory(localQueryHistory);

      const item = localQueryHistory[4];
      await queryHistoryManager.handleExportResults(item, [item]);

      expect(executeCommandSpy).not.toBeCalled();
    });

    it("should export results for a single variant analysis", async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);

      const item = variantAnalysisHistory[1];
      await queryHistoryManager.handleExportResults(item, [item]);
      expect(executeCommandSpy).toBeCalledWith(
        "codeQL.exportVariantAnalysisResults",
        item.variantAnalysis.id,
      );
    });

    it("should not export results for multiple variant analyses", async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);

      const item1 = variantAnalysisHistory[1];
      const item2 = variantAnalysisHistory[3];
      await queryHistoryManager.handleExportResults(item1, [item1, item2]);
      expect(executeCommandSpy).not.toBeCalled();
    });
  });

  describe("determineSelection", () => {
    const singleItem = "a";
    const multipleItems = ["b", "c", "d"];

    it("should get the selection from parameters", async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);
      const selection = (queryHistoryManager as any).determineSelection(
        singleItem,
        multipleItems,
      );
      expect(selection).toEqual({
        finalSingleItem: singleItem,
        finalMultiSelect: multipleItems,
      });
    });

    it("should get the selection when single selection is empty", async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);
      const selection = (queryHistoryManager as any).determineSelection(
        undefined,
        multipleItems,
      );
      expect(selection).toEqual({
        finalSingleItem: multipleItems[0],
        finalMultiSelect: multipleItems,
      });
    });

    it("should get the selection when multi-selection is empty", async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);
      const selection = (queryHistoryManager as any).determineSelection(
        singleItem,
        undefined,
      );
      expect(selection).toEqual({
        finalSingleItem: singleItem,
        finalMultiSelect: [singleItem],
      });
    });

    it("should get the selection from the treeView when both selections are empty", async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);
      const p = new Promise<void>((done) => {
        queryHistoryManager!.treeView.onDidChangeSelection((s) => {
          if (s.selection[0] !== allHistory[1]) {
            return;
          }
          const selection = (queryHistoryManager as any).determineSelection(
            undefined,
            undefined,
          );
          expect(selection).toEqual({
            finalSingleItem: allHistory[1],
            finalMultiSelect: [allHistory[1]],
          });
          done();
        });
      });

      // I can't explain why, but the first time the onDidChangeSelection event fires, the selection is
      // not correct (it is inexplicably allHistory[2]). So we fire the event a second time to get the
      // correct selection.
      await queryHistoryManager.treeView.reveal(allHistory[0], {
        select: true,
      });
      await queryHistoryManager.treeView.reveal(allHistory[1], {
        select: true,
      });
      await p;
    });

    it.skip("should get the selection from the treeDataProvider when both selections and the treeView are empty", async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);
      await queryHistoryManager.treeView.reveal(allHistory[1], {
        select: true,
      });
      const selection = (queryHistoryManager as any).determineSelection(
        undefined,
        undefined,
      );
      expect(selection).toEqual({
        finalSingleItem: allHistory[1],
        finalMultiSelect: [allHistory[1]],
      });
    });
  });

  describe("Local Queries", () => {
    describe("findOtherQueryToCompare", () => {
      it("should find the second query to compare when one is selected", async () => {
        const thisQuery = localQueryHistory[3];
        queryHistoryManager = await createMockQueryHistory(allHistory);
        showQuickPickSpy.mockResolvedValue({
          query: localQueryHistory[0],
        } as unknown as QuickPickItem);

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
        expect(showQuickPickSpy).not.toBeCalled();
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
          (queryHistoryManager as any).findOtherQueryToCompare(thisQuery, [
            thisQuery,
            allHistory[0],
          ]),
        ).rejects.toThrow("Please select a successful query.");
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
        expect(doCompareCallback).not.toBeCalled();
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
      {} as QueryRunner,
      {} as DatabaseManager,
      localQueriesResultsViewStub,
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
