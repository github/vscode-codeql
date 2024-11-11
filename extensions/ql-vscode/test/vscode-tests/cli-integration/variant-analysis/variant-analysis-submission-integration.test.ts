import { resolve } from "path";

import type { TextDocument } from "vscode";
import { authentication, commands, window, workspace } from "vscode";

import { mockedQuickPickItem } from "../../utils/mocking.helpers";
import { setRemoteControllerRepo } from "../../../../src/config";
import { getActivatedExtension } from "../../global.helper";
import { createVSCodeCommandManager } from "../../../../src/common/vscode/commands";
import type { AllCommands } from "../../../../src/common/commands";

async function showQlDocument(name: string): Promise<TextDocument> {
  const folderPath = workspace.workspaceFolders![0].uri.fsPath;
  const documentPath = resolve(folderPath, name);
  const document = await workspace.openTextDocument(documentPath);
  await window.showTextDocument(document!);
  return document;
}

// MSW can't intercept fetch requests made in VS Code, so we are skipping these tests for now
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

  afterAll(async () => {
    await commandManager.execute("codeQL.mockGitHubApiServer.unloadScenario");
  });

  describe("Successful scenario", () => {
    beforeEach(async () => {
      await commandManager.execute(
        "codeQL.mockGitHubApiServer.loadScenario",
        "mrva-problem-query-success",
      );
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
      await commandManager.execute(
        "codeQL.mockGitHubApiServer.loadScenario",
        "mrva-missing-controller-repo",
      );
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
          'Controller repository "github/vscode-codeql" not found',
        ),
        expect.any(String),
      );
    });
  });

  describe("Submission failure", () => {
    beforeEach(async () => {
      await commandManager.execute(
        "codeQL.mockGitHubApiServer.loadScenario",
        "mrva-submission-failure",
      );
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
