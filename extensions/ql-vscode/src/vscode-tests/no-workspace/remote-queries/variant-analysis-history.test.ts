import * as fs from "fs-extra";
import * as path from "path";
import * as sinon from "sinon";
import { expect } from "chai";

import { ExtensionContext, Uri, window, workspace } from "vscode";
import { QueryHistoryConfig } from "../../../config";
import { DatabaseManager } from "../../../databases";
import { tmpDir } from "../../../helpers";
import { QueryHistoryManager } from "../../../query-history";
import { DisposableBucket } from "../../disposable-bucket";
import { testDisposeHandler } from "../../test-dispose-handler";
import { walkDirectory } from "../../../helpers";
import { HistoryItemLabelProvider } from "../../../history-item-label-provider";
import { RemoteQueriesManager } from "../../../remote-queries/remote-queries-manager";
import { ResultsView } from "../../../interface";
import { EvalLogViewer } from "../../../eval-log-viewer";
import { QueryRunner } from "../../../queryRunner";
import { VariantAnalysisManager } from "../../../remote-queries/variant-analysis-manager";

/**
 * Tests for variant analyses and how they interact with the query history manager.
 */

describe("Variant Analyses and QueryHistoryManager", function () {
  const EXTENSION_PATH = path.join(__dirname, "../../../../");
  const STORAGE_DIR = Uri.file(
    path.join(tmpDir.name, "variant-analysis"),
  ).fsPath;
  const asyncNoop = async () => {
    /** noop */
  };

  let sandbox: sinon.SinonSandbox;
  let qhm: QueryHistoryManager;
  let localQueriesResultsViewStub: ResultsView;
  let remoteQueriesManagerStub: RemoteQueriesManager;
  let variantAnalysisManagerStub: VariantAnalysisManager;
  let rawQueryHistory: any;
  let disposables: DisposableBucket;
  let showTextDocumentSpy: sinon.SinonSpy;
  let openTextDocumentSpy: sinon.SinonSpy;

  let rehydrateVariantAnalysisStub: sinon.SinonStub;
  let removeVariantAnalysisStub: sinon.SinonStub;
  let showViewStub: sinon.SinonStub;

  beforeEach(async function () {
    // set a higher timeout since recursive delete below may take a while, expecially on Windows.
    this.timeout(120000);

    // Since these tests change the state of the query history manager, we need to copy the original
    // to a temporary folder where we can manipulate it for tests
    await copyHistoryState();

    sandbox = sinon.createSandbox();
    disposables = new DisposableBucket();

    localQueriesResultsViewStub = {
      showResults: sandbox.stub(),
    } as any as ResultsView;

    rehydrateVariantAnalysisStub = sandbox.stub();
    removeVariantAnalysisStub = sandbox.stub();
    showViewStub = sandbox.stub();

    remoteQueriesManagerStub = {
      onRemoteQueryAdded: sandbox.stub(),
      onRemoteQueryRemoved: sandbox.stub(),
      onRemoteQueryStatusUpdate: sandbox.stub(),
      rehydrateRemoteQuery: sandbox.stub(),
      openRemoteQueryResults: sandbox.stub(),
    } as any as RemoteQueriesManager;

    variantAnalysisManagerStub = {
      onVariantAnalysisAdded: sandbox.stub(),
      onVariantAnalysisRemoved: sandbox.stub(),
      removeVariantAnalysis: removeVariantAnalysisStub,
      rehydrateVariantAnalysis: rehydrateVariantAnalysisStub,
      onVariantAnalysisStatusUpdated: sandbox.stub(),
      showView: showViewStub,
    } as any as VariantAnalysisManager;

    rawQueryHistory = fs.readJSONSync(
      path.join(STORAGE_DIR, "workspace-query-history.json"),
    ).queries;

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
        extensionPath: EXTENSION_PATH,
      } as ExtensionContext,
      {
        onDidChangeConfiguration: () => new DisposableBucket(),
      } as unknown as QueryHistoryConfig,
      new HistoryItemLabelProvider({} as QueryHistoryConfig),
      asyncNoop,
    );
    disposables.push(qhm);

    showTextDocumentSpy = sandbox.spy(window, "showTextDocument");
    openTextDocumentSpy = sandbox.spy(workspace, "openTextDocument");
  });

  afterEach(function () {
    deleteHistoryState();
    disposables.dispose(testDisposeHandler);
    sandbox.restore();
  });

  it("should read query history that has variant analysis history items", async () => {
    await qhm.readQueryHistory();

    expect(rehydrateVariantAnalysisStub).to.have.callCount(2);
    expect(rehydrateVariantAnalysisStub.getCall(0).args[0]).to.deep.eq(
      rawQueryHistory[0].variantAnalysis,
    );
    expect(rehydrateVariantAnalysisStub.getCall(1).args[0]).to.deep.eq(
      rawQueryHistory[1].variantAnalysis,
    );

    expect(qhm.treeDataProvider.allHistory[0]).to.deep.eq(rawQueryHistory[0]);
    expect(qhm.treeDataProvider.allHistory[1]).to.deep.eq(rawQueryHistory[1]);
    expect(qhm.treeDataProvider.allHistory.length).to.eq(2);
  });

  it("should remove the variant analysis history item", async () => {
    await qhm.readQueryHistory();

    // Remove the first variant analysis
    await qhm.handleRemoveHistoryItem(qhm.treeDataProvider.allHistory[0]);

    // Add it back to the history
    qhm.addQuery(rawQueryHistory[0]);
    expect(removeVariantAnalysisStub).to.have.callCount(1);
    expect(rehydrateVariantAnalysisStub).to.have.callCount(2);
    expect(qhm.treeDataProvider.allHistory).to.deep.eq([
      rawQueryHistory[1],
      rawQueryHistory[0],
    ]);
  });

  it("should remove two queries from history", async () => {
    await qhm.readQueryHistory();

    // Remove both queries
    // Just for fun, let's do it in reverse order
    await qhm.handleRemoveHistoryItem(undefined!, [
      qhm.treeDataProvider.allHistory[1],
      qhm.treeDataProvider.allHistory[0],
    ]);

    expect(removeVariantAnalysisStub.callCount).to.eq(2);
    expect(removeVariantAnalysisStub.getCall(0).args[0]).to.deep.eq(
      rawQueryHistory[1].variantAnalysis,
    );
    expect(removeVariantAnalysisStub.getCall(1).args[0]).to.deep.eq(
      rawQueryHistory[0].variantAnalysis,
    );
    expect(qhm.treeDataProvider.allHistory).to.deep.eq([]);

    // also, both queries should be removed from disk storage
    expect(
      fs.readJSONSync(path.join(STORAGE_DIR, "workspace-query-history.json")),
    ).to.deep.eq({
      version: 2,
      queries: [],
    });
  });

  it("should handle a click", async () => {
    await qhm.readQueryHistory();

    await qhm.handleItemClicked(qhm.treeDataProvider.allHistory[0], []);
    expect(showViewStub).calledOnceWithExactly(
      rawQueryHistory[0].variantAnalysis.id,
    );
  });

  it("should get the query text", async () => {
    await qhm.readQueryHistory();
    await qhm.handleShowQueryText(qhm.treeDataProvider.allHistory[0], []);

    expect(showTextDocumentSpy).to.have.been.calledOnce;
    expect(openTextDocumentSpy).to.have.been.calledOnce;

    const uri: Uri = openTextDocumentSpy.getCall(0).args[0];
    expect(uri.scheme).to.eq("codeql");
    const params = new URLSearchParams(uri.query);
    expect(params.get("isQuickEval")).to.eq("false");
    expect(params.get("queryText")).to.eq(
      rawQueryHistory[0].variantAnalysis.query.text,
    );
  });

  async function copyHistoryState() {
    fs.ensureDirSync(STORAGE_DIR);
    fs.copySync(
      path.join(__dirname, "../data/variant-analysis/"),
      path.join(tmpDir.name, "variant-analysis"),
    );

    // also, replace the files with 'PLACEHOLDER' so that they have the correct directory
    for await (const p of walkDirectory(STORAGE_DIR)) {
      replacePlaceholder(path.join(p));
    }
  }

  function replacePlaceholder(filePath: string) {
    if (filePath.endsWith(".json")) {
      const newContents = fs
        .readFileSync(filePath, "utf8")
        .replaceAll("PLACEHOLDER", STORAGE_DIR.replaceAll("\\", "/"));
      fs.writeFileSync(filePath, newContents, "utf8");
    }
  }

  function deleteHistoryState() {
    fs.rmSync(STORAGE_DIR, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
});
