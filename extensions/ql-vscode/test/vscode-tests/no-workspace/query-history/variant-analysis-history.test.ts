import {
  readJSONSync,
  ensureDirSync,
  copySync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "fs-extra";
import { join } from "path";

import type { ExtensionContext } from "vscode";
import { Uri } from "vscode";
import type { DatabaseManager } from "../../../../src/databases/local-databases";
import { tmpDir } from "../../../../src/tmp-dir";
import { walkDirectory } from "../../../../src/common/files";
import { DisposableBucket } from "../../disposable-bucket";
import { testDisposeHandler } from "../../test-dispose-handler";
import { HistoryItemLabelProvider } from "../../../../src/query-history/history-item-label-provider";
import type { ResultsView } from "../../../../src/local-queries";
import type { EvalLogViewer } from "../../../../src/query-evaluation-logging";
import type { QueryRunner } from "../../../../src/query-server/query-runner";
import type { VariantAnalysisManager } from "../../../../src/variant-analysis/variant-analysis-manager";
import { QueryHistoryManager } from "../../../../src/query-history/query-history-manager";
import { mockedObject } from "../../utils/mocking.helpers";
import { createMockQueryHistoryDirs } from "../../../factories/query-history/query-history-dirs";
import { createMockApp } from "../../../__mocks__/appMock";
import { LanguageContextStore } from "../../../../src/language-context-store";
import { mapQueryHistoryVariantAnalysisToDomainModel } from "../../../../src/query-history/store/query-history-variant-analysis-dto-mapper";
import type { VariantAnalysisHistoryItem } from "../../../../src/query-history/variant-analysis-history-item";

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

  let qhm: QueryHistoryManager;
  let queryHistory: VariantAnalysisHistoryItem[];
  let disposables: DisposableBucket;

  const rehydrateVariantAnalysisStub = jest.fn();
  const removeVariantAnalysisStub = jest.fn();
  const showViewStub = jest.fn();

  const localQueriesResultsViewStub = {
    showResults: jest.fn(),
  } as any as ResultsView;
  const variantAnalysisManagerStub = {
    onVariantAnalysisAdded: jest.fn(),
    onVariantAnalysisRemoved: jest.fn(),
    removeVariantAnalysis: removeVariantAnalysisStub,
    rehydrateVariantAnalysis: rehydrateVariantAnalysisStub,
    onVariantAnalysisStatusUpdated: jest.fn(),
    showView: showViewStub,
    openQueryText: jest.fn(),
  } as any as VariantAnalysisManager;

  let openQueryTextSpy: jest.SpiedFunction<
    typeof variantAnalysisManagerStub.openQueryText
  >;

  beforeEach(async () => {
    // Since these tests change the state of the query history manager, we need to copy the original
    // to a temporary folder where we can manipulate it for tests
    await copyHistoryState();

    disposables = new DisposableBucket();

    queryHistory = readJSONSync(
      join(STORAGE_DIR, "workspace-query-history.json"),
    ).queries.map(mapQueryHistoryVariantAnalysisToDomainModel);

    const app = createMockApp({});

    qhm = new QueryHistoryManager(
      app,
      {} as QueryRunner,
      {} as DatabaseManager,
      localQueriesResultsViewStub,
      variantAnalysisManagerStub,
      {} as EvalLogViewer,
      createMockQueryHistoryDirs({ localQueriesDirPath: STORAGE_DIR }),
      mockedObject<ExtensionContext>({
        globalStorageUri: Uri.file(STORAGE_DIR),
        storageUri: undefined,
        extensionPath: EXTENSION_PATH,
      }),
      {
        format: "",
        ttlInMillis: 0,
        onDidChangeConfiguration: () => new DisposableBucket(),
      },
      new HistoryItemLabelProvider({
        format: "",
        ttlInMillis: 0,
        onDidChangeConfiguration: jest.fn(),
      }),
      new LanguageContextStore(app),
      asyncNoop,
    );
    disposables.push(qhm);

    openQueryTextSpy = jest
      .spyOn(variantAnalysisManagerStub, "openQueryText")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    deleteHistoryState();
    disposables.dispose(testDisposeHandler);
  });

  it("should read query history that has variant analysis history items", async () => {
    await qhm.readQueryHistory();

    expect(rehydrateVariantAnalysisStub).toHaveBeenCalledTimes(2);
    expect(rehydrateVariantAnalysisStub).toHaveBeenNthCalledWith(
      1,
      queryHistory[0].variantAnalysis,
    );
    expect(rehydrateVariantAnalysisStub).toHaveBeenNthCalledWith(
      2,
      queryHistory[1].variantAnalysis,
    );

    expect(qhm.treeDataProvider.allHistory[0]).toEqual(queryHistory[0]);
    expect(qhm.treeDataProvider.allHistory[1]).toEqual(queryHistory[1]);
    expect(qhm.treeDataProvider.allHistory.length).toBe(2);
  });

  it("should remove the variant analysis history item", async () => {
    await qhm.readQueryHistory();

    // Remove the first variant analysis
    await qhm.handleRemoveHistoryItem([qhm.treeDataProvider.allHistory[0]]);

    // Add it back to the history
    qhm.addQuery(queryHistory[0]);
    expect(removeVariantAnalysisStub).toHaveBeenCalledTimes(1);
    expect(rehydrateVariantAnalysisStub).toHaveBeenCalledTimes(2);
    expect(qhm.treeDataProvider.allHistory).toEqual([
      queryHistory[1],
      queryHistory[0],
    ]);
  });

  it("should remove two queries from history", async () => {
    await qhm.readQueryHistory();

    // Remove both queries
    // Just for fun, let's do it in reverse order
    await qhm.handleRemoveHistoryItem([
      qhm.treeDataProvider.allHistory[1],
      qhm.treeDataProvider.allHistory[0],
    ]);

    expect(removeVariantAnalysisStub).toHaveBeenCalledTimes(2);
    expect(removeVariantAnalysisStub).toHaveBeenNthCalledWith(
      1,
      queryHistory[1].variantAnalysis,
    );
    expect(removeVariantAnalysisStub).toHaveBeenNthCalledWith(
      2,
      queryHistory[0].variantAnalysis,
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

    await qhm.handleItemClicked(qhm.treeDataProvider.allHistory[0]);
    expect(showViewStub).toHaveBeenCalledWith(
      queryHistory[0].variantAnalysis.id,
    );
  });

  it("should get the query text", async () => {
    await qhm.readQueryHistory();
    await qhm.handleShowQueryText(qhm.treeDataProvider.allHistory[0]);

    expect(openQueryTextSpy).toHaveBeenCalledWith(
      queryHistory[0].variantAnalysis.id,
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
