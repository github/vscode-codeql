import { readdirSync, mkdirSync, writeFileSync } from "fs-extra";
import { join } from "path";
import * as vscode from "vscode";

import { extLogger } from "../../../../src/common";
import { registerQueryHistoryScrubber } from "../../../../src/query-history/query-history-scrubber";
import {
  HistoryTreeDataProvider,
  QueryHistoryManager,
  SortOrder,
} from "../../../../src/query-history/query-history";
import {
  QueryHistoryConfig,
  QueryHistoryConfigListener,
} from "../../../../src/config";
import { LocalQueryInfo } from "../../../../src/query-results";
import { DatabaseManager } from "../../../../src/databases";
import { dirSync } from "tmp-promise";
import {
  ONE_DAY_IN_MS,
  ONE_HOUR_IN_MS,
  THREE_HOURS_IN_MS,
  TWO_HOURS_IN_MS,
} from "../../../../src/pure/time";
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
import * as ghActionsApiClient from "../../../../src/remote-queries/gh-api/gh-actions-api-client";
import { Credentials } from "../../../../src/authentication";
import { QuickPickItem, TextEditor } from "vscode";
import { WebviewReveal } from "../../../../src/interface-utils";
import * as helpers from "../../../../src/helpers";

describe("query-history", () => {
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
  let remoteQueriesManagerStub: RemoteQueriesManager;
  let variantAnalysisManagerStub: VariantAnalysisManager;

  let tryOpenExternalFile: Function;

  let allHistory: QueryHistoryInfo[];
  let localQueryHistory: LocalQueryInfo[];
  let remoteQueryHistory: RemoteQueryHistoryItem[];
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
  });

  afterEach(async () => {
    if (queryHistoryManager) {
      queryHistoryManager.dispose();
    }
  });

  describe("QueryHistoryManager", () => {
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

        describe("remote query", () => {
          describe("when complete", () => {
            it("should show results", async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = remoteQueryHistory[0];
              await queryHistoryManager.handleItemClicked(itemClicked, [
                itemClicked,
              ]);

              expect(
                remoteQueriesManagerStub.openRemoteQueryResults,
              ).toHaveBeenCalledTimes(1);
              expect(
                remoteQueriesManagerStub.openRemoteQueryResults,
              ).toHaveBeenCalledWith(itemClicked.queryId);
              expect(queryHistoryManager.treeDataProvider.getCurrent()).toBe(
                itemClicked,
              );
            });
          });

          describe("when incomplete", () => {
            it("should do nothing", async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = remoteQueryHistory[2];
              await queryHistoryManager.handleItemClicked(itemClicked, [
                itemClicked,
              ]);

              expect(
                remoteQueriesManagerStub.openRemoteQueryResults,
              ).not.toBeCalledWith(itemClicked.queryId);
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

          expect(
            localQueriesResultsViewStub.showResults,
          ).not.toHaveBeenCalled();
          expect(
            remoteQueriesManagerStub.openRemoteQueryResults,
          ).not.toHaveBeenCalled();
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

          expect(
            localQueriesResultsViewStub.showResults,
          ).not.toHaveBeenCalled();
          expect(
            remoteQueriesManagerStub.openRemoteQueryResults,
          ).not.toHaveBeenCalled();
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

            queryHistoryManager = await createMockQueryHistory(
              localQueryHistory,
            );
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

            expect(
              localQueriesResultsViewStub.showResults,
            ).toHaveBeenCalledTimes(1);
            expect(
              localQueriesResultsViewStub.showResults,
            ).toHaveBeenCalledWith(selected, WebviewReveal.Forced, false);
          });
        });

        describe("when the item being removed is selected", () => {
          // deleting the selected item automatically selects next item
          let toDelete: LocalQueryInfo;
          let newSelected: LocalQueryInfo;

          beforeEach(async () => {
            toDelete = localQueryHistory[1];
            newSelected = localQueryHistory[2];

            queryHistoryManager = await createMockQueryHistory(
              localQueryHistory,
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
            expect(toDelete.completedQuery!.dispose).toBeCalledTimes(1);
            expect(queryHistoryManager.treeDataProvider.allHistory).toEqual(
              expect.not.arrayContaining([toDelete]),
            );
          });

          it("should change the selection", () => {
            expect(queryHistoryManager.treeDataProvider.getCurrent()).toBe(
              newSelected,
            );

            expect(
              localQueriesResultsViewStub.showResults,
            ).toHaveBeenCalledTimes(1);
            expect(
              localQueriesResultsViewStub.showResults,
            ).toHaveBeenCalledWith(newSelected, WebviewReveal.Forced, false);
          });
        });
      });

      describe("when the item is a remote query", () => {
        describe("when the item being removed is not selected", () => {
          let toDelete: RemoteQueryHistoryItem;
          let selected: RemoteQueryHistoryItem;

          beforeEach(async () => {
            // deleting the first item when a different item is selected
            // will not change the selection
            toDelete = remoteQueryHistory[1];
            selected = remoteQueryHistory[3];

            queryHistoryManager = await createMockQueryHistory(allHistory);

            // initialize the selection
            await queryHistoryManager.treeView.reveal(remoteQueryHistory[0], {
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
            expect(
              remoteQueriesManagerStub.removeRemoteQuery,
            ).toHaveBeenCalledWith(toDelete.queryId);
            expect(
              queryHistoryManager.treeDataProvider.allHistory,
            ).not.toContain(toDelete);
          });

          it("should not change the selection", () => {
            expect(queryHistoryManager.treeDataProvider.getCurrent()).toEqual(
              selected,
            );

            expect(
              remoteQueriesManagerStub.openRemoteQueryResults,
            ).toHaveBeenCalledWith(selected.queryId);
          });
        });

        describe("when the item being removed is selected", () => {
          let toDelete: RemoteQueryHistoryItem;
          let newSelected: RemoteQueryHistoryItem;

          beforeEach(async () => {
            // deleting the selected item automatically selects next item
            toDelete = remoteQueryHistory[1];
            newSelected = remoteQueryHistory[2];

            queryHistoryManager = await createMockQueryHistory(
              remoteQueryHistory,
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
              remoteQueriesManagerStub.removeRemoteQuery,
            ).toHaveBeenCalledWith(toDelete.queryId);
            expect(
              queryHistoryManager.treeDataProvider.allHistory,
            ).not.toContain(toDelete);
          });

          it("should change the selection", () => {
            expect(queryHistoryManager.treeDataProvider.getCurrent()).toEqual(
              newSelected,
            );
            expect(
              remoteQueriesManagerStub.openRemoteQueryResults,
            ).toHaveBeenCalledWith(newSelected.queryId);
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
                "You are about to delete this query: query-name. Are you sure?",
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

                expect(
                  queryHistoryManager.treeDataProvider.allHistory,
                ).toContain(toDelete);
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
                "You are about to delete this query: query-name. Are you sure?",
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
      let mockCredentials: Credentials;
      let mockCancelRemoteQuery: jest.SpiedFunction<
        typeof ghActionsApiClient.cancelRemoteQuery
      >;
      const getOctokitStub = jest.fn();

      beforeEach(async () => {
        mockCredentials = {
          getOctokit: () =>
            Promise.resolve({
              request: getOctokitStub,
            }),
        } as unknown as Credentials;
        jest
          .spyOn(Credentials, "initialize")
          .mockResolvedValue(mockCredentials);

        mockCancelRemoteQuery = jest
          .spyOn(ghActionsApiClient, "cancelRemoteQuery")
          .mockResolvedValue();
      });

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

        it("should cancel a single remote query", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

          // cancelling the selected item
          const inProgress1 = remoteQueryHistory[2];

          await queryHistoryManager.handleCancel(inProgress1, [inProgress1]);
          expect(mockCancelRemoteQuery).toBeCalledWith(
            mockCredentials,
            inProgress1.remoteQuery,
          );
        });

        it("should cancel multiple remote queries", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

          // cancelling the selected item
          const inProgress1 = remoteQueryHistory[2];
          const inProgress2 = remoteQueryHistory[3];

          await queryHistoryManager.handleCancel(inProgress1, [
            inProgress1,
            inProgress2,
          ]);
          expect(mockCancelRemoteQuery).toBeCalledWith(
            mockCredentials,
            inProgress1.remoteQuery,
          );
          expect(mockCancelRemoteQuery).toBeCalledWith(
            mockCredentials,
            inProgress2.remoteQuery,
          );
        });

        it("should cancel a single variant analysis", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

          // cancelling the selected item
          const inProgress1 = variantAnalysisHistory[1];

          await queryHistoryManager.handleCancel(inProgress1, [inProgress1]);
          expect(executeCommandSpy).toBeCalledWith(
            "codeQL.cancelVariantAnalysis",
            inProgress1.variantAnalysis.id,
          );
        });

        it("should cancel multiple variant analyses", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

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

          await queryHistoryManager.handleCancel(completed, [
            completed,
            failed,
          ]);
          expect(cancelSpy).not.toBeCalledTimes(1);
          expect(cancelSpy2).not.toBeCalledTimes(1);
        });

        it("should not cancel a single remote query", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

          // cancelling the selected item
          const completed = remoteQueryHistory[0];

          await queryHistoryManager.handleCancel(completed, [completed]);
          expect(mockCancelRemoteQuery).not.toBeCalledWith(
            mockCredentials,
            completed.remoteQuery,
          );
        });

        it("should not cancel multiple remote queries", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

          // cancelling the selected item
          const completed = remoteQueryHistory[0];
          const failed = remoteQueryHistory[1];

          await queryHistoryManager.handleCancel(completed, [
            completed,
            failed,
          ]);
          expect(mockCancelRemoteQuery).not.toBeCalledWith(
            mockCredentials,
            completed.remoteQuery,
          );
          expect(mockCancelRemoteQuery).not.toBeCalledWith(
            mockCredentials,
            failed.remoteQuery,
          );
        });

        it("should not cancel a single variant analysis", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

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
          queryHistoryManager = await createMockQueryHistory(allHistory);

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

      it("should copy repo list for a single remote query", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const item = remoteQueryHistory[1];
        await queryHistoryManager.handleCopyRepoList(item, [item]);
        expect(executeCommandSpy).toBeCalledWith(
          "codeQL.copyRepoList",
          item.queryId,
        );
      });

      it("should not copy repo list for multiple remote queries", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const item1 = remoteQueryHistory[1];
        const item2 = remoteQueryHistory[3];
        await queryHistoryManager.handleCopyRepoList(item1, [item1, item2]);
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

      it("should export results for a single remote query", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const item = remoteQueryHistory[1];
        await queryHistoryManager.handleExportResults(item, [item]);
        expect(executeCommandSpy).toBeCalledWith(
          "codeQL.exportRemoteQueryResults",
          item.queryId,
        );
      });

      it("should not export results for multiple remote queries", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const item1 = remoteQueryHistory[1];
        const item2 = remoteQueryHistory[3];
        await queryHistoryManager.handleExportResults(item1, [item1, item2]);
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

      it("should get the selection from the treeDataProvider when both selections and the treeView are empty", async () => {
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
          ).findOtherQueryToCompare(thisQuery, [
            thisQuery,
            localQueryHistory[0],
          ]);
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
          expect(queryHistoryManager.compareWithItem).toBe(
            localQueryHistory[0],
          );
        });
      });
    });

    describe("query history scrubber", () => {
      const now = Date.now();

      let deregister: vscode.Disposable | undefined;
      let mockCtx: vscode.ExtensionContext;
      let runCount = 0;

      // We don't want our times to align exactly with the hour,
      // so we can better mimic real life
      const LESS_THAN_ONE_DAY = ONE_DAY_IN_MS - 1000;
      const tmpDir = dirSync({
        unsafeCleanup: true,
      });

      beforeEach(() => {
        jest.useFakeTimers({
          doNotFake: ["setTimeout"],
          now,
        });

        mockCtx = {
          globalState: {
            lastScrubTime: now,
            get(key: string) {
              if (key !== "lastScrubTime") {
                throw new Error(`Unexpected key: ${key}`);
              }
              return this.lastScrubTime;
            },
            async update(key: string, value: any) {
              if (key !== "lastScrubTime") {
                throw new Error(`Unexpected key: ${key}`);
              }
              this.lastScrubTime = value;
            },
          },
        } as any as vscode.ExtensionContext;
      });

      afterEach(() => {
        if (deregister) {
          deregister.dispose();
          deregister = undefined;
        }
      });

      it("should not throw an error when the query directory does not exist", async () => {
        registerScrubber("idontexist");

        jest.advanceTimersByTime(ONE_HOUR_IN_MS);
        await wait();
        // "Should not have called the scrubber"
        expect(runCount).toBe(0);

        jest.advanceTimersByTime(ONE_HOUR_IN_MS - 1);
        await wait();
        // "Should not have called the scrubber"
        expect(runCount).toBe(0);

        jest.advanceTimersByTime(1);
        await wait();
        // "Should have called the scrubber once"
        expect(runCount).toBe(1);

        jest.advanceTimersByTime(TWO_HOURS_IN_MS);
        await wait();
        // "Should have called the scrubber a second time"
        expect(runCount).toBe(2);

        expect((mockCtx.globalState as any).lastScrubTime).toBe(
          now + TWO_HOURS_IN_MS * 2,
        );
      });

      it("should scrub directories", async () => {
        // create two query directories that are right around the cut off time
        const queryDir = createMockQueryDir(
          ONE_HOUR_IN_MS,
          TWO_HOURS_IN_MS,
          THREE_HOURS_IN_MS,
        );
        registerScrubber(queryDir);

        jest.advanceTimersByTime(TWO_HOURS_IN_MS);
        await wait();

        // should have deleted only the invalid locations
        expectDirectories(
          queryDir,
          toQueryDirName(ONE_HOUR_IN_MS),
          toQueryDirName(TWO_HOURS_IN_MS),
          toQueryDirName(THREE_HOURS_IN_MS),
        );

        jest.advanceTimersByTime(LESS_THAN_ONE_DAY);
        await wait();

        // nothing should have happened...yet
        expectDirectories(
          queryDir,
          toQueryDirName(ONE_HOUR_IN_MS),
          toQueryDirName(TWO_HOURS_IN_MS),
          toQueryDirName(THREE_HOURS_IN_MS),
        );

        jest.advanceTimersByTime(1000);
        await wait();

        // should have deleted the two older directories
        // even though they have different time stamps,
        // they both expire during the same scrubbing period
        expectDirectories(queryDir, toQueryDirName(THREE_HOURS_IN_MS));

        // Wait until the next scrub time and the final directory is deleted
        jest.advanceTimersByTime(TWO_HOURS_IN_MS);
        await wait();

        // should have deleted everything
        expectDirectories(queryDir);
      });

      function expectDirectories(queryDir: string, ...dirNames: string[]) {
        const files = readdirSync(queryDir);
        expect(files.sort()).toEqual(dirNames.sort());
      }

      function createMockQueryDir(...timestamps: number[]) {
        const dir = tmpDir.name;
        const queryDir = join(dir, "query");
        // create qyuery directory and fill it with some query directories
        mkdirSync(queryDir);

        // create an invalid file
        const invalidFile = join(queryDir, "invalid.txt");
        writeFileSync(invalidFile, "invalid");

        // create a directory without a timestamp file
        const noTimestampDir = join(queryDir, "noTimestampDir");
        mkdirSync(noTimestampDir);
        writeFileSync(join(noTimestampDir, "invalid.txt"), "invalid");

        // create a directory with a timestamp file, but is invalid
        const invalidTimestampDir = join(queryDir, "invalidTimestampDir");
        mkdirSync(invalidTimestampDir);
        writeFileSync(join(invalidTimestampDir, "timestamp"), "invalid");

        // create a directories with a valid timestamp files from the args
        timestamps.forEach((timestamp) => {
          const dir = join(queryDir, toQueryDirName(timestamp));
          mkdirSync(dir);
          writeFileSync(join(dir, "timestamp"), `${now + timestamp}`);
        });

        return queryDir;
      }

      function toQueryDirName(timestamp: number) {
        return `query-${timestamp}`;
      }

      function registerScrubber(dir: string) {
        deregister = registerQueryHistoryScrubber(
          ONE_HOUR_IN_MS,
          TWO_HOURS_IN_MS,
          LESS_THAN_ONE_DAY,
          dir,
          {
            removeDeletedQueries: () => {
              return Promise.resolve();
            },
          } as QueryHistoryManager,
          mockCtx,
          {
            increment: () => runCount++,
          },
        );
      }

      async function wait(ms = 500) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
    });
  });

  describe("HistoryTreeDataProvider", () => {
    let historyTreeDataProvider: HistoryTreeDataProvider;
    let labelProvider: HistoryItemLabelProvider;
    beforeEach(() => {
      labelProvider = new HistoryItemLabelProvider({
        /**/
      } as QueryHistoryConfig);
      historyTreeDataProvider = new HistoryTreeDataProvider(
        vscode.Uri.file(mockExtensionLocation).fsPath,
        labelProvider,
      );
    });

    afterEach(() => {
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
        expect(treeItem.iconPath).toEqual(
          vscode.Uri.file(`${mockExtensionLocation}/media/drive.svg`).fsPath,
        );
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
        expect(treeItem.iconPath).toEqual(
          vscode.Uri.file(`${mockExtensionLocation}/media/drive.svg`).fsPath,
        );
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
        expect(treeItem.iconPath).toEqual(new vscode.ThemeIcon("error"));
      });

      it("should get a tree item that failed before creating any results", async () => {
        const mockQuery = createMockLocalQueryInfo({
          dbName: "a",
          failureReason: "failure reason",
        });

        const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
        expect(treeItem.iconPath).toEqual(new vscode.ThemeIcon("error"));
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
  });

  async function createMockQueryHistory(allHistory: QueryHistoryInfo[]) {
    const qhm = new QueryHistoryManager(
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
