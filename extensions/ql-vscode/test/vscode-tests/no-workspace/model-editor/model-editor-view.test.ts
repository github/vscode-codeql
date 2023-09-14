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

describe("ModelEditorView", () => {
  const app = createMockApp({});
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
  const updateMethodsUsagePanelState = jest.fn();
  const showMethod = jest.fn();
  const handleViewBecameActive = jest.fn();
  const handleViewWasDisposed = jest.fn();
  const isMostRecentlyActiveView = jest.fn();

  let view: ModelEditorView;

  beforeEach(() => {
    view = new ModelEditorView(
      app,
      databaseManager,
      cliServer,
      queryRunner,
      queryStorageDir,
      queryDir,
      databaseItem,
      extensionPack,
      mode,
      updateMethodsUsagePanelState,
      showMethod,
      handleViewBecameActive,
      handleViewWasDisposed,
      isMostRecentlyActiveView,
    );
  });

  it("sets up the view", async () => {
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
