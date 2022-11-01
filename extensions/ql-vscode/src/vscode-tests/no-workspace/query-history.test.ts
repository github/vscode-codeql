import * as fs from 'fs-extra';
import * as path from 'path';
import { assert, expect } from 'chai';
import * as vscode from 'vscode';
import * as sinon from 'sinon';

import { logger } from '../../logging';
import { registerQueryHistoryScrubber } from '../../query-history-scrubber';
import { HistoryTreeDataProvider, QueryHistoryManager, SortOrder } from '../../query-history';
import { QueryHistoryConfig, QueryHistoryConfigListener } from '../../config';
import { LocalQueryInfo } from '../../query-results';
import { DatabaseManager } from '../../databases';
import * as tmp from 'tmp-promise';
import { ONE_DAY_IN_MS, ONE_HOUR_IN_MS, THREE_HOURS_IN_MS, TWO_HOURS_IN_MS } from '../../pure/time';
import { tmpDir } from '../../helpers';
import { getErrorMessage } from '../../pure/helpers-pure';
import { HistoryItemLabelProvider } from '../../history-item-label-provider';
import { RemoteQueriesManager } from '../../remote-queries/remote-queries-manager';
import { ResultsView } from '../../interface';
import { EvalLogViewer } from '../../eval-log-viewer';
import { QueryRunner } from '../../queryRunner';
import { VariantAnalysisManager } from '../../remote-queries/variant-analysis-manager';
import { QueryHistoryInfo } from '../../query-history-info';
import { createMockLocalQuery, createMockQueryWithResults } from '../factories/local-queries/local-query-history-item';
import { createMockRemoteQueryHistoryItem } from '../factories/remote-queries/remote-query-history-item';
import { RemoteQueryHistoryItem } from '../../remote-queries/remote-query-history-item';
import { shuffleHistoryItems } from '../utils/query-history-helpers';
import { createMockVariantAnalysisHistoryItem } from '../factories/remote-queries/variant-analysis-history-item';
import { VariantAnalysisHistoryItem } from '../../remote-queries/variant-analysis-history-item';
import { QueryStatus } from '../../query-status';

describe('query-history', () => {
  const mockExtensionLocation = path.join(tmpDir.name, 'mock-extension-location');
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

    showTextDocumentSpy = sandbox.stub(vscode.window, 'showTextDocument');
    showInformationMessageSpy = sandbox.stub(
      vscode.window,
      'showInformationMessage'
    );
    showQuickPickSpy = sandbox.stub(
      vscode.window,
      'showQuickPick'
    );
    executeCommandSpy = sandbox.stub(vscode.commands, 'executeCommand');
    sandbox.stub(logger, 'log');
    tryOpenExternalFile = (QueryHistoryManager.prototype as any).tryOpenExternalFile;
    configListener = new QueryHistoryConfigListener();
    doCompareCallback = sandbox.stub();
    localQueriesResultsViewStub = {
      showResults: sandbox.stub()
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
      createMockLocalQuery('a', createMockQueryWithResults(sandbox, true)),
      createMockLocalQuery('b', createMockQueryWithResults(sandbox, true)),
      createMockLocalQuery('a', createMockQueryWithResults(sandbox, false)),
      createMockLocalQuery('a', createMockQueryWithResults(sandbox, true)),
    ];
    remoteQueryHistory = [
      createMockRemoteQueryHistoryItem({ status: QueryStatus.Completed }),
      createMockRemoteQueryHistoryItem({ status: QueryStatus.Failed }),
      createMockRemoteQueryHistoryItem({ status: QueryStatus.InProgress }),
      createMockRemoteQueryHistoryItem({ status: QueryStatus.InProgress })
    ];
    variantAnalysisHistory = [
      createMockVariantAnalysisHistoryItem(QueryStatus.Completed),
      createMockVariantAnalysisHistoryItem(QueryStatus.InProgress),
      createMockVariantAnalysisHistoryItem(QueryStatus.Failed),
      createMockVariantAnalysisHistoryItem(QueryStatus.InProgress)
    ];
    allHistory = shuffleHistoryItems([...localQueryHistory, ...remoteQueryHistory, ...variantAnalysisHistory]);

  });

  afterEach(async () => {
    if (queryHistoryManager) {
      queryHistoryManager.dispose();
      queryHistoryManager = undefined;
    }
    sandbox.restore();
  });

  describe('QueryHistoryManager', () => {
    describe('tryOpenExternalFile', () => {
      it('should open an external file', async () => {
        await tryOpenExternalFile('xxx');
        expect(showTextDocumentSpy).to.have.been.calledOnceWith(
          vscode.Uri.file('xxx')
        );
        expect(executeCommandSpy).not.to.have.been.called;
      });

      [
        'too large to open',
        'Files above 50MB cannot be synchronized with extensions',
      ].forEach(msg => {
        it(`should fail to open a file because "${msg}" and open externally`, async () => {
          showTextDocumentSpy.throws(new Error(msg));
          showInformationMessageSpy.returns({ title: 'Yes' });

          await tryOpenExternalFile('xxx');
          const uri = vscode.Uri.file('xxx');
          expect(showTextDocumentSpy).to.have.been.calledOnceWith(
            uri
          );
          expect(executeCommandSpy).to.have.been.calledOnceWith(
            'revealFileInOS',
            uri
          );
        });

        it(`should fail to open a file because "${msg}" and NOT open externally`, async () => {
          showTextDocumentSpy.throws(new Error(msg));
          showInformationMessageSpy.returns({ title: 'No' });

          await tryOpenExternalFile('xxx');
          const uri = vscode.Uri.file('xxx');
          expect(showTextDocumentSpy).to.have.been.calledOnceWith(uri);
          expect(showInformationMessageSpy).to.have.been.called;
          expect(executeCommandSpy).not.to.have.been.called;
        });
      });
    });

    describe('handleItemClicked', async () => {
      describe('single click', async () => {
        describe('local query', async () => {
          describe('when complete', async () => {
            it('should show results', async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = localQueryHistory[0];
              await queryHistoryManager.handleItemClicked(itemClicked, [itemClicked]);

              expect(localQueriesResultsViewStub.showResults).to.have.been.calledOnceWith(itemClicked);
              expect(queryHistoryManager.treeDataProvider.getCurrent()).to.eq(itemClicked);
            });
          });

          describe('when incomplete', async () => {
            it('should do nothing', async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = localQueryHistory[2];
              await queryHistoryManager.handleItemClicked(itemClicked, [itemClicked]);

              expect(localQueriesResultsViewStub.showResults).not.to.have.been.calledWith(itemClicked);
            });
          });
        });

        describe('remote query', async () => {
          describe('when complete', async () => {
            it('should show results', async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = remoteQueryHistory[0];
              await queryHistoryManager.handleItemClicked(itemClicked, [itemClicked]);

              expect(remoteQueriesManagerStub.openRemoteQueryResults).to.have.been.calledOnceWith(itemClicked.queryId);
              expect(queryHistoryManager.treeDataProvider.getCurrent()).to.eq(itemClicked);
            });
          });

          describe('when incomplete', async () => {
            it('should do nothing', async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = remoteQueryHistory[2];
              await queryHistoryManager.handleItemClicked(itemClicked, [itemClicked]);

              expect(remoteQueriesManagerStub.openRemoteQueryResults).not.to.have.been.calledWith(itemClicked.queryId);
            });
          });
        });

        describe('variant analysis', async () => {
          describe('when complete', async () => {
            it('should show results', async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = variantAnalysisHistory[0];
              await queryHistoryManager.handleItemClicked(itemClicked, [itemClicked]);

              expect(variantAnalysisManagerStub.showView).to.have.been.calledOnceWith(itemClicked.variantAnalysis.id);
              expect(queryHistoryManager.treeDataProvider.getCurrent()).to.eq(itemClicked);
            });
          });

          describe('when incomplete', async () => {
            it('should show results', async () => {
              queryHistoryManager = await createMockQueryHistory(allHistory);
              const itemClicked = variantAnalysisHistory[1];
              await queryHistoryManager.handleItemClicked(itemClicked, [itemClicked]);

              expect(variantAnalysisManagerStub.showView).to.have.been.calledOnceWith(itemClicked.variantAnalysis.id);
              expect(queryHistoryManager.treeDataProvider.getCurrent()).to.eq(itemClicked);
            });
          });
        });
      });

      describe('double click', () => {
        it('should do nothing', async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);
          const itemClicked = allHistory[0];
          const secondItemClicked = allHistory[1];

          await queryHistoryManager.handleItemClicked(itemClicked, [itemClicked, secondItemClicked]);

          expect(localQueriesResultsViewStub.showResults).not.to.have.been.called;
          expect(remoteQueriesManagerStub.openRemoteQueryResults).not.to.have.been.called;
          expect(variantAnalysisManagerStub.showView).not.to.have.been.called;
          expect(queryHistoryManager.treeDataProvider.getCurrent()).to.be.undefined;
        });
      });

      describe('no selection', () => {
        it('should do nothing', async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

          await queryHistoryManager.handleItemClicked(undefined!, []);

          expect(localQueriesResultsViewStub.showResults).not.to.have.been.called;
          expect(remoteQueriesManagerStub.openRemoteQueryResults).not.to.have.been.called;
          expect(variantAnalysisManagerStub.showView).not.to.have.been.called;
          expect(queryHistoryManager.treeDataProvider.getCurrent()).to.be.undefined;
        });
      });
    });

    describe('handleRemoveHistoryItem', () => {
      it('should remove an item and not select a new one', async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);
        // initialize the selection
        await queryHistoryManager.treeView.reveal(allHistory[0], { select: true });

        // deleting the first item when a different item is selected
        // will not change the selection
        const toDelete = allHistory[1];
        const selected = allHistory[3];

        // select the item we want
        await queryHistoryManager.treeView.reveal(selected, { select: true });

        // should be selected
        expect(queryHistoryManager.treeDataProvider.getCurrent()).to.deep.eq(selected);

        // remove an item
        await queryHistoryManager.handleRemoveHistoryItem(toDelete, [toDelete]);

        if (toDelete.t == 'local') {
          expect(toDelete.completedQuery!.dispose).to.have.been.calledOnce;
        } else if (toDelete.t == 'remote') {
          expect(remoteQueriesManagerStub.removeRemoteQuery).to.have.been.calledOnceWith((toDelete as RemoteQueryHistoryItem).queryId);
        } else if (toDelete.t == 'variant-analysis') {
          expect(variantAnalysisManagerStub.removeVariantAnalysis).to.have.been.calledOnceWith((toDelete as VariantAnalysisHistoryItem).variantAnalysis.id);
        }

        // the same item should be selected
        if (selected.t == 'local') {
          expect(localQueriesResultsViewStub.showResults).to.have.been.calledOnceWith(selected);
        } else if (toDelete.t == 'remote') {
          expect(remoteQueriesManagerStub.openRemoteQueryResults).to.have.been.calledOnceWith((selected as RemoteQueryHistoryItem).queryId);
        } else if (toDelete.t == 'variant-analysis') {
          expect(variantAnalysisManagerStub.showView).to.have.been.calledOnceWith((selected as VariantAnalysisHistoryItem).variantAnalysis.id);
        }

        expect(queryHistoryManager.treeDataProvider.getCurrent()).to.deep.eq(selected);
        expect(queryHistoryManager.treeDataProvider.allHistory).not.to.contain(toDelete);
      });

      it('should remove an item and select a new one', async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);

        // deleting the selected item automatically selects next item
        const toDelete = allHistory[1];
        const newSelected = allHistory[2];
        // avoid triggering the callback by setting the field directly

        // select the item we want
        await queryHistoryManager.treeView.reveal(toDelete, { select: true });
        await queryHistoryManager.handleRemoveHistoryItem(toDelete, [toDelete]);

        if (toDelete.t == 'local') {
          expect(toDelete.completedQuery!.dispose).to.have.been.calledOnce;
        } else if (toDelete.t == 'remote') {
          expect(remoteQueriesManagerStub.removeRemoteQuery).to.have.been.calledOnceWith((toDelete as RemoteQueryHistoryItem).queryId);
        } else if (toDelete.t == 'variant-analysis') {
          expect(variantAnalysisManagerStub.removeVariantAnalysis).to.have.been.calledOnceWith((toDelete as VariantAnalysisHistoryItem).variantAnalysis.id);
        }

        // the current item should have been selected
        if (newSelected.t == 'local') {
          expect(localQueriesResultsViewStub.showResults).to.have.been.calledOnceWith(newSelected);
        } else if (toDelete.t == 'remote') {
          expect(remoteQueriesManagerStub.openRemoteQueryResults).to.have.been.calledOnceWith((newSelected as RemoteQueryHistoryItem).queryId);
        } else if (toDelete.t == 'variant-analysis') {
          expect(variantAnalysisManagerStub.showView).to.have.been.calledOnceWith((newSelected as VariantAnalysisHistoryItem).variantAnalysis.id);
        }

        expect(queryHistoryManager.treeDataProvider.getCurrent()).to.eq(newSelected);
        expect(queryHistoryManager.treeDataProvider.allHistory).not.to.contain(toDelete);
      });
    });

    describe('determineSelection', () => {
      const singleItem = 'a';
      const multipleItems = ['b', 'c', 'd'];

      it('should get the selection from parameters', async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);
        const selection = (queryHistoryManager as any).determineSelection(singleItem, multipleItems);
        expect(selection).to.deep.eq({
          finalSingleItem: singleItem,
          finalMultiSelect: multipleItems
        });
      });

      it('should get the selection when single selection is empty', async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);
        const selection = (queryHistoryManager as any).determineSelection(undefined, multipleItems);
        expect(selection).to.deep.eq({
          finalSingleItem: multipleItems[0],
          finalMultiSelect: multipleItems
        });
      });

      it('should get the selection when multi-selection is empty', async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);
        const selection = (queryHistoryManager as any).determineSelection(singleItem, undefined);
        expect(selection).to.deep.eq({
          finalSingleItem: singleItem,
          finalMultiSelect: [singleItem]
        });
      });

      it('should get the selection from the treeView when both selections are empty', async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);
        const p = new Promise<void>(done => {
          queryHistoryManager!.treeView.onDidChangeSelection(s => {
            if (s.selection[0] !== allHistory[1]) {
              return;
            }
            const selection = (queryHistoryManager as any).determineSelection(undefined, undefined);
            expect(selection).to.deep.eq({
              finalSingleItem: allHistory[1],
              finalMultiSelect: [allHistory[1]]
            });
            done();
          });
        });

        // I can't explain why, but the first time the onDidChangeSelection event fires, the selection is
        // not correct (it is inexplicably allHistory[2]). So we fire the event a second time to get the
        // correct selection.
        await queryHistoryManager.treeView.reveal(allHistory[0], { select: true });
        await queryHistoryManager.treeView.reveal(allHistory[1], { select: true });
        await p;
      });

      it('should get the selection from the treeDataProvider when both selections and the treeView are empty', async () => {
        queryHistoryManager = await createMockQueryHistory(allHistory);
        await queryHistoryManager.treeView.reveal(allHistory[1], { select: true });
        const selection = (queryHistoryManager as any).determineSelection(undefined, undefined);
        expect(selection).to.deep.eq({
          finalSingleItem: allHistory[1],
          finalMultiSelect: [allHistory[1]]
        });
      });
    });

    describe('Local Queries', () => {
      describe('findOtherQueryToCompare', () => {
        it('should find the second query to compare when one is selected', async () => {
          const thisQuery = localQueryHistory[3];
          queryHistoryManager = await createMockQueryHistory(allHistory);
          showQuickPickSpy.returns({ query: localQueryHistory[0] });

          const otherQuery = await (queryHistoryManager as any).findOtherQueryToCompare(thisQuery, []);
          expect(otherQuery).to.eq(localQueryHistory[0]);

          // only called with first item, other items filtered out
          expect(showQuickPickSpy.getCalls().length).to.eq(1);
          expect(showQuickPickSpy.firstCall.args[0][0].query).to.eq(localQueryHistory[0]);
        });

        it('should handle cancelling out of the quick select', async () => {
          const thisQuery = localQueryHistory[3];
          queryHistoryManager = await createMockQueryHistory(allHistory);

          const otherQuery = await (queryHistoryManager as any).findOtherQueryToCompare(thisQuery, []);
          expect(otherQuery).to.be.undefined;

          // only called with first item, other items filtered out
          expect(showQuickPickSpy.getCalls().length).to.eq(1);
          expect(showQuickPickSpy.firstCall.args[0][0].query).to.eq(localQueryHistory[0]);
        });

        it('should compare against 2 queries', async () => {
          const thisQuery = localQueryHistory[3];
          queryHistoryManager = await createMockQueryHistory(allHistory);

          const otherQuery = await (queryHistoryManager as any).findOtherQueryToCompare(thisQuery, [thisQuery, localQueryHistory[0]]);
          expect(otherQuery).to.eq(localQueryHistory[0]);
          expect(showQuickPickSpy).not.to.have.been.called;
        });

        it('should throw an error when a query is not successful', async () => {
          const thisQuery = localQueryHistory[3];
          queryHistoryManager = await createMockQueryHistory(allHistory);
          allHistory[0] = createMockLocalQuery('a', createMockQueryWithResults(sandbox, false));

          try {
            await (queryHistoryManager as any).findOtherQueryToCompare(thisQuery, [thisQuery, allHistory[0]]);
            assert(false, 'Should have thrown');
          } catch (e) {
            expect(getErrorMessage(e)).to.eq('Please select a successful query.');
          }
        });

        it('should throw an error when a databases are not the same', async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);

          try {
            // localQueryHistory[0] is database a
            // localQueryHistory[1] is database b
            await (queryHistoryManager as any).findOtherQueryToCompare(localQueryHistory[0], [localQueryHistory[0], localQueryHistory[1]]);
            assert(false, 'Should have thrown');
          } catch (e) {
            expect(getErrorMessage(e)).to.eq('Query databases must be the same.');
          }
        });

        it('should throw an error when more than 2 queries selected', async () => {
          const thisQuery = localQueryHistory[3];
          queryHistoryManager = await createMockQueryHistory(allHistory);

          try {
            await (queryHistoryManager as any).findOtherQueryToCompare(thisQuery, [thisQuery, localQueryHistory[0], localQueryHistory[1]]);
            assert(false, 'Should have thrown');
          } catch (e) {
            expect(getErrorMessage(e)).to.eq('Please select no more than 2 queries.');
          }
        });
      });

      describe('Compare callback', () => {
        it('should call the compare callback', async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);
          await queryHistoryManager.handleCompareWith(localQueryHistory[0], [localQueryHistory[0], localQueryHistory[3]]);
          expect(doCompareCallback).to.have.been.calledOnceWith(localQueryHistory[0], localQueryHistory[3]);
        });

        it('should avoid calling the compare callback when only one item is selected', async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);
          await queryHistoryManager.handleCompareWith(localQueryHistory[0], [localQueryHistory[0]]);
          expect(doCompareCallback).not.to.have.been.called;
        });
      });

      describe('updateCompareWith', () => {
        it('should update compareWithItem when there is a single item', async () => {
          queryHistoryManager = await createMockQueryHistory([]);
          (queryHistoryManager as any).updateCompareWith(['a']);
          expect(queryHistoryManager.compareWithItem).to.be.eq('a');
        });

        it('should delete compareWithItem when there are 0 items', async () => {
          queryHistoryManager = await createMockQueryHistory([]);
          queryHistoryManager.compareWithItem = localQueryHistory[0];
          (queryHistoryManager as any).updateCompareWith([]);
          expect(queryHistoryManager.compareWithItem).to.be.undefined;
        });

        it('should delete compareWithItem when there are more than 2 items', async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);
          queryHistoryManager.compareWithItem = localQueryHistory[0];
          (queryHistoryManager as any).updateCompareWith([localQueryHistory[0], localQueryHistory[1], localQueryHistory[2]]);
          expect(queryHistoryManager.compareWithItem).to.be.undefined;
        });

        it('should delete compareWithItem when there are 2 items and disjoint from compareWithItem', async () => {
          queryHistoryManager = await createMockQueryHistory([]);
          queryHistoryManager.compareWithItem = localQueryHistory[0];
          (queryHistoryManager as any).updateCompareWith([localQueryHistory[1], localQueryHistory[2]]);
          expect(queryHistoryManager.compareWithItem).to.be.undefined;
        });

        it('should do nothing when compareWithItem exists and exactly 2 items', async () => {
          queryHistoryManager = await createMockQueryHistory([]);
          queryHistoryManager.compareWithItem = localQueryHistory[0];
          (queryHistoryManager as any).updateCompareWith([localQueryHistory[0], localQueryHistory[1]]);
          expect(queryHistoryManager.compareWithItem).to.be.eq(localQueryHistory[0]);
        });
      });
    });

    describe('query history scrubber', () => {
      let clock: sinon.SinonFakeTimers;
      let deregister: vscode.Disposable | undefined;
      let mockCtx: vscode.ExtensionContext;
      let runCount = 0;

      // We don't want our times to align exactly with the hour,
      // so we can better mimic real life
      const LESS_THAN_ONE_DAY = ONE_DAY_IN_MS - 1000;
      const tmpDir = tmp.dirSync({
        unsafeCleanup: true
      });

      beforeEach(() => {
        clock = sandbox.useFakeTimers({
          toFake: ['setInterval', 'Date']
        });
        mockCtx = {
          globalState: {
            lastScrubTime: Date.now(),
            get(key: string) {
              if (key !== 'lastScrubTime') {
                throw new Error(`Unexpected key: ${key}`);
              }
              return this.lastScrubTime;
            },
            async update(key: string, value: any) {
              if (key !== 'lastScrubTime') {
                throw new Error(`Unexpected key: ${key}`);
              }
              this.lastScrubTime = value;
            }
          }
        } as any as vscode.ExtensionContext;
      });

      afterEach(() => {
        clock.restore();
        if (deregister) {
          deregister.dispose();
          deregister = undefined;
        }
      });

      it('should not throw an error when the query directory does not exist', async function() {
        // because of the waits, we need to have a higher timeout on this test.
        this.timeout(5000);
        registerScrubber('idontexist');

        clock.tick(ONE_HOUR_IN_MS);
        await wait();
        expect(runCount, 'Should not have called the scrubber').to.eq(0);

        clock.tick(ONE_HOUR_IN_MS - 1);
        await wait();
        expect(runCount, 'Should not have called the scrubber').to.eq(0);

        clock.tick(1);
        await wait();
        expect(runCount, 'Should have called the scrubber once').to.eq(1);

        clock.tick(TWO_HOURS_IN_MS);
        await wait();
        expect(runCount, 'Should have called the scrubber a second time').to.eq(2);

        expect((mockCtx.globalState as any).lastScrubTime).to.eq(TWO_HOURS_IN_MS * 2, 'Should have scrubbed the last time at 4 hours.');
      });

      it('should scrub directories', async function() {
        this.timeout(5000);
        // create two query directories that are right around the cut off time
        const queryDir = createMockQueryDir(ONE_HOUR_IN_MS, TWO_HOURS_IN_MS, THREE_HOURS_IN_MS);
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
        expectDirectories(
          queryDir,
          toQueryDirName(THREE_HOURS_IN_MS),
        );

        // Wait until the next scrub time and the final directory is deleted
        clock.tick(TWO_HOURS_IN_MS);
        await wait();

        // should have deleted everything
        expectDirectories(
          queryDir
        );
      });

      function expectDirectories(queryDir: string, ...dirNames: string[]) {
        const files = fs.readdirSync(queryDir);
        expect(files.sort()).to.deep.eq(dirNames.sort());
      }

      function createMockQueryDir(...timestamps: number[]) {
        const dir = tmpDir.name;
        const queryDir = path.join(dir, 'query');
        // create qyuery directory and fill it with some query directories
        fs.mkdirSync(queryDir);

        // create an invalid file
        const invalidFile = path.join(queryDir, 'invalid.txt');
        fs.writeFileSync(invalidFile, 'invalid');

        // create a directory without a timestamp file
        const noTimestampDir = path.join(queryDir, 'noTimestampDir');
        fs.mkdirSync(noTimestampDir);
        fs.writeFileSync(path.join(noTimestampDir, 'invalid.txt'), 'invalid');

        // create a directory with a timestamp file, but is invalid
        const invalidTimestampDir = path.join(queryDir, 'invalidTimestampDir');
        fs.mkdirSync(invalidTimestampDir);
        fs.writeFileSync(path.join(invalidTimestampDir, 'timestamp'), 'invalid');

        // create a directories with a valid timestamp files from the args
        timestamps.forEach((timestamp) => {
          const dir = path.join(queryDir, toQueryDirName(timestamp));
          fs.mkdirSync(dir);
          fs.writeFileSync(path.join(dir, 'timestamp'), `${Date.now() + timestamp}`);
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
            removeDeletedQueries: () => { return Promise.resolve(); }
          } as QueryHistoryManager,
          mockCtx,
          {
            increment: () => runCount++
          }
        );
      }

      async function wait(ms = 500) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
    });
  });

  describe('HistoryTreeDataProvider', () => {
    let historyTreeDataProvider: HistoryTreeDataProvider;
    let labelProvider: HistoryItemLabelProvider;
    beforeEach(() => {
      labelProvider = new HistoryItemLabelProvider({
        /**/
      } as QueryHistoryConfig);
      historyTreeDataProvider = new HistoryTreeDataProvider(vscode.Uri.file(mockExtensionLocation).fsPath, labelProvider);
    });

    afterEach(() => {
      historyTreeDataProvider.dispose();
    });

    describe('getTreeItem', async () => {
      it('should get a tree item with raw results', async () => {
        const mockQuery = createMockLocalQuery('a', createMockQueryWithResults(sandbox, true, /* raw results */ false));
        const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
        expect(treeItem.command).to.deep.eq({
          title: 'Query History Item',
          command: 'codeQLQueryHistory.itemClicked',
          arguments: [mockQuery],
          tooltip: labelProvider.getLabel(mockQuery),
        });
        expect(treeItem.label).to.contain('hucairz');
        expect(treeItem.contextValue).to.eq('rawResultsItem');
        expect(treeItem.iconPath).to.deep.eq(vscode.Uri.file(mockExtensionLocation + '/media/drive.svg').fsPath);
      });

      it('should get a tree item with interpreted results', async () => {
        const mockQuery = createMockLocalQuery('a', createMockQueryWithResults(sandbox, true, /* interpreted results */ true));
        const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
        expect(treeItem.contextValue).to.eq('interpretedResultsItem');
        expect(treeItem.iconPath).to.deep.eq(vscode.Uri.file(mockExtensionLocation + '/media/drive.svg').fsPath);
      });

      it('should get a tree item that did not complete successfully', async () => {
        const mockQuery = createMockLocalQuery('a', createMockQueryWithResults(sandbox, false), false);
        const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
        expect(treeItem.iconPath).to.eq(vscode.Uri.file(mockExtensionLocation + '/media/red-x.svg').fsPath);
      });

      it('should get a tree item that failed before creating any results', async () => {
        const mockQuery = createMockLocalQuery('a', undefined, true);
        const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
        expect(treeItem.iconPath).to.eq(vscode.Uri.file(mockExtensionLocation + '/media/red-x.svg').fsPath);
      });

      it('should get a tree item that is in progress', async () => {
        const mockQuery = createMockLocalQuery('a');
        const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
        expect(treeItem.iconPath).to.deep.eq({
          id: 'sync~spin', color: undefined
        });
      });
    });

    describe('getChildren', () => {
      it('fetch children correctly', () => {
        const mockQuery = createMockLocalQuery();
        historyTreeDataProvider.allHistory.push(mockQuery);
        expect(historyTreeDataProvider.getChildren()).to.deep.eq([mockQuery]);
        expect(historyTreeDataProvider.getChildren(mockQuery)).to.deep.eq([]);
      });

      describe('sorting', () => {
        const history = [
          item('a', 2, 'remote', 24),
          item('b', 10, 'local', 20),
          item('c', 5, 'local', 30),
          item('d', 1, 'local', 25),
          item('e', 6, 'remote', 5),
        ];
        let treeDataProvider: HistoryTreeDataProvider;

        beforeEach(async () => {
          queryHistoryManager = await createMockQueryHistory(allHistory);
          (queryHistoryManager.treeDataProvider as any).history = [...history];
          treeDataProvider = queryHistoryManager.treeDataProvider;
        });

        it('should get children for name ascending', async () => {
          const expected = [...history];
          treeDataProvider.sortOrder = SortOrder.NameAsc;

          const children = await treeDataProvider.getChildren();
          expect(children).to.deep.eq(expected);
        });

        it('should get children for name descending', async () => {
          const expected = [...history].reverse();
          treeDataProvider.sortOrder = SortOrder.NameDesc;

          const children = await treeDataProvider.getChildren();
          expect(children).to.deep.eq(expected);
        });

        it('should get children for date ascending', async () => {
          const expected = [history[3], history[0], history[2], history[4], history[1]];
          treeDataProvider.sortOrder = SortOrder.DateAsc;

          const children = await treeDataProvider.getChildren();
          expect(children).to.deep.eq(expected);
        });

        it('should get children for date descending', async () => {
          const expected = [history[3], history[0], history[2], history[4], history[1]].reverse();
          treeDataProvider.sortOrder = SortOrder.DateDesc;

          const children = await treeDataProvider.getChildren();
          expect(children).to.deep.eq(expected);
        });

        it('should get children for result count ascending', async () => {
          const expected = [history[4], history[1], history[0], history[3], history[2]];
          treeDataProvider.sortOrder = SortOrder.CountAsc;

          const children = await treeDataProvider.getChildren();
          expect(children).to.deep.eq(expected);
        });

        it('should get children for result count descending', async () => {
          const expected = [history[4], history[1], history[0], history[3], history[2]].reverse();
          treeDataProvider.sortOrder = SortOrder.CountDesc;

          const children = await treeDataProvider.getChildren();
          expect(children).to.deep.eq(expected);
        });

        it('should get children for result count ascending when there are no results', async () => {
          // fall back to name
          const thisHistory = [item('a', 10), item('b', 50), item('c', 1)];
          (queryHistoryManager!.treeDataProvider as any).history = [...thisHistory];
          const expected = [...thisHistory];
          treeDataProvider.sortOrder = SortOrder.CountAsc;

          const children = await treeDataProvider.getChildren();
          expect(children).to.deep.eq(expected);
        });

        it('should get children for result count descending when there are no results', async () => {
          // fall back to name
          const thisHistory = [item('a', 10), item('b', 50), item('c', 1)];
          (queryHistoryManager!.treeDataProvider as any).history = [...thisHistory];
          const expected = [...thisHistory].reverse();
          treeDataProvider.sortOrder = SortOrder.CountDesc;

          const children = await treeDataProvider.getChildren();
          expect(children).to.deep.eq(expected);
        });

        function item(label: string, start: number, t = 'local', resultCount?: number) {
          if (t === 'local') {
            return {
              getQueryName() {
                return label;
              },
              getQueryFileName() {
                return label + '.ql';
              },
              initialInfo: {
                start: new Date(start),
                databaseInfo: {
                  name: 'test',
                }
              },
              completedQuery: {
                resultCount,
              },
              t
            };
          } else {
            return {
              status: 'success',
              remoteQuery: {
                queryFilePath: label + '.ql',
                queryName: label,
                executionStartTime: start,
                controllerRepository: {
                  name: 'test',
                  owner: 'user',
                },
                repositories: []
              },
              resultCount,
              t
            };
          }
        }
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
      'xxx',
      {
        globalStorageUri: vscode.Uri.file(mockExtensionLocation),
        extensionPath: vscode.Uri.file('/x/y/z').fsPath,
      } as vscode.ExtensionContext,
      configListener,
      new HistoryItemLabelProvider({} as QueryHistoryConfig),
      doCompareCallback
    );
    (qhm.treeDataProvider as any).history = [...allHistory];
    await vscode.workspace.saveAll();
    await qhm.refreshTreeView();
    return qhm;
  }
});
