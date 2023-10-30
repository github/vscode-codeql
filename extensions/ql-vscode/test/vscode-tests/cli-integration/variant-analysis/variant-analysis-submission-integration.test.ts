import { resolve } from "path";

import {
  authentication,
  commands,
  TextDocument,
  window,
  workspace,
} from "vscode";

import { MockGitHubApiServer } from "../../../../src/common/mock-gh-api/mock-gh-api-server";
import { mockedQuickPickItem } from "../../utils/mocking.helpers";
import { setRemoteControllerRepo } from "../../../../src/config";
import { getActivatedExtension } from "../../global.helper";
import { createVSCodeCommandManager } from "../../../../src/common/vscode/commands";
import { AllCommands } from "../../../../src/common/commands";

const mockServer = new MockGitHubApiServer();
beforeAll(() => mockServer.startServer());
afterEach(() => mockServer.unloadScenario());
afterAll(() => mockServer.stopServer());

async function showQlDocument(name: string): Promise<TextDocument> {
  const folderPath = workspace.workspaceFolders![0].uri.fsPath;
  const documentPath = resolve(folderPath, name);
  const document = await workspace.openTextDocument(documentPath);
  await window.showTextDocument(document!);
  return document;
}

describe("Variant Analysis Submission Integration", () => {
  const commandManager = createVSCodeCommandManager<AllCommands>();
  let quickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let executeCommandSpy: jest.SpiedFunction<typeof commands.executeCommand>;
  let showErrorMessageSpy: jest.SpiedFunction<typeof window.showErrorMessage>;

  beforeEach(async () => {
    await setRemoteControllerRepo("github/vscode-codeql");

    jest.spyOn(authentication, "getSession").mockResolvedValue({
      id: "test",
      accessToken: "test-token",
      scopes: [],
      account: {
        id: "test",
        label: "test",
      },
    });

    quickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockResolvedValue(undefined);
    executeCommandSpy = jest.spyOn(commands, "executeCommand");
    showErrorMessageSpy = jest
      .spyOn(window, "showErrorMessage")
      .mockResolvedValue(undefined);

    await getActivatedExtension();
  });

  describe("Successful scenario", () => {
    beforeEach(async () => {
      await mockServer.loadScenario("mrva-problem-query-success");
    });

    it("opens the variant analysis view", async () => {
      await showQlDocument("query.ql");

      // Select target language for your query
      quickPickSpy.mockResolvedValueOnce(
        mockedQuickPickItem({
          label: "JavaScript",
          language: "javascript",
        }),
      );

      await commandManager.execute("codeQL.runVariantAnalysis");

      expect(executeCommandSpy).toHaveBeenCalledWith(
        "codeQL.openVariantAnalysisView",
        146,
      );
    });
  });

  describe("Missing controller repo", () => {
    beforeEach(async () => {
      await mockServer.loadScenario("mrva-missing-controller-repo");
    });

    it("shows the error message", async () => {
      await showQlDocument("query.ql");

      await commandManager.execute("codeQL.runVariantAnalysis");

      expect(showErrorMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Controller repository "github/vscode-codeql" not found',
        ),
        expect.any(String),
      );
    });
  });

  describe("Submission failure", () => {
    beforeEach(async () => {
      await mockServer.loadScenario("mrva-submission-failure");
    });

    it("shows the error message", async () => {
      await showQlDocument("query.ql");

      // Select target language for your query
      quickPickSpy.mockResolvedValueOnce(
        mockedQuickPickItem({
          label: "JavaScript",
          language: "javascript",
        }),
      );

      await commandManager.execute("codeQL.runVariantAnalysis");

      expect(showErrorMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Unable to trigger a variant analysis. None of the requested repositories could be found.",
        ),
        expect.any(String),
      );
    });
  });
});
