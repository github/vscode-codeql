import {
  readJSONSync,
  ensureDirSync,
  copySync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "fs-extra";
import { join } from "path";

import { commands, ExtensionContext, Uri } from "vscode";
import { QueryHistoryConfig } from "../../../../src/config";
import { DatabaseManager } from "../../../../src/databases";
import { tmpDir, walkDirectory } from "../../../../src/helpers";
import { QueryHistoryManager } from "../../../../src/query-history";
import { DisposableBucket } from "../../disposable-bucket";
import { testDisposeHandler } from "../../test-dispose-handler";
import { HistoryItemLabelProvider } from "../../../../src/history-item-label-provider";
import { RemoteQueriesManager } from "../../../../src/remote-queries/remote-queries-manager";
import { ResultsView } from "../../../../src/interface";
import { EvalLogViewer } from "../../../../src/eval-log-viewer";
import { QueryRunner } from "../../../../src/queryRunner";
import { VariantAnalysisManager } from "../../../../src/remote-queries/variant-analysis-manager";
import { App } from "../../../../src/common/app";
import { createMockApp } from "../../../__mocks__/appMock";

// set a higher timeout since recursive delete may take a while, expecially on Windows.
jest.setTimeout(120000);

/**
 * Tests for variant analyses and how they interact with the query history manager.
 */

describe("Variant Analyses and QueryHistoryManager", () => {
  const EXTENSION_PATH = join(__dirname, "../../../../");
  const STORAGE_DIR = Uri.file(join(tmpDir.name, "variant-analysis")).fsPath;
  const asyncNoop = async () => {
    /** noop */
  };

  let app: App;
  let qhm: QueryHistoryManager;
  let rawQueryHistory: any;
  let disposables: DisposableBucket;

  const rehydrateVariantAnalysisStub = jest.fn();
  const removeVariantAnalysisStub = jest.fn();
  const showViewStub = jest.fn();

  const localQueriesResultsViewStub = {
    showResults: jest.fn(),
  } as any as ResultsView;
  const remoteQueriesManagerStub = {
    onRemoteQueryAdded: jest.fn(),
    onRemoteQueryRemoved: jest.fn(),
    onRemoteQueryStatusUpdate: jest.fn(),
    rehydrateRemoteQuery: jest.fn(),
    removeRemoteQuery: jest.fn(),
    openRemoteQueryResults: jest.fn(),
  } as any as RemoteQueriesManager;
  const variantAnalysisManagerStub = {
    onVariantAnalysisAdded: jest.fn(),
    onVariantAnalysisRemoved: jest.fn(),
    removeVariantAnalysis: removeVariantAnalysisStub,
    rehydrateVariantAnalysis: rehydrateVariantAnalysisStub,
    onVariantAnalysisStatusUpdated: jest.fn(),
    showView: showViewStub,
  } as any as VariantAnalysisManager;

  let executeCommandSpy: jest.SpiedFunction<typeof commands.executeCommand>;

  beforeEach(async () => {
    // Since these tests change the state of the query history manager, we need to copy the original
    // to a temporary folder where we can manipulate it for tests
    await copyHistoryState();

    disposables = new DisposableBucket();

    rawQueryHistory = readJSONSync(
      join(STORAGE_DIR, "workspace-query-history.json"),
    ).queries;

    app = createMockApp({});

    qhm = new QueryHistoryManager(
      app,
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

    executeCommandSpy = jest
      .spyOn(commands, "executeCommand")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    deleteHistoryState();
    disposables.dispose(testDisposeHandler);
  });

  it("should read query history that has variant analysis history items", async () => {
    await qhm.readQueryHistory();

    expect(rehydrateVariantAnalysisStub).toBeCalledTimes(2);
    expect(rehydrateVariantAnalysisStub).toHaveBeenNthCalledWith(
      1,
      rawQueryHistory[0].variantAnalysis,
    );
    expect(rehydrateVariantAnalysisStub).toHaveBeenNthCalledWith(
      2,
      rawQueryHistory[1].variantAnalysis,
    );

    expect(qhm.treeDataProvider.allHistory[0]).toEqual(rawQueryHistory[0]);
    expect(qhm.treeDataProvider.allHistory[1]).toEqual(rawQueryHistory[1]);
    expect(qhm.treeDataProvider.allHistory.length).toBe(2);
  });

  it("should remove the variant analysis history item", async () => {
    await qhm.readQueryHistory();

    // Remove the first variant analysis
    await qhm.handleRemoveHistoryItem(qhm.treeDataProvider.allHistory[0]);

    // Add it back to the history
    qhm.addQuery(rawQueryHistory[0]);
    expect(removeVariantAnalysisStub).toBeCalledTimes(1);
    expect(rehydrateVariantAnalysisStub).toBeCalledTimes(2);
    expect(qhm.treeDataProvider.allHistory).toEqual([
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

    expect(removeVariantAnalysisStub).toHaveBeenCalledTimes(2);
    expect(removeVariantAnalysisStub).toHaveBeenNthCalledWith(
      1,
      rawQueryHistory[1].variantAnalysis,
    );
    expect(removeVariantAnalysisStub).toHaveBeenNthCalledWith(
      2,
      rawQueryHistory[0].variantAnalysis,
    );
    expect(qhm.treeDataProvider.allHistory).toEqual([]);

    // also, both queries should be removed from disk storage
    expect(
      readJSONSync(join(STORAGE_DIR, "workspace-query-history.json")),
    ).toEqual({
      version: 2,
      queries: [],
    });
  });

  it("should handle a click", async () => {
    await qhm.readQueryHistory();

    await qhm.handleItemClicked(qhm.treeDataProvider.allHistory[0], []);
    expect(showViewStub).toBeCalledWith(rawQueryHistory[0].variantAnalysis.id);
  });

  it("should get the query text", async () => {
    await qhm.readQueryHistory();
    await qhm.handleShowQueryText(qhm.treeDataProvider.allHistory[0], []);

    expect(executeCommandSpy).toHaveBeenCalledWith(
      "codeQL.openVariantAnalysisQueryText",
      rawQueryHistory[0].variantAnalysis.id,
    );
  });

  async function copyHistoryState() {
    ensureDirSync(STORAGE_DIR);
    copySync(
      join(__dirname, "../data/variant-analysis/"),
      join(tmpDir.name, "variant-analysis"),
    );

    // also, replace the files with 'PLACEHOLDER' so that they have the correct directory
    for await (const p of walkDirectory(STORAGE_DIR)) {
      replacePlaceholder(join(p));
    }
  }

  function replacePlaceholder(filePath: string) {
    if (filePath.endsWith(".json")) {
      const newContents = readFileSync(filePath, "utf8").replaceAll(
        "PLACEHOLDER",
        STORAGE_DIR.replaceAll("\\", "/"),
      );
      writeFileSync(filePath, newContents, "utf8");
    }
  }

  function deleteHistoryState() {
    rmSync(STORAGE_DIR, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 100,
    });
  }
});
