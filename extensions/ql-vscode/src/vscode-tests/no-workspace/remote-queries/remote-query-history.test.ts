import * as fs from "fs-extra";
import * as path from "path";

import {
  CancellationToken,
  ExtensionContext,
  TextDocument,
  TextEditor,
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
import { HistoryItemLabelProvider } from "../../../history-item-label-provider";
import { RemoteQueriesManager } from "../../../remote-queries/remote-queries-manager";
import { ResultsView } from "../../../interface";
import { EvalLogViewer } from "../../../eval-log-viewer";
import { QueryRunner } from "../../../queryRunner";
import { VariantAnalysisManager } from "../../../remote-queries/variant-analysis-manager";

// set a higher timeout since recursive delete may take a while, expecially on Windows.
jest.setTimeout(120000);

/**
 * Tests for remote queries and how they interact with the query history manager.
 */

describe("Remote queries and query history manager", () => {
  const EXTENSION_PATH = path.join(__dirname, "../../../../");
  const STORAGE_DIR = Uri.file(path.join(tmpDir.name, "remote-queries")).fsPath;
  const asyncNoop = async () => {
    /** noop */
  };

  let qhm: QueryHistoryManager;
  const localQueriesResultsViewStub = {
    showResults: jest.fn(),
  } as any as ResultsView;
  let rawQueryHistory: any;
  let remoteQueryResult0: RemoteQueryResult;
  let remoteQueryResult1: RemoteQueryResult;
  let disposables: DisposableBucket;

  const rehydrateRemoteQueryStub = jest.fn();
  const removeRemoteQueryStub = jest.fn();
  const openRemoteQueryResultsStub = jest.fn();

  const remoteQueriesManagerStub = {
    onRemoteQueryAdded: jest.fn(),
    onRemoteQueryRemoved: jest.fn(),
    onRemoteQueryStatusUpdate: jest.fn(),
    rehydrateRemoteQuery: rehydrateRemoteQueryStub,
    removeRemoteQuery: removeRemoteQueryStub,
    openRemoteQueryResults: openRemoteQueryResultsStub,
  } as any as RemoteQueriesManager;

  const variantAnalysisManagerStub = {
    onVariantAnalysisAdded: jest.fn(),
    onVariantAnalysisStatusUpdated: jest.fn(),
    onVariantAnalysisRemoved: jest.fn(),
  } as any as VariantAnalysisManager;

  const showTextDocumentSpy = jest.spyOn(window, "showTextDocument");
  const openTextDocumentSpy = jest.spyOn(workspace, "openTextDocument");

  beforeEach(async () => {
    // Since these tests change the state of the query history manager, we need to copy the original
    // to a temporary folder where we can manipulate it for tests
    await copyHistoryState();

    disposables = new DisposableBucket();

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

    showTextDocumentSpy.mockResolvedValue(undefined as unknown as TextEditor);
    openTextDocumentSpy.mockResolvedValue(undefined as unknown as TextDocument);
  });

  afterEach(() => {
    deleteHistoryState();
    disposables.dispose(testDisposeHandler);
  });

  it("should read query history", async () => {
    await qhm.readQueryHistory();

    // Should have added the query history. Contents are directly from the file
    expect(rehydrateRemoteQueryStub).toBeCalledTimes(2);
    expect(rehydrateRemoteQueryStub).toHaveBeenNthCalledWith(
      1,
      rawQueryHistory[0].queryId,
      rawQueryHistory[0].remoteQuery,
      rawQueryHistory[0].status,
    );
    expect(rehydrateRemoteQueryStub).toHaveBeenNthCalledWith(
      2,
      rawQueryHistory[1].queryId,
      rawQueryHistory[1].remoteQuery,
      rawQueryHistory[1].status,
    );

    expect(qhm.treeDataProvider.allHistory[0]).toEqual(rawQueryHistory[0]);
    expect(qhm.treeDataProvider.allHistory[1]).toEqual(rawQueryHistory[1]);
    expect(qhm.treeDataProvider.allHistory.length).toBe(2);
  });

  it("should remove and then add query from history", async () => {
    await qhm.readQueryHistory();

    // Remove the first query
    await qhm.handleRemoveHistoryItem(qhm.treeDataProvider.allHistory[0]);

    expect(removeRemoteQueryStub).toHaveBeenCalledWith(
      rawQueryHistory[0].queryId,
    );
    expect(rehydrateRemoteQueryStub).toBeCalledTimes(2);
    expect(rehydrateRemoteQueryStub).toHaveBeenNthCalledWith(
      1,
      rawQueryHistory[0].queryId,
      rawQueryHistory[0].remoteQuery,
      rawQueryHistory[0].status,
    );
    expect(rehydrateRemoteQueryStub).toHaveBeenNthCalledWith(
      2,
      rawQueryHistory[1].queryId,
      rawQueryHistory[1].remoteQuery,
      rawQueryHistory[1].status,
    );
    expect(openRemoteQueryResultsStub).toHaveBeenCalledWith(
      rawQueryHistory[1].queryId,
    );
    expect(qhm.treeDataProvider.allHistory).toEqual(rawQueryHistory.slice(1));

    // Add it back
    qhm.addQuery(rawQueryHistory[0]);
    expect(removeRemoteQueryStub).toBeCalledTimes(1);
    expect(rehydrateRemoteQueryStub).toBeCalledTimes(2);
    expect(qhm.treeDataProvider.allHistory).toEqual([
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

    expect(removeRemoteQueryStub).toHaveBeenCalledTimes(2);
    expect(removeRemoteQueryStub).toHaveBeenNthCalledWith(
      1,
      rawQueryHistory[1].queryId,
    );
    expect(removeRemoteQueryStub).toHaveBeenNthCalledWith(
      2,
      rawQueryHistory[0].queryId,
    );
    expect(qhm.treeDataProvider.allHistory).toEqual([]);

    // also, both queries should be removed from on disk storage
    expect(
      fs.readJSONSync(path.join(STORAGE_DIR, "workspace-query-history.json")),
    ).toEqual({
      version: 2,
      queries: [],
    });
  });

  it("should handle a click", async () => {
    await qhm.readQueryHistory();

    await qhm.handleItemClicked(qhm.treeDataProvider.allHistory[0], []);
    expect(openRemoteQueryResultsStub).toHaveBeenCalledWith(
      rawQueryHistory[0].queryId,
    );
  });

  it("should get the query text", async () => {
    await qhm.readQueryHistory();
    await qhm.handleShowQueryText(qhm.treeDataProvider.allHistory[0], []);

    expect(showTextDocumentSpy).toBeCalledTimes(1);
    expect(openTextDocumentSpy).toBeCalledTimes(1);

    const uri: Uri = openTextDocumentSpy.mock.calls[0][0] as Uri;
    expect(uri.scheme).toBe("codeql");
    const params = new URLSearchParams(uri.query);
    expect(params.get("isQuickEval")).toBe("false");
    expect(params.get("queryText")).toBe(
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
        request: jest.fn(),
      };
      mockCredentials = {
        getOctokit: () => mockOctokit,
      };
      mockLogger = {
        log: jest.fn(),
      };
      mockCliServer = {
        bqrsInfo: jest.fn(),
        bqrsDecode: jest.fn(),
      };
      jest.spyOn(Credentials, "initialize").mockResolvedValue(mockCredentials);

      arm = new AnalysesResultsManager(
        {} as ExtensionContext,
        mockCliServer,
        path.join(STORAGE_DIR, "queries"),
        mockLogger,
      );
    });

    it("should avoid re-downloading an analysis result", async () => {
      // because the analysis result is already in on disk, it should not be downloaded
      const publisher = jest.fn();
      const analysisSummary = remoteQueryResult0.analysisSummaries[0];
      await arm.downloadAnalysisResults(analysisSummary, publisher);

      // Should not have made the request since the analysis result is already on disk
      expect(mockOctokit.request).not.toBeCalled();

      // result should have been published twice
      expect(publisher).toHaveBeenCalledTimes(2);

      // first time, it is in progress
      expect(publisher).toHaveBeenNthCalledWith(1, [
        expect.objectContaining({
          nwo: "github/vscode-codeql",
          status: "InProgress",
          interpretedResults: expect.anything(), // avoid checking the interpretedResults object since it is complex
        }),
      ]);

      // second time, it has the path to the sarif file.
      expect(publisher).toHaveBeenNthCalledWith(2, [
        expect.objectContaining({
          nwo: "github/vscode-codeql",
          status: "Completed",
          interpretedResults: expect.anything(), // avoid checking the interpretedResults object since it is complex
        }),
      ]);

      // result should be stored in the manager
      expect(
        arm.getAnalysesResults(rawQueryHistory[0].queryId)[0],
      ).toMatchObject({
        nwo: "github/vscode-codeql",
        status: "Completed",
        // interpretedResults: ... avoid checking the interpretedResults object since it is complex
      });
      publisher.mockClear();

      // now, let's try to download it again. This time, since it's already in memory,
      // it should not even be re-published
      await arm.downloadAnalysisResults(analysisSummary, publisher);
      expect(publisher).not.toBeCalled();
    });

    it("should download two artifacts at once", async () => {
      const publisher = jest.fn();
      const analysisSummaries = [
        remoteQueryResult0.analysisSummaries[0],
        remoteQueryResult0.analysisSummaries[1],
      ];
      await arm.loadAnalysesResults(analysisSummaries, undefined, publisher);

      const trimmed = publisher.mock.calls
        .map((call) => call[0])
        .map((args) => {
          args.forEach(
            (analysisResult: any) => delete analysisResult.interpretedResults,
          );
          return args;
        });

      // As before, but now both summaries should have been published
      expect(trimmed[0]).toEqual([
        {
          nwo: "github/vscode-codeql",
          status: "InProgress",
          resultCount: 15,
          lastUpdated: 1653447088649,
          starCount: 1,
        },
      ]);

      expect(trimmed[1]).toEqual([
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

      expect(trimmed[3]).toEqual([
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

      expect(publisher).toBeCalledTimes(4);
    });

    it("should avoid publishing when the request is cancelled", async () => {
      const publisher = jest.fn();
      const analysisSummaries = [...remoteQueryResult0.analysisSummaries];

      await expect(
        arm.loadAnalysesResults(
          analysisSummaries,
          {
            isCancellationRequested: true,
          } as CancellationToken,
          publisher,
        ),
      ).rejects.toThrow(/cancelled/);

      expect(publisher).not.toBeCalled();
    });

    it("should get the analysis results", async () => {
      const publisher = jest.fn();
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
      expect(result0).toEqual(result0Again);
      expect(result0).not.toBe(result0Again);

      const result1 = arm.getAnalysesResults(rawQueryHistory[1].queryId);
      const result1Again = arm.getAnalysesResults(rawQueryHistory[1].queryId);
      expect(result1).toEqual(result1Again);
      expect(result1).not.toBe(result1Again);
    });

    // This test is failing on windows in CI.
    it.skip("should read sarif", async () => {
      const publisher = jest.fn();
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

      expect(publisher).toHaveBeenNthCalledWith(2, [
        {
          results: queryResults,
        },
      ]);
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
      ).toBe(true);

      // in memory
      expect(
        await (arm as any).isAnalysisDownloaded(
          remoteQueryResult0.analysisSummaries[1],
        ),
      ).toBe(true);

      // not downloaded
      expect(
        await (arm as any).isAnalysisDownloaded(
          remoteQueryResult0.analysisSummaries[2],
        ),
      ).toBe(false);
    });

    it("should load downloaded artifacts", async () => {
      await arm.loadDownloadedAnalyses(remoteQueryResult0.analysisSummaries);
      const queryId = rawQueryHistory[0].queryId;
      const analysesResultsNwos = arm
        .getAnalysesResults(queryId)
        .map((ar) => ar.nwo)
        .sort();
      expect(analysesResultsNwos[0]).toBe("github/vscode-codeql");
      expect(analysesResultsNwos[1]).toBe("other/hucairz");
      expect(analysesResultsNwos.length).toBe(2);
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
