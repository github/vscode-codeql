import { join } from "path";
import { Mode } from "../../../../src/model-editor/shared/mode";
import { mockDatabaseItem, mockedObject } from "../../utils/mocking.helpers";
import type { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import type { Uri, WebviewPanel } from "vscode";
import { ModelEditorView } from "../../../../src/model-editor/model-editor-view";
import { createMockApp } from "../../../__mocks__/appMock";
import { mockEmptyDatabaseManager } from "../query-testing/test-runner-helpers";
import type { QueryRunner } from "../../../../src/query-server";
import type { ExtensionPack } from "../../../../src/model-editor/shared/extension-pack";
import { createMockModelingStore } from "../../../__mocks__/model-editor/modelingStoreMock";
import type { ModelConfigListener } from "../../../../src/config";
import { QueryLanguage } from "../../../../src/common/query-language";
import type { VariantAnalysisManager } from "../../../../src/variant-analysis/variant-analysis-manager";
import type { DatabaseFetcher } from "../../../../src/databases/database-fetcher";
import { ModelingEvents } from "../../../../src/model-editor/modeling-events";

describe("ModelEditorView", () => {
  const app = createMockApp({});
  const modelingStore = createMockModelingStore();
  const modelingEvents = new ModelingEvents(app);
  const modelConfig = mockedObject<ModelConfigListener>({
    onDidChangeConfiguration: jest.fn(),
  });
  const databaseManager = mockEmptyDatabaseManager();
  const databaseFetcher = mockedObject<DatabaseFetcher>({});
  const variantAnalysisManager = mockedObject<VariantAnalysisManager>({});
  const cliServer = mockedObject<CodeQLCliServer>({});
  const queryRunner = mockedObject<QueryRunner>({});
  const queryStorageDir = "/a/b/c/d";
  const queryDir = "/a/b/c/e";
  const databaseItem = mockDatabaseItem();
  const extensionPack: ExtensionPack = {
    path: "/a/b/c/f",
    yamlPath: join("/a/b/c/f", "codeql-pack.yml"),
    name: "codeql/test",
    version: "0.0.0",
    language: "java",
    extensionTargets: {
      "codeql/java-all": "*",
    },
    dataExtensions: ["models/**/*.yml"],
  };
  const mode = Mode.Application;

  let view: ModelEditorView;

  beforeEach(() => {
    view = new ModelEditorView(
      app,
      modelingStore,
      modelingEvents,
      modelConfig,
      databaseManager,
      databaseFetcher,
      variantAnalysisManager,
      cliServer,
      queryRunner,
      queryStorageDir,
      queryDir,
      databaseItem,
      extensionPack,
      QueryLanguage.Java,
      mode,
    );
  });

  it("restores the view", async () => {
    // This tests using restoreView because that's much easier to mock than using openView. For openView, we would
    // need to mock `vscode.window.createWebviewPanel`, while for restoreView we only need to mock a given WebviewPanel.
    //
    // The thing we're testing inside this test is whether getPanelConfig returns the correct configuration, so there
    // should be no differences between openView/getPanel and restoreView for that.
    const panel = mockedObject<WebviewPanel>({
      onDidDispose: jest.fn(),
      webview: {
        html: undefined,
        cspSource: "abc",
        onDidReceiveMessage: jest.fn(),
        asWebviewUri: jest.fn().mockImplementation((uri: Uri) =>
          uri.with({
            scheme: "webview",
          }),
        ),
      },
    });

    await view.restoreView(panel);

    expect(panel.webview.html).toContain("<html>");
    expect(panel.webview.html).toContain('data-view="model-editor"');
  });
});
