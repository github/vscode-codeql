import * as path from "path";

import * as sinon from "sinon";

import { commands, extensions, TextDocument, window, workspace } from "vscode";
import * as Octokit from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";

import { CodeQLExtensionInterface } from "../../../extension";
import * as config from "../../../config";
import { Credentials } from "../../../authentication";
import { MockGitHubApiServer } from "../../../mocks/mock-gh-api-server";

const mockServer = new MockGitHubApiServer();
before(() => mockServer.startServer());
afterEach(() => mockServer.unloadScenario());
after(() => mockServer.stopServer());

async function showQlDocument(name: string): Promise<TextDocument> {
  const folderPath = workspace.workspaceFolders![0].uri.fsPath;
  const documentPath = path.resolve(folderPath, name);
  const document = await workspace.openTextDocument(documentPath);
  await window.showTextDocument(document!);
  return document;
}

describe("Variant Analysis Submission Integration", function () {
  this.timeout(10_000);

  let sandbox: sinon.SinonSandbox;
  let quickPickSpy: sinon.SinonStub;
  let inputBoxSpy: sinon.SinonStub;
  let executeCommandSpy: sinon.SinonStub;
  let showErrorMessageSpy: sinon.SinonStub;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    sandbox.stub(config, "isCanary").returns(true);
    sandbox.stub(config, "isVariantAnalysisLiveResultsEnabled").returns(true);

    const mockCredentials = {
      getOctokit: () => Promise.resolve(new Octokit.Octokit({ retry })),
    } as unknown as Credentials;
    sandbox.stub(Credentials, "initialize").resolves(mockCredentials);

    await config.setRemoteControllerRepo("github/vscode-codeql");

    quickPickSpy = sandbox.stub(window, "showQuickPick").resolves(undefined);
    inputBoxSpy = sandbox.stub(window, "showInputBox").resolves(undefined);

    executeCommandSpy = sandbox.stub(commands, "executeCommand").callThrough();
    showErrorMessageSpy = sandbox
      .stub(window, "showErrorMessage")
      .resolves(undefined);

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

  afterEach(() => {
    sandbox.restore();
  });

  describe("Successful scenario", () => {
    beforeEach(async () => {
      await mockServer.loadScenario("problem-query-success");
    });

    it("opens the variant analysis view", async () => {
      await showQlDocument("query.ql");

      // Select a repository list
      quickPickSpy.onFirstCall().resolves({
        useCustomRepo: true,
      });
      // Enter a GitHub repository
      inputBoxSpy.onFirstCall().resolves("github/codeql");
      // Select target language for your query
      quickPickSpy.onSecondCall().resolves("javascript");

      await commands.executeCommand("codeQL.runVariantAnalysis");

      sinon.assert.calledWith(
        executeCommandSpy,
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
      quickPickSpy.onFirstCall().resolves({
        useCustomRepo: true,
      });
      // Enter a GitHub repository
      inputBoxSpy.onFirstCall().resolves("github/codeql");

      await commands.executeCommand("codeQL.runVariantAnalysis");

      sinon.assert.calledWith(
        showErrorMessageSpy,
        sinon.match('Controller repository "github/vscode-codeql" not found'),
        sinon.match.string,
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
      quickPickSpy.onFirstCall().resolves({
        useCustomRepo: true,
      });
      // Enter a GitHub repository
      inputBoxSpy.onFirstCall().resolves("github/codeql");
      // Select target language for your query
      quickPickSpy.onSecondCall().resolves("javascript");

      await commands.executeCommand("codeQL.runVariantAnalysis");

      sinon.assert.calledWith(
        showErrorMessageSpy,
        sinon.match("No repositories could be queried."),
        sinon.match.string,
      );
    });
  });
});
