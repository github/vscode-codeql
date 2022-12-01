import { pathExists } from "fs-extra";
import {
  commands,
  env,
  ExtensionContext,
  ExtensionMode,
  QuickPickItem,
  Uri,
  window,
} from "vscode";

import {
  getMockGitHubApiServerScenariosPath,
  MockGitHubApiConfigListener,
} from "../config";
import { DisposableObject } from "../pure/disposable-object";
import { MockGitHubApiServer } from "./mock-gh-api-server";

/**
 * "Interface" to the mock GitHub API server which implements VSCode interactions, such as
 * listening for config changes, asking for scenario names, etc.
 *
 * This should not be used in tests. For tests, use the `MockGitHubApiServer` class directly.
 */
export class VSCodeMockGitHubApiServer extends DisposableObject {
  private readonly server: MockGitHubApiServer;
  private readonly config: MockGitHubApiConfigListener;

  constructor(private readonly ctx: ExtensionContext) {
    super();
    this.server = new MockGitHubApiServer();
    this.config = new MockGitHubApiConfigListener();

    this.setupConfigListener();
  }

  public async startServer(): Promise<void> {
    await this.server.startServer();
  }

  public async stopServer(): Promise<void> {
    await this.server.stopServer();

    await commands.executeCommand(
      "setContext",
      "codeQL.mockGitHubApiServer.scenarioLoaded",
      false,
    );
    await commands.executeCommand(
      "setContext",
      "codeQL.mockGitHubApiServer.recording",
      false,
    );
  }

  public async loadScenario(): Promise<void> {
    const scenariosPath = await this.getScenariosPath();
    if (!scenariosPath) {
      return;
    }

    const scenarioNames = await this.server.getScenarioNames(scenariosPath);
    const scenarioQuickPickItems = scenarioNames.map((s) => ({ label: s }));
    const quickPickOptions = {
      placeHolder: "Select a scenario to load",
    };
    const selectedScenario = await window.showQuickPick<QuickPickItem>(
      scenarioQuickPickItems,
      quickPickOptions,
    );
    if (!selectedScenario) {
      return;
    }

    const scenarioName = selectedScenario.label;

    await this.server.loadScenario(scenarioName, scenariosPath);

    // Set a value in the context to track whether we have a scenario loaded.
    // This allows us to use this to show/hide commands (see package.json)
    await commands.executeCommand(
      "setContext",
      "codeQL.mockGitHubApiServer.scenarioLoaded",
      true,
    );

    await window.showInformationMessage(`Loaded scenario '${scenarioName}'`);
  }

  public async unloadScenario(): Promise<void> {
    if (!this.server.isScenarioLoaded) {
      await window.showInformationMessage("No scenario currently loaded");
    } else {
      await this.server.unloadScenario();
      await commands.executeCommand(
        "setContext",
        "codeQL.mockGitHubApiServer.scenarioLoaded",
        false,
      );
      await window.showInformationMessage("Unloaded scenario");
    }
  }

  public async startRecording(): Promise<void> {
    if (this.server.isRecording) {
      void window.showErrorMessage(
        'A scenario is already being recorded. Use the "Save Scenario" or "Cancel Scenario" commands to finish recording.',
      );
      return;
    }

    if (this.server.isScenarioLoaded) {
      await this.server.unloadScenario();
      await commands.executeCommand(
        "setContext",
        "codeQL.mockGitHubApiServer.scenarioLoaded",
        false,
      );
      void window.showInformationMessage(
        "A scenario was loaded so it has been unloaded",
      );
    }

    await this.server.startRecording();
    // Set a value in the context to track whether we are recording. This allows us to use this to show/hide commands (see package.json)
    await commands.executeCommand(
      "setContext",
      "codeQL.mockGitHubApiServer.recording",
      true,
    );

    await window.showInformationMessage(
      'Recording scenario. To save the scenario, use the "CodeQL Mock GitHub API Server: Save Scenario" command.',
    );
  }

  public async saveScenario(): Promise<void> {
    const scenariosPath = await this.getScenariosPath();
    if (!scenariosPath) {
      return;
    }

    // Set a value in the context to track whether we are recording. This allows us to use this to show/hide commands (see package.json)
    await commands.executeCommand(
      "setContext",
      "codeQL.mockGitHubApiServer.recording",
      false,
    );

    if (!this.server.isRecording) {
      void window.showErrorMessage("No scenario is currently being recorded.");
      return;
    }
    if (!this.server.anyRequestsRecorded) {
      void window.showWarningMessage(
        "No requests were recorded. Cancelling scenario.",
      );

      await this.stopRecording();

      return;
    }

    const name = await window.showInputBox({
      title: "Save scenario",
      prompt: "Enter a name for the scenario.",
      placeHolder: "successful-run",
    });
    if (!name) {
      return;
    }

    const filePath = await this.server.saveScenario(name, scenariosPath);

    await this.stopRecording();

    const action = await window.showInformationMessage(
      `Scenario saved to ${filePath}`,
      "Open directory",
    );
    if (action === "Open directory") {
      await env.openExternal(Uri.file(filePath));
    }
  }

  public async cancelRecording(): Promise<void> {
    if (!this.server.isRecording) {
      void window.showErrorMessage("No scenario is currently being recorded.");
      return;
    }

    await this.stopRecording();

    void window.showInformationMessage("Recording cancelled.");
  }

  private async stopRecording(): Promise<void> {
    // Set a value in the context to track whether we are recording. This allows us to use this to show/hide commands (see package.json)
    await commands.executeCommand(
      "setContext",
      "codeQL.mockGitHubApiServer.recording",
      false,
    );

    await this.server.stopRecording();
  }

  private async getScenariosPath(): Promise<string | undefined> {
    const scenariosPath = getMockGitHubApiServerScenariosPath();
    if (scenariosPath) {
      return scenariosPath;
    }

    if (this.ctx.extensionMode === ExtensionMode.Development) {
      const developmentScenariosPath = Uri.joinPath(
        this.ctx.extensionUri,
        "src/mocks/scenarios",
      ).fsPath.toString();
      if (await pathExists(developmentScenariosPath)) {
        return developmentScenariosPath;
      }
    }

    const directories = await window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: "Select scenarios directory",
      title: "Select scenarios directory",
    });
    if (directories === undefined || directories.length === 0) {
      void window.showErrorMessage("No scenarios directory selected.");
      return undefined;
    }

    // Unfortunately, we cannot save the directory in the configuration because that requires
    // the configuration to be registered. If we do that, it would be visible to all users; there
    // is no "when" clause that would allow us to only show it to users who have enabled the feature flag.

    return directories[0].fsPath;
  }

  private setupConfigListener(): void {
    // The config "changes" from the default at startup, so we need to call onConfigChange() to ensure the server is
    // started if required.
    void this.onConfigChange();
    this.config.onDidChangeConfiguration(() => void this.onConfigChange());
  }

  private async onConfigChange(): Promise<void> {
    if (this.config.mockServerEnabled && !this.server.isListening) {
      await this.startServer();
    } else if (!this.config.mockServerEnabled && this.server.isListening) {
      await this.stopServer();
    }
  }
}
