import * as chai from 'chai';
import 'mocha';
import 'sinon-chai';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as chaiAsPromised from 'chai-as-promised';
import { logger } from '../../logging';
import { QueryHistoryManager, HistoryTreeDataProvider } from '../../query-history';
import { QueryEvaluatonInfo, QueryWithResults } from '../../run-queries';
import { QueryHistoryConfigListener } from '../../config';
import * as messages from '../../pure/messages';
import { QueryServerClient } from '../../queryserver-client';
import { FullQueryInfo, InitialQueryInfo } from '../../query-results';

chai.use(chaiAsPromised);
const expect = chai.expect;
const assert = chai.assert;


describe('query-history', () => {
  let configListener: QueryHistoryConfigListener;
  let showTextDocumentSpy: sinon.SinonStub;
  let showInformationMessageSpy: sinon.SinonStub;
  let executeCommandSpy: sinon.SinonStub;
  let showQuickPickSpy: sinon.SinonStub;
  let queryHistoryManager: QueryHistoryManager | undefined;
  let selectedCallback: sinon.SinonStub;
  let doCompareCallback: sinon.SinonStub;

  let tryOpenExternalFile: Function;
  let sandbox: sinon.SinonSandbox;

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
    selectedCallback = sandbox.stub();
    doCompareCallback = sandbox.stub();
  });

  afterEach(async () => {
    if (queryHistoryManager) {
      queryHistoryManager.dispose();
      queryHistoryManager = undefined;
    }
    sandbox.restore();
  });

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

  let allHistory: FullQueryInfo[];

  beforeEach(() => {
    allHistory = [
      createMockFullQueryInfo('a', createMockQueryWithResults(true)),
      createMockFullQueryInfo('b', createMockQueryWithResults(true)),
      createMockFullQueryInfo('a', createMockQueryWithResults(false)),
      createMockFullQueryInfo('a', createMockQueryWithResults(true)),
    ];
  });

  describe('findOtherQueryToCompare', () => {
    it('should find the second query to compare when one is selected', async () => {
      const thisQuery = allHistory[3];
      queryHistoryManager = await createMockQueryHistory(allHistory);
      showQuickPickSpy.returns({ query: allHistory[0] });

      const otherQuery = await (queryHistoryManager as any).findOtherQueryToCompare(thisQuery, []);
      expect(otherQuery).to.eq(allHistory[0]);

      // only called with first item, other items filtered out
      expect(showQuickPickSpy.getCalls().length).to.eq(1);
      expect(showQuickPickSpy.firstCall.args[0][0].query).to.eq(allHistory[0]);
    });

    it('should handle cancelling out of the quick select', async () => {
      const thisQuery = allHistory[3];
      queryHistoryManager = await createMockQueryHistory(allHistory);

      const otherQuery = await (queryHistoryManager as any).findOtherQueryToCompare(thisQuery, []);
      expect(otherQuery).to.be.undefined;

      // only called with first item, other items filtered out
      expect(showQuickPickSpy.getCalls().length).to.eq(1);
      expect(showQuickPickSpy.firstCall.args[0][0].query).to.eq(allHistory[0]);
    });

    it('should compare against 2 queries', async () => {
      const thisQuery = allHistory[3];
      queryHistoryManager = await createMockQueryHistory(allHistory);

      const otherQuery = await (queryHistoryManager as any).findOtherQueryToCompare(thisQuery, [thisQuery, allHistory[0]]);
      expect(otherQuery).to.eq(allHistory[0]);
      expect(showQuickPickSpy).not.to.have.been.called;
    });

    it('should throw an error when a query is not successful', async () => {
      const thisQuery = allHistory[3];
      queryHistoryManager = await createMockQueryHistory(allHistory);
      allHistory[0] = createMockFullQueryInfo('a', createMockQueryWithResults(false));

      try {
        await (queryHistoryManager as any).findOtherQueryToCompare(thisQuery, [thisQuery, allHistory[0]]);
        assert(false, 'Should have thrown');
      } catch (e) {
        expect(e.message).to.eq('Please select a successful query.');
      }
    });

    it('should throw an error when a databases are not the same', async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);

      try {
        // allHistory[0] is database a
        // allHistory[1] is database b
        await (queryHistoryManager as any).findOtherQueryToCompare(allHistory[0], [allHistory[0], allHistory[1]]);
        assert(false, 'Should have thrown');
      } catch (e) {
        expect(e.message).to.eq('Query databases must be the same.');
      }
    });

    it('should throw an error when more than 2 queries selected', async () => {
      const thisQuery = allHistory[3];
      queryHistoryManager = await createMockQueryHistory(allHistory);

      try {
        await (queryHistoryManager as any).findOtherQueryToCompare(thisQuery, [thisQuery, allHistory[0], allHistory[1]]);
        assert(false, 'Should have thrown');
      } catch (e) {
        expect(e.message).to.eq('Please select no more than 2 queries.');
      }
    });
  });

  describe('handleItemClicked', () => {
    it('should call the selectedCallback when an item is clicked', async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);
      await queryHistoryManager.handleItemClicked(allHistory[0], [allHistory[0]]);
      expect(selectedCallback).to.have.been.calledOnceWith(allHistory[0]);
      expect(queryHistoryManager.treeDataProvider.getCurrent()).to.eq(allHistory[0]);
    });

    it('should do nothing if there is a multi-selection', async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);
      await queryHistoryManager.handleItemClicked(allHistory[0], [allHistory[0], allHistory[1]]);
      expect(selectedCallback).not.to.have.been.called;
      expect(queryHistoryManager.treeDataProvider.getCurrent()).to.be.undefined;
    });

    it('should throw if there is no selection', async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);
      try {
        await queryHistoryManager.handleItemClicked(undefined!, []);
        expect(true).to.be.false;
      } catch (e) {
        expect(selectedCallback).not.to.have.been.called;
        expect(e.message).to.contain('No query selected');
      }
    });
  });

  it('should remove an item and not select a new one', async function() {
    queryHistoryManager = await createMockQueryHistory(allHistory);
    // deleting the first item when a different item is selected
    // will not change the selection
    const toDelete = allHistory[1];
    const selected = allHistory[3];
    // avoid triggering the callback by setting the field directly
    (queryHistoryManager.treeDataProvider as any).current = selected;
    await queryHistoryManager.handleRemoveHistoryItem(toDelete, [toDelete]);

    expect(toDelete.completedQuery!.dispose).to.have.been.calledOnce;
    expect(queryHistoryManager.treeDataProvider.getCurrent()).to.eq(selected);
    expect(allHistory).not.to.contain(toDelete);

    // the current item should have been re-selected
    expect(selectedCallback).to.have.been.calledOnceWith(selected);
  });

  it('should remove an item and select a new one', async () => {
    queryHistoryManager = await createMockQueryHistory(allHistory);

    // deleting the selected item automatically selects next item
    const toDelete = allHistory[1];
    const newSelected = allHistory[2];
    // avoid triggering the callback by setting the field directly
    (queryHistoryManager.treeDataProvider as any).current = toDelete;
    await queryHistoryManager.handleRemoveHistoryItem(toDelete, [toDelete]);

    expect(toDelete.completedQuery!.dispose).to.have.been.calledOnce;
    expect(queryHistoryManager.treeDataProvider.getCurrent()).to.eq(newSelected);
    expect(allHistory).not.to.contain(toDelete);

    // the current item should have been selected
    expect(selectedCallback).to.have.been.calledOnceWith(newSelected);
  });

  describe('Compare callback', () => {
    it('should call the compare callback', async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);
      await queryHistoryManager.handleCompareWith(allHistory[0], [allHistory[0], allHistory[3]]);
      expect(doCompareCallback).to.have.been.calledOnceWith(allHistory[0], allHistory[3]);
    });

    it('should avoid calling the compare callback when only one item is selected', async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);
      await queryHistoryManager.handleCompareWith(allHistory[0], [allHistory[0]]);
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
      queryHistoryManager.compareWithItem = allHistory[0];
      (queryHistoryManager as any).updateCompareWith([]);
      expect(queryHistoryManager.compareWithItem).to.be.undefined;
    });

    it('should delete compareWithItem when there are more than 2 items', async () => {
      queryHistoryManager = await createMockQueryHistory(allHistory);
      queryHistoryManager.compareWithItem = allHistory[0];
      (queryHistoryManager as any).updateCompareWith([allHistory[0], allHistory[1], allHistory[2]]);
      expect(queryHistoryManager.compareWithItem).to.be.undefined;
    });

    it('should delete compareWithItem when there are 2 items and disjoint from compareWithItem', async () => {
      queryHistoryManager = await createMockQueryHistory([]);
      queryHistoryManager.compareWithItem = allHistory[0];
      (queryHistoryManager as any).updateCompareWith([allHistory[1], allHistory[2]]);
      expect(queryHistoryManager.compareWithItem).to.be.undefined;
    });

    it('should do nothing when compareWithItem exists and exactly 2 items', async () => {
      queryHistoryManager = await createMockQueryHistory([]);
      queryHistoryManager.compareWithItem = allHistory[0];
      (queryHistoryManager as any).updateCompareWith([allHistory[0], allHistory[1]]);
      expect(queryHistoryManager.compareWithItem).to.be.eq(allHistory[0]);
    });
  });

  describe('HistoryTreeDataProvider', () => {
    let historyTreeDataProvider: HistoryTreeDataProvider;
    beforeEach(() => {
      historyTreeDataProvider = new HistoryTreeDataProvider(vscode.Uri.file('/a/b/c').fsPath);
    });

    afterEach(() => {
      historyTreeDataProvider.dispose();
    });


    it('should get a tree item with raw results', async () => {
      const mockQuery = createMockFullQueryInfo('a', createMockQueryWithResults(true, /* raw results */ false));
      const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
      expect(treeItem.command).to.deep.eq({
        title: 'Query History Item',
        command: 'codeQLQueryHistory.itemClicked',
        arguments: [mockQuery],
      });
      expect(treeItem.label).to.contain('hucairz');
      expect(treeItem.contextValue).to.eq('rawResultsItem');
      expect(treeItem.iconPath).to.deep.eq(vscode.Uri.file('/a/b/c/media/drive.svg').fsPath);
    });

    it('should get a tree item with interpreted results', async () => {
      const mockQuery = createMockFullQueryInfo('a', createMockQueryWithResults(true, /* interpreted results */ true));
      const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
      expect(treeItem.contextValue).to.eq('interpretedResultsItem');
      expect(treeItem.iconPath).to.deep.eq(vscode.Uri.file('/a/b/c/media/drive.svg').fsPath);
    });

    it('should get a tree item that did not complete successfully', async () => {
      const mockQuery = createMockFullQueryInfo('a', createMockQueryWithResults(false), false);
      const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
      expect(treeItem.iconPath).to.eq(vscode.Uri.file('/a/b/c/media/red-x.svg').fsPath);
    });

    it('should get a tree item that failed before creating any results', async () => {
      const mockQuery = createMockFullQueryInfo('a', undefined, true);
      const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
      expect(treeItem.iconPath).to.eq(vscode.Uri.file('/a/b/c/media/red-x.svg').fsPath);
    });

    it('should get a tree item that is in progress', async () => {
      const mockQuery = createMockFullQueryInfo('a');
      const treeItem = await historyTreeDataProvider.getTreeItem(mockQuery);
      expect(treeItem.iconPath).to.deep.eq({
        id: 'sync~spin', color: undefined
      });
    });

    it('should get children', () => {
      const mockQuery = createMockFullQueryInfo();
      historyTreeDataProvider.allHistory.push(mockQuery);
      expect(historyTreeDataProvider.getChildren()).to.deep.eq([mockQuery]);
      expect(historyTreeDataProvider.getChildren(mockQuery)).to.deep.eq([]);
    });
  });

  function createMockFullQueryInfo(dbName = 'a', queryWitbResults?: QueryWithResults, isFail = false): FullQueryInfo {
    const fqi = new FullQueryInfo(
      {
        databaseInfo: { name: dbName },
        start: new Date(),
        queryPath: 'hucairz'
      } as InitialQueryInfo,
      configListener
    );

    if (queryWitbResults) {
      fqi.completeThisQuery(queryWitbResults);
    }
    if (isFail) {
      fqi.failureReason = 'failure reason';
    }
    return fqi;
  }

  function createMockQueryWithResults(didRunSuccessfully = true, hasInterpretedResults = true): QueryWithResults {
    return {
      query: {
        hasInterpretedResults: () => Promise.resolve(hasInterpretedResults)
      } as QueryEvaluatonInfo,
      result: {
        resultType: didRunSuccessfully
          ? messages.QueryResultType.SUCCESS
          : messages.QueryResultType.OTHER_ERROR
      } as messages.EvaluationResult,
      dispose: sandbox.spy(),
    };
  }

  async function createMockQueryHistory(allHistory: FullQueryInfo[]) {
    const qhm = new QueryHistoryManager(
      {} as QueryServerClient,
      'xxx',
      configListener,
      selectedCallback,
      doCompareCallback
    );
    (qhm.treeDataProvider as any).history = allHistory;
    await vscode.workspace.saveAll();

    return qhm;
  }
});
