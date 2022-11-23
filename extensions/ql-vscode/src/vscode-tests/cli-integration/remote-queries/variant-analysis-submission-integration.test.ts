import * as path from "path";

import {
  commands,
  extensions,
  QuickPickItem,
  TextDocument,
  window,
  workspace,
} from "vscode";
import * as Octokit from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";

import { CodeQLExtensionInterface } from "../../../extension";
import * as config from "../../../config";
import { Credentials } from "../../../authentication";
import { MockGitHubApiServer } from "../../../mocks/mock-gh-api-server";

jest.setTimeout(10_000);

const mockServer = new MockGitHubApiServer();
beforeAll(() => mockServer.startServer());
afterEach(() => mockServer.unloadScenario());
afterAll(() => mockServer.stopServer());

async function showQlDocument(name: string): Promise<TextDocument> {
  const folderPath = workspace.workspaceFolders![0].uri.fsPath;
  const documentPath = path.resolve(folderPath, name);
  const document = await workspace.openTextDocument(documentPath);
  await window.showTextDocument(document!);
  return document;
}

describe("Variant Analysis Submission Integration", () => {
  const quickPickSpy = jest.spyOn(window, "showQuickPick");
  const inputBoxSpy = jest.spyOn(window, "showInputBox");
  const executeCommandSpy = jest.spyOn(commands, "executeCommand");
  const showErrorMessageSpy = jest.spyOn(window, "showErrorMessage");

  beforeEach(async () => {
    jest.spyOn(config, "isCanary").mockReturnValue(true);
    jest
      .spyOn(config, "isVariantAnalysisLiveResultsEnabled")
      .mockReturnValue(true);

    const mockCredentials = {
      getOctokit: () => Promise.resolve(new Octokit.Octokit({ retry })),
    } as unknown as Credentials;
    jest.spyOn(Credentials, "initialize").mockResolvedValue(mockCredentials);

    await config.setRemoteControllerRepo("github/vscode-codeql");

    quickPickSpy.mockReset().mockResolvedValue(undefined);
    inputBoxSpy.mockReset().mockResolvedValue(undefined);

    executeCommandSpy.mockRestore();
    showErrorMessageSpy.mockReset().mockResolvedValue(undefined);

    try {
      await extensions
        .getExtension<CodeQLExtensionInterface | Record<string, never>>(
          "GitHub.vscode-codeql",
        )!
        .activate();
    } catch (e) {
      fail(e as Error);
    }
  });

  describe("Successful scenario", () => {
    beforeEach(async () => {
      await mockServer.loadScenario("problem-query-success");
    });

    it("opens the variant analysis view", async () => {
      await showQlDocument("query.ql");

      // Select a repository list
      quickPickSpy.mockResolvedValueOnce({
        useCustomRepo: true,
      } as unknown as QuickPickItem);
      // Enter a GitHub repository
      inputBoxSpy.mockResolvedValueOnce("github/codeql");
      // Select target language for your query
      quickPickSpy.mockResolvedValueOnce(
        "javascript" as unknown as QuickPickItem,
      );

      await commands.executeCommand("codeQL.runVariantAnalysis");

      expect(executeCommandSpy).toHaveBeenCalledWith(
        "codeQL.openVariantAnalysisView",
        146,
      );
    });
  });

  describe("Missing controller repo", () => {
    beforeEach(async () => {
      await mockServer.loadScenario("missing-controller-repo");
    });

    it("shows the error message", async () => {
      await showQlDocument("query.ql");

      // Select a repository list
      quickPickSpy.mockResolvedValueOnce({
        useCustomRepo: true,
      } as unknown as QuickPickItem);
      // Enter a GitHub repository
      inputBoxSpy.mockResolvedValueOnce("github/codeql");

      await commands.executeCommand("codeQL.runVariantAnalysis");

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
      await mockServer.loadScenario("submission-failure");
    });

    it("shows the error message", async () => {
      await showQlDocument("query.ql");

      // Select a repository list
      quickPickSpy.mockResolvedValueOnce({
        useCustomRepo: true,
      } as unknown as QuickPickItem);
      // Enter a GitHub repository
      inputBoxSpy.mockResolvedValueOnce("github/codeql");
      // Select target language for your query
      quickPickSpy.mockResolvedValueOnce(
        "javascript" as unknown as QuickPickItem,
      );

      await commands.executeCommand("codeQL.runVariantAnalysis");

      expect(showErrorMessageSpy).toHaveBeenCalledWith(
        expect.stringContaining("No repositories could be queried."),
        expect.any(String),
      );
    });
  });
});
