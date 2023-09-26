import { join } from "path";
import { Mode } from "../../../../src/model-editor/shared/mode";
import { mockDatabaseItem, mockedObject } from "../../utils/mocking.helpers";
import { CodeQLCliServer } from "../../../../src/codeql-cli/cli";
import { Uri, WebviewPanel } from "vscode";
import { ModelEditorView } from "../../../../src/model-editor/model-editor-view";
import { createMockApp } from "../../../__mocks__/appMock";
import { mockEmptyDatabaseManager } from "../query-testing/test-runner-helpers";
import { QueryRunner } from "../../../../src/query-server";
import { ExtensionPack } from "../../../../src/model-editor/shared/extension-pack";
import { createMockModelingStore } from "../../../__mocks__/model-editor/modelingStoreMock";

describe("ModelEditorView", () => {
  const app = createMockApp({});
  const modelingStore = createMockModelingStore();
  const databaseManager = mockEmptyDatabaseManager();
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
      databaseManager,
      cliServer,
      queryRunner,
      queryStorageDir,
      queryDir,
      databaseItem,
      extensionPack,
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
