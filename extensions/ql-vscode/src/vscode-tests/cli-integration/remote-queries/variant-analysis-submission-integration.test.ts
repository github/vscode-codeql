import { resolve } from "path";

import {
  authentication,
  commands,
  extensions,
  QuickPickItem,
  TextDocument,
  window,
  workspace,
} from "vscode";

import { CodeQLExtensionInterface } from "../../../extension";
import { MockGitHubApiServer } from "../../../mocks/mock-gh-api-server";
import { registerCredentials } from "../../../pure/authentication";
import { Disposable } from "../../../pure/disposable-object";
import { TestCredentials } from "../../factories/authentication";

jest.setTimeout(10_000);

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
  let quickPickSpy: jest.SpiedFunction<typeof window.showQuickPick>;
  let inputBoxSpy: jest.SpiedFunction<typeof window.showInputBox>;
  let executeCommandSpy: jest.SpiedFunction<typeof commands.executeCommand>;
  let showErrorMessageSpy: jest.SpiedFunction<typeof window.showErrorMessage>;
  let credentialDisposer: Disposable;

  beforeEach(async () => {
    const originalGetConfiguration = workspace.getConfiguration;

    jest
      .spyOn(workspace, "getConfiguration")
      .mockImplementation((section, scope) => {
        const configuration = originalGetConfiguration(section, scope);

        return {
          get(key: string, defaultValue?: unknown) {
            if (section === "codeQL.variantAnalysis" && key === "liveResults") {
              return true;
            }
            if (section === "codeQL" && key == "canary") {
              return true;
            }
            if (
              section === "codeQL.variantAnalysis" &&
              key === "controllerRepo"
            ) {
              return "github/vscode-codeql";
            }
            return configuration.get(key, defaultValue);
          },
          has(key: string) {
            return configuration.has(key);
          },
          inspect(key: string) {
            return configuration.inspect(key);
          },
          update(
            key: string,
            value: unknown,
            configurationTarget?: boolean,
            overrideInLanguage?: boolean,
          ) {
            return configuration.update(
              key,
              value,
              configurationTarget,
              overrideInLanguage,
            );
          },
        };
      });

    jest.spyOn(authentication, "getSession").mockResolvedValue({
      id: "test",
      accessToken: "test-token",
      scopes: [],
      account: {
        id: "test",
        label: "test",
      },
    });

    credentialDisposer = registerCredentials(
      TestCredentials.initializeWithUnauthenticatedOctokit(),
    );

    quickPickSpy = jest
      .spyOn(window, "showQuickPick")
      .mockResolvedValue(undefined);
    inputBoxSpy = jest
      .spyOn(window, "showInputBox")
      .mockResolvedValue(undefined);
    executeCommandSpy = jest.spyOn(commands, "executeCommand");
    showErrorMessageSpy = jest
      .spyOn(window, "showErrorMessage")
      .mockResolvedValue(undefined);

    await extensions
      .getExtension<CodeQLExtensionInterface | Record<string, never>>(
        "GitHub.vscode-codeql",
      )!
      .activate();
  });

  afterEach(() => {
    credentialDisposer?.dispose();
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
        expect.stringContaining(
          "Unable to trigger a variant analysis. None of the requested repositories could be found.",
        ),
        expect.any(String),
      );
    });
  });
});
