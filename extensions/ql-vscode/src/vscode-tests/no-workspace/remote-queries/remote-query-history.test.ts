import * as fs from "fs-extra";
import * as path from "path";
import * as sinon from "sinon";
import { expect } from "chai";

import {
  CancellationToken,
  ExtensionContext,
  Uri,
  window,
  workspace,
} from "vscode";
import { QueryHistoryConfig } from "../../../config";
import { DatabaseManager } from "../../../databases";
import { tmpDir } from "../../../helpers";
import { QueryHistoryManager } from "../../../query-history";
import { Credentials } from "../../../authentication";
import { AnalysesResultsManager } from "../../../remote-queries/analyses-results-manager";
import { RemoteQueryResult } from "../../../remote-queries/shared/remote-query-result";
import { DisposableBucket } from "../../disposable-bucket";
import { testDisposeHandler } from "../../test-dispose-handler";
import { walkDirectory } from "../../../helpers";
import { getErrorMessage } from "../../../pure/helpers-pure";
import { HistoryItemLabelProvider } from "../../../history-item-label-provider";
import { RemoteQueriesManager } from "../../../remote-queries/remote-queries-manager";
import { ResultsView } from "../../../interface";
import { EvalLogViewer } from "../../../eval-log-viewer";
import { QueryRunner } from "../../../queryRunner";
import { VariantAnalysisManager } from "../../../remote-queries/variant-analysis-manager";

/**
 * Tests for remote queries and how they interact with the query history manager.
 */

describe("Remote queries and query history manager", function () {
  const EXTENSION_PATH = path.join(__dirname, "../../../../");
  const STORAGE_DIR = Uri.file(path.join(tmpDir.name, "remote-queries")).fsPath;
  const asyncNoop = async () => {
    /** noop */
  };

  let sandbox: sinon.SinonSandbox;
  let qhm: QueryHistoryManager;
  let localQueriesResultsViewStub: ResultsView;
  let remoteQueriesManagerStub: RemoteQueriesManager;
  let variantAnalysisManagerStub: VariantAnalysisManager;
  let rawQueryHistory: any;
  let remoteQueryResult0: RemoteQueryResult;
  let remoteQueryResult1: RemoteQueryResult;
  let disposables: DisposableBucket;
  let showTextDocumentSpy: sinon.SinonSpy;
  let openTextDocumentSpy: sinon.SinonSpy;

  let rehydrateRemoteQueryStub: sinon.SinonStub;
  let removeRemoteQueryStub: sinon.SinonStub;
  let openRemoteQueryResultsStub: sinon.SinonStub;

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

    rehydrateRemoteQueryStub = sandbox.stub();
    removeRemoteQueryStub = sandbox.stub();
    openRemoteQueryResultsStub = sandbox.stub();

    remoteQueriesManagerStub = {
      onRemoteQueryAdded: sandbox.stub(),
      onRemoteQueryRemoved: sandbox.stub(),
      onRemoteQueryStatusUpdate: sandbox.stub(),
      rehydrateRemoteQuery: rehydrateRemoteQueryStub,
      removeRemoteQuery: removeRemoteQueryStub,
      openRemoteQueryResults: openRemoteQueryResultsStub,
    } as any as RemoteQueriesManager;

    variantAnalysisManagerStub = {
      onVariantAnalysisAdded: sandbox.stub(),
      onVariantAnalysisStatusUpdated: sandbox.stub(),
      onVariantAnalysisRemoved: sandbox.stub(),
    } as any as VariantAnalysisManager;

    rawQueryHistory = fs.readJSONSync(
      path.join(STORAGE_DIR, "workspace-query-history.json"),
    ).queries;
    remoteQueryResult0 = fs.readJSONSync(
      path.join(
        STORAGE_DIR,
        "queries",
        rawQueryHistory[0].queryId,
        "query-result.json",
      ),
    );
    remoteQueryResult1 = fs.readJSONSync(
      path.join(
        STORAGE_DIR,
        "queries",
        rawQueryHistory[1].queryId,
        "query-result.json",
      ),
    );

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
    // set a higher timeout since recursive delete below may take a while, expecially on Windows.
    this.timeout(120000);
    deleteHistoryState();
    disposables.dispose(testDisposeHandler);
    sandbox.restore();
  });

  it("should read query history", async () => {
    await qhm.readQueryHistory();

    // Should have added the query history. Contents are directly from the file
    expect(rehydrateRemoteQueryStub).to.have.callCount(2);
    expect(rehydrateRemoteQueryStub.getCall(0).args[1]).to.deep.eq(
      rawQueryHistory[0].remoteQuery,
    );
    expect(rehydrateRemoteQueryStub.getCall(1).args[1]).to.deep.eq(
      rawQueryHistory[1].remoteQuery,
    );

    expect(qhm.treeDataProvider.allHistory[0]).to.deep.eq(rawQueryHistory[0]);
    expect(qhm.treeDataProvider.allHistory[1]).to.deep.eq(rawQueryHistory[1]);
    expect(qhm.treeDataProvider.allHistory.length).to.eq(2);
  });

  it("should remove and then add query from history", async () => {
    await qhm.readQueryHistory();

    // Remove the first query
    await qhm.handleRemoveHistoryItem(qhm.treeDataProvider.allHistory[0]);

    expect(removeRemoteQueryStub).calledOnceWithExactly(
      rawQueryHistory[0].queryId,
    );
    expect(rehydrateRemoteQueryStub).to.have.callCount(2);
    expect(rehydrateRemoteQueryStub.getCall(0).args[1]).to.deep.eq(
      rawQueryHistory[0].remoteQuery,
    );
    expect(rehydrateRemoteQueryStub.getCall(1).args[1]).to.deep.eq(
      rawQueryHistory[1].remoteQuery,
    );
    expect(openRemoteQueryResultsStub).calledOnceWithExactly(
      rawQueryHistory[1].queryId,
    );
    expect(qhm.treeDataProvider.allHistory).to.deep.eq(
      rawQueryHistory.slice(1),
    );

    // Add it back
    qhm.addQuery(rawQueryHistory[0]);
    expect(removeRemoteQueryStub).to.have.callCount(1);
    expect(rehydrateRemoteQueryStub).to.have.callCount(2);
    expect(qhm.treeDataProvider.allHistory).to.deep.eq([
      rawQueryHistory[1],
      rawQueryHistory[0],
    ]);
  });

  it("should remove two queries from history", async () => {
    await qhm.readQueryHistory();

    // Remove the both queries
    // Just for fun, let's do it in reverse order
    await qhm.handleRemoveHistoryItem(undefined!, [
      qhm.treeDataProvider.allHistory[1],
      qhm.treeDataProvider.allHistory[0],
    ]);

    expect(removeRemoteQueryStub.callCount).to.eq(2);
    expect(removeRemoteQueryStub.getCall(0).args[0]).to.eq(
      rawQueryHistory[1].queryId,
    );
    expect(removeRemoteQueryStub.getCall(1).args[0]).to.eq(
      rawQueryHistory[0].queryId,
    );
    expect(qhm.treeDataProvider.allHistory).to.deep.eq([]);

    // also, both queries should be removed from on disk storage
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
    expect(openRemoteQueryResultsStub).calledOnceWithExactly(
      rawQueryHistory[0].queryId,
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
      rawQueryHistory[0].remoteQuery.queryText,
    );
  });

  describe("AnalysisResultsManager", () => {
    let mockCredentials: any;
    let mockOctokit: any;
    let mockLogger: any;
    let mockCliServer: any;
    let arm: AnalysesResultsManager;

    beforeEach(() => {
      mockOctokit = {
        request: sandbox.stub(),
      };
      mockCredentials = {
        getOctokit: () => mockOctokit,
      };
      mockLogger = {
        log: sandbox.spy(),
      };
      mockCliServer = {
        bqrsInfo: sandbox.spy(),
        bqrsDecode: sandbox.spy(),
      };
      sandbox.stub(Credentials, "initialize").resolves(mockCredentials);

      arm = new AnalysesResultsManager(
        {} as ExtensionContext,
        mockCliServer,
        path.join(STORAGE_DIR, "queries"),
        mockLogger,
      );
    });

    it("should avoid re-downloading an analysis result", async () => {
      // because the analysis result is already in on disk, it should not be downloaded
      const publisher = sandbox.spy();
      const analysisSummary = remoteQueryResult0.analysisSummaries[0];
      await arm.downloadAnalysisResults(analysisSummary, publisher);

      // Should not have made the request since the analysis result is already on disk
      expect(mockOctokit.request).to.not.have.been.called;

      // result should have been published twice
      // first time, it is in progress
      expect(publisher.getCall(0).args[0][0]).to.include({
        nwo: "github/vscode-codeql",
        status: "InProgress",
        // interpretedResults: ... avoid checking the interpretedResults object since it is complex
      });

      // second time, it has the path to the sarif file.
      expect(publisher.getCall(1).args[0][0]).to.include({
        nwo: "github/vscode-codeql",
        status: "Completed",
        // interpretedResults: ... avoid checking the interpretedResults object since it is complex
      });
      expect(publisher).to.have.been.calledTwice;

      // result should be stored in the manager
      expect(arm.getAnalysesResults(rawQueryHistory[0].queryId)[0]).to.include({
        nwo: "github/vscode-codeql",
        status: "Completed",
        // interpretedResults: ... avoid checking the interpretedResults object since it is complex
      });
      publisher.resetHistory();

      // now, let's try to download it again. This time, since it's already in memory,
      // it should not even be re-published
      await arm.downloadAnalysisResults(analysisSummary, publisher);
      expect(publisher).to.not.have.been.called;
    });

    it("should download two artifacts at once", async () => {
      const publisher = sandbox.spy();
      const analysisSummaries = [
        remoteQueryResult0.analysisSummaries[0],
        remoteQueryResult0.analysisSummaries[1],
      ];
      await arm.loadAnalysesResults(analysisSummaries, undefined, publisher);

      const trimmed = publisher
        .getCalls()
        .map((call) => call.args[0])
        .map((args) => {
          args.forEach(
            (analysisResult: any) => delete analysisResult.interpretedResults,
          );
          return args;
        });

      // As before, but now both summaries should have been published
      expect(trimmed[0]).to.deep.eq([
        {
          nwo: "github/vscode-codeql",
          status: "InProgress",
          resultCount: 15,
          lastUpdated: 1653447088649,
          starCount: 1,
        },
      ]);

      expect(trimmed[1]).to.deep.eq([
        {
          nwo: "github/vscode-codeql",
          status: "InProgress",
          resultCount: 15,
          lastUpdated: 1653447088649,
          starCount: 1,
        },
        {
          nwo: "other/hucairz",
          status: "InProgress",
          resultCount: 15,
          lastUpdated: 1653447088649,
          starCount: 1,
        },
      ]);

      // there is a third call. It is non-deterministic if
      // github/vscode-codeql is completed first or other/hucairz is.
      // There is not much point in trying to test it if the other calls are correct.

      expect(trimmed[3]).to.deep.eq([
        {
          nwo: "github/vscode-codeql",
          status: "Completed",
          resultCount: 15,
          lastUpdated: 1653447088649,
          starCount: 1,
        },
        {
          nwo: "other/hucairz",
          status: "Completed",
          resultCount: 15,
          lastUpdated: 1653447088649,
          starCount: 1,
        },
      ]);

      expect(publisher).to.have.callCount(4);
    });

    it("should avoid publishing when the request is cancelled", async () => {
      const publisher = sandbox.spy();
      const analysisSummaries = [...remoteQueryResult0.analysisSummaries];

      try {
        await arm.loadAnalysesResults(
          analysisSummaries,
          {
            isCancellationRequested: true,
          } as CancellationToken,
          publisher,
        );
        expect.fail("Should have thrown");
      } catch (e) {
        expect(getErrorMessage(e)).to.contain("cancelled");
      }

      expect(publisher).not.to.have.been.called;
    });

    it("should get the analysis results", async () => {
      const publisher = sandbox.spy();
      const analysisSummaries0 = [
        remoteQueryResult0.analysisSummaries[0],
        remoteQueryResult0.analysisSummaries[1],
      ];
      const analysisSummaries1 = [...remoteQueryResult1.analysisSummaries];

      await arm.loadAnalysesResults(analysisSummaries0, undefined, publisher);
      await arm.loadAnalysesResults(analysisSummaries1, undefined, publisher);

      const result0 = arm.getAnalysesResults(rawQueryHistory[0].queryId);
      const result0Again = arm.getAnalysesResults(rawQueryHistory[0].queryId);

      // Shoule be equal, but not equivalent
      expect(result0).to.deep.eq(result0Again);
      expect(result0).not.to.eq(result0Again);

      const result1 = arm.getAnalysesResults(rawQueryHistory[1].queryId);
      const result1Again = arm.getAnalysesResults(rawQueryHistory[1].queryId);
      expect(result1).to.deep.eq(result1Again);
      expect(result1).not.to.eq(result1Again);
    });

    // This test is failing on windows in CI.
    it.skip("should read sarif", async () => {
      const publisher = sandbox.spy();
      const analysisSummaries0 = [remoteQueryResult0.analysisSummaries[0]];
      await arm.loadAnalysesResults(analysisSummaries0, undefined, publisher);

      const sarif = fs.readJSONSync(
        path.join(
          STORAGE_DIR,
          "queries",
          rawQueryHistory[0].queryId,
          "171543249",
          "results.sarif",
        ),
      );
      const queryResults = sarif.runs
        .flatMap((run: any) => run.results)
        .map((result: any) => ({ message: result.message.text }));

      expect(publisher.getCall(1).args[0][0].results).to.deep.eq(queryResults);
    });

    it("should check if an artifact is downloaded and not in memory", async () => {
      // Load remoteQueryResult0.analysisSummaries[1] into memory
      await arm.downloadAnalysisResults(
        remoteQueryResult0.analysisSummaries[1],
        () => Promise.resolve(),
      );

      // on disk
      expect(
        await (arm as any).isAnalysisDownloaded(
          remoteQueryResult0.analysisSummaries[0],
        ),
      ).to.be.true;

      // in memory
      expect(
        await (arm as any).isAnalysisDownloaded(
          remoteQueryResult0.analysisSummaries[1],
        ),
      ).to.be.true;

      // not downloaded
      expect(
        await (arm as any).isAnalysisDownloaded(
          remoteQueryResult0.analysisSummaries[2],
        ),
      ).to.be.false;
    });

    it("should load downloaded artifacts", async () => {
      await arm.loadDownloadedAnalyses(remoteQueryResult0.analysisSummaries);
      const queryId = rawQueryHistory[0].queryId;
      const analysesResultsNwos = arm
        .getAnalysesResults(queryId)
        .map((ar) => ar.nwo)
        .sort();
      expect(analysesResultsNwos[0]).to.eq("github/vscode-codeql");
      expect(analysesResultsNwos[1]).to.eq("other/hucairz");
      expect(analysesResultsNwos.length).to.eq(2);
    });
  });

  async function copyHistoryState() {
    fs.ensureDirSync(STORAGE_DIR);
    fs.copySync(
      path.join(__dirname, "../data/remote-queries/"),
      path.join(tmpDir.name, "remote-queries"),
    );

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
      retryDelay: 100,
    });
  }

  function replacePlaceholder(filePath: string) {
    if (filePath.endsWith(".json")) {
      const newContents = fs
        .readFileSync(filePath, "utf8")
        .replaceAll("PLACEHOLDER", STORAGE_DIR.replaceAll("\\", "/"));
      fs.writeFileSync(filePath, newContents, "utf8");
    }
  }
});
