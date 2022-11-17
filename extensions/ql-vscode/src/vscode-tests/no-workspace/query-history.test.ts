import * as fs from "fs-extra";
import * as path from "path";
import { assert, expect } from "chai";
import * as vscode from "vscode";
import * as sinon from "sinon";

import { logger } from "../../logging";
import { registerQueryHistoryScrubber } from "../../query-history-scrubber";
import {
  HistoryTreeDataProvider,
  QueryHistoryManager,
  SortOrder,
} from "../../query-history";
import { QueryHistoryConfig, QueryHistoryConfigListener } from "../../config";
import { LocalQueryInfo } from "../../query-results";
import { DatabaseManager } from "../../databases";
import * as tmp from "tmp-promise";
import {
  ONE_DAY_IN_MS,
  ONE_HOUR_IN_MS,
  THREE_HOURS_IN_MS,
  TWO_HOURS_IN_MS,
} from "../../pure/time";
import { tmpDir } from "../../helpers";
import { getErrorMessage } from "../../pure/helpers-pure";
import { HistoryItemLabelProvider } from "../../history-item-label-provider";
import { RemoteQueriesManager } from "../../remote-queries/remote-queries-manager";
import { ResultsView } from "../../interface";
import { EvalLogViewer } from "../../eval-log-viewer";
import { QueryRunner } from "../../queryRunner";
import { VariantAnalysisManager } from "../../remote-queries/variant-analysis-manager";
import { QueryHistoryInfo } from "../../query-history-info";
import {
  createMockLocalQueryInfo,
  createMockQueryWithResults,
} from "../factories/local-queries/local-query-history-item";
import { createMockRemoteQueryHistoryItem } from "../factories/remote-queries/remote-query-history-item";
import { RemoteQueryHistoryItem } from "../../remote-queries/remote-query-history-item";
import { shuffleHistoryItems } from "../utils/query-history-helpers";
import { createMockVariantAnalysisHistoryItem } from "../factories/remote-queries/variant-analysis-history-item";
import { VariantAnalysisHistoryItem } from "../../remote-queries/variant-analysis-history-item";
import { QueryStatus } from "../../query-status";
import { VariantAnalysisStatus } from "../../remote-queries/shared/variant-analysis";
import * as ghActionsApiClient from "../../remote-queries/gh-api/gh-actions-api-client";
import { Credentials } from "../../authentication";

describe("query-history", () => {
  const mockExtensionLocation = path.join(
    tmpDir.name,
    "mock-extension-location",
  );
  let configListener: QueryHistoryConfigListener;
  let showTextDocumentSpy: sinon.SinonStub;
  let showInformationMessageSpy: sinon.SinonStub;
  let executeCommandSpy: sinon.SinonStub;
  let showQuickPickSpy: sinon.SinonStub;
  let queryHistoryManager: QueryHistoryManager | undefined;
  let doCompareCallback: sinon.SinonStub;

  let localQueriesResultsViewStub: ResultsView;
  let remoteQueriesManagerStub: RemoteQueriesManager;
  let variantAnalysisManagerStub: VariantAnalysisManager;

  let tryOpenExternalFile: Function;
  let sandbox: sinon.SinonSandbox;

  let allHistory: QueryHistoryInfo[];
  let localQueryHistory: LocalQueryInfo[];
  let remoteQueryHistory: RemoteQueryHistoryItem[];
  let variantAnalysisHistory: VariantAnalysisHistoryItem[];

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    showTextDocumentSpy = sandbox.stub(vscode.window, "showTextDocument");
    showInformationMessageSpy = sandbox.stub(
      vscode.window,
      "showInformationMessage",
    );
    showQuickPickSpy = sandbox.stub(vscode.window, "showQuickPick");
    executeCommandSpy = sandbox.stub(vscode.commands, "executeCommand");
    sandbox.stub(logger, "log");
    tryOpenExternalFile = (QueryHistoryManager.prototype as any)
      .tryOpenExternalFile;
    configListener = new QueryHistoryConfigListener();
    doCompareCallback = sandbox.stub();
    localQueriesResultsViewStub = {
      showResults: sandbox.stub(),
    } as any as ResultsView;
    remoteQueriesManagerStub = {
      onRemoteQueryAdded: sandbox.stub(),
      onRemoteQueryRemoved: sandbox.stub(),
      onRemoteQueryStatusUpdate: sandbox.stub(),
      removeRemoteQuery: sandbox.stub(),
      openRemoteQueryResults: sandbox.stub(),
    } as any as RemoteQueriesManager;

    variantAnalysisManagerStub = {
      onVariantAnalysisAdded: sandbox.stub(),
      onVariantAnalysisStatusUpdated: sandbox.stub(),
      onVariantAnalysisRemoved: sandbox.stub(),
      removeVariantAnalysis: sandbox.stub(),
      showView: sandbox.stub(),
    } as any as VariantAnalysisManager;

    localQueryHistory = [
      // completed
      createMockLocalQueryInfo({
        dbName: "a",
        queryWithResults: createMockQueryWithResults({
          sandbox,
          didRunSuccessfully: true,
        }),
      }),
      // completed
      createMockLocalQueryInfo({
        dbName: "b",
        queryWithResults: createMockQueryWithResults({
          sandbox,
          didRunSuccessfully: true,
        }),
      }),
      // failed
      createMockLocalQueryInfo({
        dbName: "a",
        queryWithResults: createMockQueryWithResults({
          sandbox,
          didRunSuccessfully: false,
        }),
      }),
      // completed
      createMockLocalQueryInfo({
        dbName: "a",
        queryWithResults: createMockQueryWithResults({
          sandbox,
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
      queryHistoryManager = undefined;
    }
    sandbox.restore();
  });

  describe("QueryHistoryManager", () => {
    describe("tryOpenExternalFile", () => {
      it("should open an external file", async () => {
        await tryOpenExternalFile("xxx");
        expect(showTextDocumentSpy).to.have.been.calledOnceWith(
          vscode.Uri.file("xxx"),
        );
        expect(executeCommandSpy).not.to.have.been.called;
      });

      [
        "too large to open",
        "Files above 50MB cannot be synchronized with extensions",
      ].forEach((msg) => {
        it(`should fail to open a file because "${msg}" and open externally`, async () => {
          showTextDocumentSpy.throws(new Error(msg));
          showInformationMessageSpy.returns({ title: "Yes" });

          await tryOpenExternalFile("xxx");
          const uri = vscode.Uri.file("xxx");
          expect(showTextDocumentSpy).to.have.been.calledOnceWith(uri);
          expect(executeCommandSpy).to.have.been.calledOnceWith(
            "revealFileInOS",
            uri,
          );
        });

        it(`should fail to open a file because "${msg}" and NOT open externally`, async () => {
          showTextDocumentSpy.throws(new Error(msg));
          showInformationMessageSpy.returns({ title: "No" });

          await tryOpenExternalFile("xxx");
          const uri = vscode.Uri.file("xxx");
          expect(showTextDocumentSpy).to.have.been.calledOnceWith(uri);
          expect(showInformationMessageSpy).to.have.been.called;
          expect(executeCommandSpy).not.to.have.been.called;
        });
      });
    });

    describe("handleItemClicked", async () => {
      describe("single click", async () => {
        describe("local query", async () => {
          describe("when complete", async () => {
            it("should show results", async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = localQueryHistory[0];
              await queryHistoryManager.handleItemClicked(itemClicked, [
                itemClicked,
              ]);

              expect(
                localQueriesResultsViewStub.showResults,
              ).to.have.been.calledOnceWith(itemClicked);
              expect(queryHistoryManager.treeDataProvider.getCurrent()).to.eq(
                itemClicked,
              );
            });
          });

          describe("when incomplete", async () => {
            it("should do nothing", async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = localQueryHistory[2];
              await queryHistoryManager.handleItemClicked(itemClicked, [
                itemClicked,
              ]);

              expect(
                localQueriesResultsViewStub.showResults,
              ).not.to.have.been.calledWith(itemClicked);
            });
          });
        });

        describe("remote query", async () => {
          describe("when complete", async () => {
            it("should show results", async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = remoteQueryHistory[0];
              await queryHistoryManager.handleItemClicked(itemClicked, [
                itemClicked,
              ]);

              expect(
                remoteQueriesManagerStub.openRemoteQueryResults,
              ).to.have.been.calledOnceWith(itemClicked.queryId);
              expect(queryHistoryManager.treeDataProvider.getCurrent()).to.eq(
                itemClicked,
              );
            });
          });

          describe("when incomplete", async () => {
            it("should do nothing", async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = remoteQueryHistory[2];
              await queryHistoryManager.handleItemClicked(itemClicked, [
                itemClicked,
              ]);

              expect(
                remoteQueriesManagerStub.openRemoteQueryResults,
              ).not.to.have.been.calledWith(itemClicked.queryId);
            });
          });
        });

        describe("variant analysis", async () => {
          describe("when complete", async () => {
            it("should show results", async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = variantAnalysisHistory[0];
              await queryHistoryManager.handleItemClicked(itemClicked, [
                itemClicked,
              ]);

              expect(
                variantAnalysisManagerStub.showView,
              ).to.have.been.calledOnceWith(itemClicked.variantAnalysis.id);
              expect(queryHistoryManager.treeDataProvider.getCurrent()).to.eq(
                itemClicked,
              );
            });
          });

          describe("when incomplete", async () => {
            it("should show results", async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = variantAnalysisHistory[1];
              await queryHistoryManager.handleItemClicked(itemClicked, [
                itemClicked,
              ]);

              expect(
                variantAnalysisManagerStub.showView,
              ).to.have.been.calledOnceWith(itemClicked.variantAnalysis.id);
              expect(queryHistoryManager.treeDataProvider.getCurrent()).to.eq(
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

          expect(localQueriesResultsViewStub.showResults).not.to.have.been
            .called;
          expect(remoteQueriesManagerStub.openRemoteQueryResults).not.to.have
            .been.called;
          expect(variantAnalysisManagerStub.showView).not.to.have.been.called;
          expect(queryHistoryManager.treeDataProvider.getCurrent()).to.be
            .undefined;
        });
      });

      describe("no selection", () => {
        it("should do nothing", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

          await queryHistoryManager.handleItemClicked(undefined!, []);

          expect(localQueriesResultsViewStub.showResults).not.to.have.been
            .called;
          expect(remoteQueriesManagerStub.openRemoteQueryResults).not.to.have
            .been.called;
          expect(variantAnalysisManagerStub.showView).not.to.have.been.called;
          expect(queryHistoryManager.treeDataProvider.getCurrent()).to.be
            .undefined;
        });
      });
    });

    describe("handleRemoveHistoryItem", () => {
      it("should remove an item and not select a new one", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);
        // initialize the selection
        await queryHistoryManager.treeView.reveal(localQueryHistory[0], {
          select: true,
        });

        // deleting the first item when a different item is selected
        // will not change the selection
        const toDelete = localQueryHistory[1];
        const selected = localQueryHistory[3];

        // select the item we want
        await queryHistoryManager.treeView.reveal(selected, { select: true });

        // should be selected
        expect(queryHistoryManager.treeDataProvider.getCurrent()).to.deep.eq(
          selected,
        );

        // remove an item
        await queryHistoryManager.handleRemoveHistoryItem(toDelete, [toDelete]);

        expect(toDelete.completedQuery!.dispose).to.have.been.calledOnce;
        expect(queryHistoryManager.treeDataProvider.getCurrent()).to.deep.eq(
          selected,
        );
        expect(queryHistoryManager.treeDataProvider.allHistory).not.to.contain(
          toDelete,
        );

        // the same item should be selected
        expect(
          localQueriesResultsViewStub.showResults,
        ).to.have.been.calledOnceWith(selected);
      });

      it("should remove an item and select a new one", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        // deleting the selected item automatically selects next item
        const toDelete = localQueryHistory[1];
        const newSelected = localQueryHistory[2];
        // avoid triggering the callback by setting the field directly

        // select the item we want
        await queryHistoryManager.treeView.reveal(toDelete, { select: true });
        await queryHistoryManager.handleRemoveHistoryItem(toDelete, [toDelete]);

        expect(toDelete.completedQuery!.dispose).to.have.been.calledOnce;
        expect(queryHistoryManager.treeDataProvider.getCurrent()).to.eq(
          newSelected,
        );
        expect(queryHistoryManager.treeDataProvider.allHistory).not.to.contain(
          toDelete,
        );

        // the current item should have been selected
        expect(
          localQueriesResultsViewStub.showResults,
        ).to.have.been.calledOnceWith(newSelected);
      });
    });

    describe("handleCancel", () => {
      let mockCredentials: Credentials;
      let mockCancelRemoteQuery: sinon.SinonStub;
      let getOctokitStub: sinon.SinonStub;

      beforeEach(async () => {
        mockCredentials = {
          getOctokit: () =>
            Promise.resolve({
              request: getOctokitStub,
            }),
        } as unknown as Credentials;
        sandbox.stub(Credentials, "initialize").resolves(mockCredentials);
        mockCancelRemoteQuery = sandbox.stub(
          ghActionsApiClient,
          "cancelRemoteQuery",
        );
      });

      describe("if the item is in progress", async () => {
        it("should cancel a single local query", async () => {
          queryHistoryManager = await createMockQueryHistory(localQueryHistory);

          // cancelling the selected item
          const inProgress1 = localQueryHistory[4];
          const cancelSpy = sandbox.spy(inProgress1, "cancel");

          await queryHistoryManager.handleCancel(inProgress1, [inProgress1]);
          expect(cancelSpy).to.have.been.calledOnce;
        });

        it("should cancel multiple local queries", async () => {
          queryHistoryManager = await createMockQueryHistory(localQueryHistory);

          // cancelling the selected item
          const inProgress1 = localQueryHistory[4];
          const inProgress2 = localQueryHistory[5];

          const cancelSpy1 = sandbox.spy(inProgress1, "cancel");
          const cancelSpy2 = sandbox.spy(inProgress2, "cancel");

          await queryHistoryManager.handleCancel(inProgress1, [
            inProgress1,
            inProgress2,
          ]);
          expect(cancelSpy1).to.have.been.called;
          expect(cancelSpy2).to.have.been.called;
        });

        it("should cancel a single remote query", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

          // cancelling the selected item
          const inProgress1 = remoteQueryHistory[2];

          await queryHistoryManager.handleCancel(inProgress1, [inProgress1]);
          expect(mockCancelRemoteQuery).to.have.been.calledWith(
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
          expect(mockCancelRemoteQuery).to.have.been.calledWith(
            mockCredentials,
            inProgress1.remoteQuery,
          );
          expect(mockCancelRemoteQuery).to.have.been.calledWith(
            mockCredentials,
            inProgress2.remoteQuery,
          );
        });

        it("should cancel a single variant analysis", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

          // cancelling the selected item
          const inProgress1 = variantAnalysisHistory[1];

          await queryHistoryManager.handleCancel(inProgress1, [inProgress1]);
          expect(executeCommandSpy).to.have.been.calledWith(
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
          expect(executeCommandSpy).to.have.been.calledWith(
            "codeQL.cancelVariantAnalysis",
            inProgress1.variantAnalysis.id,
          );
          expect(executeCommandSpy).to.have.been.calledWith(
            "codeQL.cancelVariantAnalysis",
            inProgress2.variantAnalysis.id,
          );
        });
      });

      describe("if the item is not in progress", async () => {
        it("should not cancel a single local query", async () => {
          queryHistoryManager = await createMockQueryHistory(localQueryHistory);

          // cancelling the selected item
          const completed = localQueryHistory[0];
          const cancelSpy = sandbox.spy(completed, "cancel");

          await queryHistoryManager.handleCancel(completed, [completed]);
          expect(cancelSpy).to.not.have.been.calledOnce;
        });

        it("should not cancel multiple local queries", async () => {
          queryHistoryManager = await createMockQueryHistory(localQueryHistory);

          // cancelling the selected item
          const completed = localQueryHistory[0];
          const failed = localQueryHistory[2];

          const cancelSpy = sandbox.spy(completed, "cancel");
          const cancelSpy2 = sandbox.spy(failed, "cancel");

          await queryHistoryManager.handleCancel(completed, [
            completed,
            failed,
          ]);
          expect(cancelSpy).to.not.have.been.calledOnce;
          expect(cancelSpy2).to.not.have.been.calledOnce;
        });

        it("should not cancel a single remote query", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

          // cancelling the selected item
          const completed = remoteQueryHistory[0];

          await queryHistoryManager.handleCancel(completed, [completed]);
          expect(mockCancelRemoteQuery).to.not.have.been.calledWith(
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
          expect(mockCancelRemoteQuery).to.not.have.been.calledWith(
            mockCredentials,
            completed.remoteQuery,
          );
          expect(mockCancelRemoteQuery).to.not.have.been.calledWith(
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
          expect(executeCommandSpy).to.not.have.been.calledWith(
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
          expect(executeCommandSpy).to.not.have.been.calledWith(
            "codeQL.cancelVariantAnalysis",
            completedVariantAnalysis.variantAnalysis.id,
          );
          expect(executeCommandSpy).to.not.have.been.calledWith(
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

        expect(executeCommandSpy).to.not.have.been.called;
      });

      it("should copy repo list for a single remote query", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const item = remoteQueryHistory[1];
        await queryHistoryManager.handleCopyRepoList(item, [item]);
        expect(executeCommandSpy).to.have.been.calledWith(
          "codeQL.copyRepoList",
          item.queryId,
        );
      });

      it("should not copy repo list for multiple remote queries", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const item1 = remoteQueryHistory[1];
        const item2 = remoteQueryHistory[3];
        await queryHistoryManager.handleCopyRepoList(item1, [item1, item2]);
        expect(executeCommandSpy).not.to.have.been.called;
      });

      it("should copy repo list for a single variant analysis", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const item = variantAnalysisHistory[1];
        await queryHistoryManager.handleCopyRepoList(item, [item]);
        expect(executeCommandSpy).to.have.been.calledWith(
          "codeQL.copyVariantAnalysisRepoList",
          item.variantAnalysis.id,
        );
      });

      it("should not copy repo list for multiple variant analyses", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const item1 = variantAnalysisHistory[1];
        const item2 = variantAnalysisHistory[3];
        await queryHistoryManager.handleCopyRepoList(item1, [item1, item2]);
        expect(executeCommandSpy).not.to.have.been.called;
      });
    });

    describe("handleExportResults", () => {
      it("should not call a command for a local query", async () => {
        queryHistoryManager = await createMockQueryHistory(localQueryHistory);

        const item = localQueryHistory[4];
        await queryHistoryManager.handleExportResults(item, [item]);

        expect(executeCommandSpy).to.not.have.been.called;
      });

      it("should export results for a single remote query", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const item = remoteQueryHistory[1];
        await queryHistoryManager.handleExportResults(item, [item]);
        expect(executeCommandSpy).to.have.been.calledWith(
          "codeQL.exportRemoteQueryResults",
          item.queryId,
        );
      });

      it("should not export results for multiple remote queries", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const item1 = remoteQueryHistory[1];
        const item2 = remoteQueryHistory[3];
        await queryHistoryManager.handleExportResults(item1, [item1, item2]);
        expect(executeCommandSpy).not.to.have.been.called;
      });

      it("should export results for a single variant analysis", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const item = variantAnalysisHistory[1];
        await queryHistoryManager.handleExportResults(item, [item]);
        expect(executeCommandSpy).to.have.been.calledWith(
          "codeQL.exportVariantAnalysisResults",
          item.variantAnalysis.id,
        );
      });

      it("should not export results for multiple variant analyses", async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        const item1 = variantAnalysisHistory[1];
        const item2 = variantAnalysisHistory[3];
        await queryHistoryManager.handleExportResults(item1, [item1, item2]);
        expect(executeCommandSpy).not.to.have.been.called;
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
        expect(selection).to.deep.eq({
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
        expect(selection).to.deep.eq({
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
        expect(selection).to.deep.eq({
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
            expect(selection).to.deep.eq({
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
        expect(selection).to.deep.eq({
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
          showQuickPickSpy.returns({ query: localQueryHistory[0] });

          const otherQuery = await (
            queryHistoryManager as any
          ).findOtherQueryToCompare(thisQuery, []);
          expect(otherQuery).to.eq(localQueryHistory[0]);

          // only called with first item, other items filtered out
          expect(showQuickPickSpy.getCalls().length).to.eq(1);
          expect(showQuickPickSpy.firstCall.args[0][0].query).to.eq(
            localQueryHistory[0],
          );
        });

        it("should handle cancelling out of the quick select", async () => {
          const thisQuery = localQueryHistory[3];
          queryHistoryManager = await createMockQueryHistory(allHistory);

          const otherQuery = await (
            queryHistoryManager as any
          ).findOtherQueryToCompare(thisQuery, []);
          expect(otherQuery).to.be.undefined;

          // only called with first item, other items filtered out
          expect(showQuickPickSpy.getCalls().length).to.eq(1);
          expect(showQuickPickSpy.firstCall.args[0][0].query).to.eq(
            localQueryHistory[0],
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
          expect(otherQuery).to.eq(localQueryHistory[0]);
          expect(showQuickPickSpy).not.to.have.been.called;
        });

        it("should throw an error when a query is not successful", async () => {
          const thisQuery = localQueryHistory[3];
          queryHistoryManager = await createMockQueryHistory(allHistory);
          allHistory[0] = createMockLocalQueryInfo({
            dbName: "a",
            queryWithResults: createMockQueryWithResults({
              sandbox,
              didRunSuccessfully: false,
            }),
          });

          try {
            await (queryHistoryManager as any).findOtherQueryToCompare(
              thisQuery,
              [thisQuery, allHistory[0]],
            );
            assert(false, "Should have thrown");
          } catch (e) {
            expect(getErrorMessage(e)).to.eq(
              "Please select a successful query.",
            );
          }
        });

        it("should throw an error when a databases are not the same", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

          try {
            // localQueryHistory[0] is database a
            // localQueryHistory[1] is database b
            await (queryHistoryManager as any).findOtherQueryToCompare(
              localQueryHistory[0],
              [localQueryHistory[0], localQueryHistory[1]],
            );
            assert(false, "Should have thrown");
          } catch (e) {
            expect(getErrorMessage(e)).to.eq(
              "Query databases must be the same.",
            );
          }
        });

        it("should throw an error when more than 2 queries selected", async () => {
          const thisQuery = localQueryHistory[3];
          queryHistoryManager = await createMockQueryHistory(allHistory);

          try {
            await (queryHistoryManager as any).findOtherQueryToCompare(
              thisQuery,
              [thisQuery, localQueryHistory[0], localQueryHistory[1]],
            );
            assert(false, "Should have thrown");
          } catch (e) {
            expect(getErrorMessage(e)).to.eq(
              "Please select no more than 2 queries.",
            );
          }
        });
      });

      describe("Compare callback", () => {
        it("should call the compare callback", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);
          await queryHistoryManager.handleCompareWith(localQueryHistory[0], [
            localQueryHistory[0],
            localQueryHistory[3],
          ]);
          expect(doCompareCallback).to.have.been.calledOnceWith(
            localQueryHistory[0],
            localQueryHistory[3],
          );
        });

        it("should avoid calling the compare callback when only one item is selected", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);
          await queryHistoryManager.handleCompareWith(localQueryHistory[0], [
            localQueryHistory[0],
          ]);
          expect(doCompareCallback).not.to.have.been.called;
        });
      });

      describe("updateCompareWith", () => {
        it("should update compareWithItem when there is a single item", async () => {
          queryHistoryManager = await createMockQueryHistory([]);
          (queryHistoryManager as any).updateCompareWith(["a"]);
          expect(queryHistoryManager.compareWithItem).to.be.eq("a");
        });

        it("should delete compareWithItem when there are 0 items", async () => {
          queryHistoryManager = await createMockQueryHistory([]);
          queryHistoryManager.compareWithItem = localQueryHistory[0];
          (queryHistoryManager as any).updateCompareWith([]);
          expect(queryHistoryManager.compareWithItem).to.be.undefined;
        });

        it("should delete compareWithItem when there are more than 2 items", async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);
          queryHistoryManager.compareWithItem = localQueryHistory[0];
          (queryHistoryManager as any).updateCompareWith([
            localQueryHistory[0],
            localQueryHistory[1],
            localQueryHistory[2],
          ]);
          expect(queryHistoryManager.compareWithItem).to.be.undefined;
        });

        it("should delete compareWithItem when there are 2 items and disjoint from compareWithItem", async () => {
          queryHistoryManager = await createMockQueryHistory([]);
          queryHistoryManager.compareWithItem = localQueryHistory[0];
          (queryHistoryManager as any).updateCompareWith([
            localQueryHistory[1],
            localQueryHistory[2],
          ]);
          expect(queryHistoryManager.compareWithItem).to.be.undefined;
        });

        it("should do nothing when compareWithItem exists and exactly 2 items", async () => {
          queryHistoryManager = await createMockQueryHistory([]);
          queryHistoryManager.compareWithItem = localQueryHistory[0];
          (queryHistoryManager as any).updateCompareWith([
            localQueryHistory[0],
            localQueryHistory[1],
          ]);
          expect(queryHistoryManager.compareWithItem).to.be.eq(
            localQueryHistory[0],
          );
        });
      });
    });

    describe("query history scrubber", () => {
      let clock: sinon.SinonFakeTimers;
      let deregister: vscode.Disposable | undefined;
      let mockCtx: vscode.ExtensionContext;
      let runCount = 0;

      // We don't want our times to align exactly with the hour,
      // so we can better mimic real life
      const LESS_THAN_ONE_DAY = ONE_DAY_IN_MS - 1000;
      const tmpDir = tmp.dirSync({
        unsafeCleanup: true,
      });

      beforeEach(() => {
        clock = sandbox.useFakeTimers({
          toFake: ["setInterval", "Date"],
        });
        mockCtx = {
          globalState: {
            lastScrubTime: Date.now(),
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
        clock.restore();
        if (deregister) {
          deregister.dispose();
          deregister = undefined;
        }
      });

      it("should not throw an error when the query directory does not exist", async function () {
        // because of the waits, we need to have a higher timeout on this test.
        this.timeout(5000);
        registerScrubber("idontexist");

        clock.tick(ONE_HOUR_IN_MS);
        await wait();
        expect(runCount, "Should not have called the scrubber").to.eq(0);

        clock.tick(ONE_HOUR_IN_MS - 1);
        await wait();
        expect(runCount, "Should not have called the scrubber").to.eq(0);

        clock.tick(1);
        await wait();
        expect(runCount, "Should have called the scrubber once").to.eq(1);

        clock.tick(TWO_HOURS_IN_MS);
        await wait();
        expect(runCount, "Should have called the scrubber a second time").to.eq(
          2,
        );

        expect((mockCtx.globalState as any).lastScrubTime).to.eq(
          TWO_HOURS_IN_MS * 2,
          "Should have scrubbed the last time at 4 hours.",
        );
      });

      it("should scrub directories", async function () {
        this.timeout(5000);
        // create two query directories that are right around the cut off time
        const queryDir = createMockQueryDir(
          ONE_HOUR_IN_MS,
          TWO_HOURS_IN_MS,
          THREE_HOURS_IN_MS,
        );
        registerScrubber(queryDir);

        clock.tick(TWO_HOURS_IN_MS);
        await wait();

        // should have deleted only the invalid locations
        expectDirectories(
          queryDir,
          toQueryDirName(ONE_HOUR_IN_MS),
          toQueryDirName(TWO_HOURS_IN_MS),
          toQueryDirName(THREE_HOURS_IN_MS),
        );

        clock.tick(LESS_THAN_ONE_DAY);
        await wait();

        // nothing should have happened...yet
        expectDirectories(
          queryDir,
          toQueryDirName(ONE_HOUR_IN_MS),
          toQueryDirName(TWO_HOURS_IN_MS),
          toQueryDirName(THREE_HOURS_IN_MS),
        );

        clock.tick(1000);
        await wait();

        // should have deleted the two older directories
        // even though they have different time stamps,
        // they both expire during the same scrubbing period
        expectDirectories(queryDir, toQueryDirName(THREE_HOURS_IN_MS));

        // Wait until the next scrub time and the final directory is deleted
        clock.tick(TWO_HOURS_IN_MS);
        await wait();

        // should have deleted everything
        expectDirectories(queryDir);
      });

      function expectDirectories(queryDir: string, ...dirNames: string[]) {
        const files = fs.readdirSync(queryDir);
        expect(files.sort()).to.deep.eq(dirNames.sort());
      }

      function createMockQueryDir(...timestamps: number[]) {
        const dir = tmpDir.name;
        const queryDir = path.join(dir, "query");
        // create qyuery directory and fill it with some query directories
        fs.mkdirSync(queryDir);

        // create an invalid file
        const invalidFile = path.join(queryDir, "invalid.txt");
        fs.writeFileSync(invalidFile, "invalid");

        // create a directory without a timestamp file
        const noTimestampDir = path.join(queryDir, "noTimestampDir");
        fs.mkdirSync(noTimestampDir);
        fs.writeFileSync(path.join(noTimestampDir, "invalid.txt"), "invalid");

        // create a directory with a timestamp file, but is invalid
        const invalidTimestampDir = path.join(queryDir, "invalidTimestampDir");
        fs.mkdirSync(invalidTimestampDir);
        fs.writeFileSync(
          path.join(invalidTimestampDir, "timestamp"),
          "invalid",
        );

        // create a directories with a valid timestamp files from the args
        timestamps.forEach((timestamp) => {
          const dir = path.join(queryDir, toQueryDirName(timestamp));
          fs.mkdirSync(dir);
          fs.writeFileSync(
            path.join(dir, "timestamp"),
            `${Date.now() + timestamp}`,
          );
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

    describe("getTreeItem", async () => {
      it("should get a tree item with raw results", async () => {
        const mockQueryWithRawResults = createMockLocalQueryInfo({
          dbName: "a",
          queryWithResults: createMockQueryWithResults({
            sandbox,
            didRunSuccessfully: true,
            hasInterpretedResults: false,
          }),
        });

        const treeItem = await historyTreeDataProvider.getTreeItem(
          mockQueryWithRawResults,
        );
        expect(treeItem.command).to.deep.eq({
          title: "Query History Item",
          command: "codeQLQueryHistory.itemClicked",
          arguments: [mockQueryWithRawResults],
          tooltip: labelProvider.getLabel(mockQueryWithRawResults),
        });
        expect(treeItem.label).to.contain("query-file.ql");
        expect(treeItem.contextValue).to.eq("rawResultsItem");
        expect(treeItem.iconPath).to.deep.eq(
          vscode.Uri.file(mockExtensionLocation + "/media/drive.svg").fsPath,
        );
      });

      it("should get a tree item with interpreted results", async () => {
        const mockQueryWithInterpretedResults = createMockLocalQueryInfo({
          dbName: "a",
          queryWithResults: createMockQueryWithResults({
            sandbox,
            didRunSuccessfully: true,
            hasInterpretedResults: true,
          }),
        });

        const treeItem = await historyTreeDataProvider.getTreeItem(
          mockQueryWithInterpretedResults,
        );
        expect(treeItem.contextValue).to.eq("interpretedResultsItem");
        expect(treeItem.iconPath).to.deep.eq(
          vscode.Uri.file(mockExtensionLocation + "/media/drive.svg").fsPath,
        );
      });

      it("should get a tree item that did not complete successfully", async () => {
        const mockQuery = createMockLocalQueryInfo({
          dbName: "a",
          failureReason: "failure reason",
          queryWithResults: createMockQueryWithResults({
            sandbox,
            didRunSuccessfully: false,
          }),
        });

        const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
        expect(treeItem.iconPath).to.eq(
          vscode.Uri.file(mockExtensionLocation + "/media/red-x.svg").fsPath,
        );
      });

      it("should get a tree item that failed before creating any results", async () => {
        const mockQuery = createMockLocalQueryInfo({
          dbName: "a",
          failureReason: "failure reason",
        });

        const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
        expect(treeItem.iconPath).to.eq(
          vscode.Uri.file(mockExtensionLocation + "/media/red-x.svg").fsPath,
        );
      });

      it("should get a tree item that is in progress", async () => {
        const mockQuery = createMockLocalQueryInfo({ dbName: "a" });

        const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
        expect(treeItem.iconPath).to.deep.eq({
          id: "sync~spin",
          color: undefined,
        });
      });
    });

    describe("getChildren", () => {
      it("fetch children correctly", () => {
        const mockQuery = createMockLocalQueryInfo({});
        historyTreeDataProvider.allHistory.push(mockQuery);
        expect(historyTreeDataProvider.getChildren()).to.deep.eq([mockQuery]);
        expect(historyTreeDataProvider.getChildren(mockQuery)).to.deep.eq([]);
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
          expect(children).to.deep.eq(expected);
        });

        it("should get children for name descending", async () => {
          const expected = [...history].reverse();
          treeDataProvider.sortOrder = SortOrder.NameDesc;

          const children = await treeDataProvider.getChildren();
          expect(children).to.deep.eq(expected);
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
          expect(children).to.deep.eq(expected);
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
          expect(children).to.deep.eq(expected);
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

          expect(children).to.deep.eq(expected);
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
          expect(children).to.deep.eq(expected);
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

          expect(children).to.deep.eq(expected);
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
          expect(children).to.deep.eq(expected);
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
