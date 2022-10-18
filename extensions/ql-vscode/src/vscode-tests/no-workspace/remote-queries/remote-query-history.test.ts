import * as fs from 'fs-extra';
import * as path from 'path';
import * as sinon from 'sinon';
import { expect } from 'chai';

import { ExtensionContext, Uri, window, workspace } from 'vscode';
import { QueryHistoryConfig } from '../../../config';
import { DatabaseManager } from '../../../databases';
import { tmpDir } from '../../../helpers';
import { QueryHistoryManager } from '../../../query-history';
import { DisposableBucket } from '../../disposable-bucket';
import { testDisposeHandler } from '../../test-dispose-handler';
import { walkDirectory } from '../../../helpers';
import { HistoryItemLabelProvider } from '../../../history-item-label-provider';
import { RemoteQueriesManager } from '../../../remote-queries/remote-queries-manager';
import { ResultsView } from '../../../interface';
import { EvalLogViewer } from '../../../eval-log-viewer';
import { QueryRunner } from '../../../queryRunner';
import { VariantAnalysisManager } from '../../../remote-queries/variant-analysis-manager';

/**
 * Tests for remote queries and how they interact with the query history manager.
 */

describe('Remote queries and query history manager', function() {

  const EXTENSION_PATH = path.join(__dirname, '../../../../');
  const STORAGE_DIR = Uri.file(path.join(tmpDir.name, 'remote-queries')).fsPath;
  const asyncNoop = async () => { /** noop */ };

  let sandbox: sinon.SinonSandbox;
  let qhm: QueryHistoryManager;
  let localQueriesResultsViewStub: ResultsView;
  let remoteQueriesManagerStub: RemoteQueriesManager;
  let variantAnalysisManagerStub: VariantAnalysisManager;
  let rawQueryHistory: any;
  let disposables: DisposableBucket;
  let showTextDocumentSpy: sinon.SinonSpy;
  let openTextDocumentSpy: sinon.SinonSpy;

  let rehydrateRemoteQueryStub: sinon.SinonStub;
  let removeRemoteQueryStub: sinon.SinonStub;
  let openRemoteQueryResultsStub: sinon.SinonStub;

  beforeEach(async function() {

    // set a higher timeout since recursive delete below may take a while, expecially on Windows.
    this.timeout(120000);

    // Since these tests change the state of the query history manager, we need to copy the original
    // to a temporary folder where we can manipulate it for tests
    await copyHistoryState();

    sandbox = sinon.createSandbox();

    localQueriesResultsViewStub = {
      showResults: sandbox.stub()
    } as any as ResultsView;

    rehydrateRemoteQueryStub = sandbox.stub();
    removeRemoteQueryStub = sandbox.stub();
    openRemoteQueryResultsStub = sandbox.stub();

    remoteQueriesManagerStub = {
      onRemoteQueryAdded: sandbox.stub(),
      onRemoteQueryRemoved: sandbox.stub(),
      onRemoteQueryStatusUpdate: sandbox.stub(),
      rehydrateRemoteQuery: rehydrateRemoteQueryStub,
      removeRemoteQuery: removeRemoteQueryStub,
      openRemoteQueryResults: openRemoteQueryResultsStub
    } as any as RemoteQueriesManager;

    variantAnalysisManagerStub = {
      onVariantAnalysisAdded: sandbox.stub()
    } as any as VariantAnalysisManager;
  });

  afterEach(function() {
    // set a higher timeout since recursive delete below may take a while, expecially on Windows.
    this.timeout(120000);
    deleteHistoryState();
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    disposables = new DisposableBucket();

    rawQueryHistory = fs.readJSONSync(path.join(STORAGE_DIR, 'workspace-query-history.json')).queries;

    qhm = new QueryHistoryManager(
      {} as QueryRunner,
      {} as DatabaseManager,
      localQueriesResultsViewStub,
      remoteQueriesManagerStub,
      variantAnalysisManagerStub,
      {} as EvalLogViewer,
      STORAGE_DIR,
      {
        globalStorageUri: Uri.file(STORAGE_DIR),
        extensionPath: EXTENSION_PATH
      } as ExtensionContext,
      {
        onDidChangeConfiguration: () => new DisposableBucket(),
      } as unknown as QueryHistoryConfig,
      new HistoryItemLabelProvider({} as QueryHistoryConfig),
      asyncNoop
    );
    disposables.push(qhm);

    showTextDocumentSpy = sandbox.spy(window, 'showTextDocument');
    openTextDocumentSpy = sandbox.spy(workspace, 'openTextDocument');
  });

  afterEach(() => {
    disposables.dispose(testDisposeHandler);
    sandbox.restore();
  });

  it('should read query history', async () => {
    await qhm.readQueryHistory();

    // Should have added the query history. Contents are directly from the file
    expect(rehydrateRemoteQueryStub).to.have.callCount(2);
    expect(rehydrateRemoteQueryStub.getCall(0).args[1]).to.deep.eq(rawQueryHistory[0].remoteQuery);
    expect(rehydrateRemoteQueryStub.getCall(1).args[1]).to.deep.eq(rawQueryHistory[1].remoteQuery);

    expect(qhm.treeDataProvider.allHistory[0]).to.deep.eq(rawQueryHistory[0]);
    expect(qhm.treeDataProvider.allHistory[1]).to.deep.eq(rawQueryHistory[1]);
    expect(qhm.treeDataProvider.allHistory.length).to.eq(2);
  });

  it('should remove and then add query from history', async () => {
    await qhm.readQueryHistory();

    // Remove the first query
    await qhm.handleRemoveHistoryItem(qhm.treeDataProvider.allHistory[0]);

    expect(removeRemoteQueryStub).calledOnceWithExactly(rawQueryHistory[0].queryId);
    expect(rehydrateRemoteQueryStub).to.have.callCount(2);
    expect(rehydrateRemoteQueryStub.getCall(0).args[1]).to.deep.eq(rawQueryHistory[0].remoteQuery);
    expect(rehydrateRemoteQueryStub.getCall(1).args[1]).to.deep.eq(rawQueryHistory[1].remoteQuery);
    expect(openRemoteQueryResultsStub).calledOnceWithExactly(rawQueryHistory[1].queryId);
    expect(qhm.treeDataProvider.allHistory).to.deep.eq(rawQueryHistory.slice(1));

    // Add it back
    qhm.addQuery(rawQueryHistory[0]);
    expect(removeRemoteQueryStub).to.have.callCount(1);
    expect(rehydrateRemoteQueryStub).to.have.callCount(2);
    expect(qhm.treeDataProvider.allHistory).to.deep.eq([rawQueryHistory[1], rawQueryHistory[0]]);
  });

  it('should remove two queries from history', async () => {
    await qhm.readQueryHistory();

    // Remove the both queries
    // Just for fun, let's do it in reverse order
    await qhm.handleRemoveHistoryItem(undefined!, [qhm.treeDataProvider.allHistory[1], qhm.treeDataProvider.allHistory[0]]);

    expect(removeRemoteQueryStub.callCount).to.eq(2);
    expect(removeRemoteQueryStub.getCall(0).args[0]).to.eq(rawQueryHistory[1].queryId);
    expect(removeRemoteQueryStub.getCall(1).args[0]).to.eq(rawQueryHistory[0].queryId);
    expect(qhm.treeDataProvider.allHistory).to.deep.eq([]);

    // also, both queries should be removed from on disk storage
    expect(fs.readJSONSync(path.join(STORAGE_DIR, 'workspace-query-history.json'))).to.deep.eq({
      version: 2,
      queries: []
    });
  });

  it('should handle a click', async () => {
    await qhm.readQueryHistory();

    await qhm.handleItemClicked(qhm.treeDataProvider.allHistory[0], []);
    expect(openRemoteQueryResultsStub).calledOnceWithExactly(rawQueryHistory[0].queryId);
  });

  it('should get the query text', async () => {
    await qhm.readQueryHistory();
    await qhm.handleShowQueryText(qhm.treeDataProvider.allHistory[0], []);

    expect(showTextDocumentSpy).to.have.been.calledOnce;
    expect(openTextDocumentSpy).to.have.been.calledOnce;

    const uri: Uri = openTextDocumentSpy.getCall(0).args[0];
    expect(uri.scheme).to.eq('codeql');
    const params = new URLSearchParams(uri.query);
    expect(params.get('isQuickEval')).to.eq('false');
    expect(params.get('queryText')).to.eq(rawQueryHistory[0].remoteQuery.queryText);
  });

  async function copyHistoryState() {
    fs.ensureDirSync(STORAGE_DIR);
    fs.copySync(path.join(__dirname, '../data/remote-queries/'), path.join(tmpDir.name, 'remote-queries'));

    // also, replace the files with "PLACEHOLDER" so that they have the correct directory
    for await (const p of walkDirectory(STORAGE_DIR)) {
      replacePlaceholder(path.join(p));
    }
  }

  function deleteHistoryState() {
    fs.rmSync(STORAGE_DIR, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100
    });
  }

  function replacePlaceholder(filePath: string) {
    if (filePath.endsWith('.json')) {
      const newContents = fs.readFileSync(filePath, 'utf8').replaceAll('PLACEHOLDER', STORAGE_DIR.replaceAll('\\', '/'));
      fs.writeFileSync(filePath, newContents, 'utf8');
    }
  }
});
