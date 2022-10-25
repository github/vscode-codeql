import * as path from 'path';
import * as fs from 'fs-extra';
import { commands, env, ExtensionContext, ExtensionMode, QuickPickItem, Uri, window } from 'vscode';
import { setupServer, SetupServerApi } from 'msw/node';

import { getMockGitHubApiServerScenariosPath, MockGitHubApiConfigListener } from '../config';
import { DisposableObject } from '../pure/disposable-object';

import { Recorder } from './recorder';
import { createRequestHandlers } from './request-handlers';
import { getDirectoryNamesInsidePath } from '../pure/files';

/**
 * Enables mocking of the GitHub API server via HTTP interception, using msw.
 */
export class MockGitHubApiServer extends DisposableObject {
  private isListening: boolean;
  private config: MockGitHubApiConfigListener;

  private readonly server: SetupServerApi;
  private readonly recorder: Recorder;

  constructor(
    private readonly ctx: ExtensionContext,
  ) {
    super();
    this.isListening = false;
    this.config = new MockGitHubApiConfigListener();

    this.server = setupServer();
    this.recorder = this.push(new Recorder(this.server));

    this.setupConfigListener();
  }

  public startServer(): void {
    if (this.isListening) {
      return;
    }

    this.server.listen();
    this.isListening = true;
  }

  public stopServer(): void {
    this.server.close();
    this.isListening = false;
  }

  public async loadScenario(): Promise<void> {
    const scenariosPath = await this.getScenariosPath();
    if (!scenariosPath) {
      return;
    }

    const scenarioNames = await getDirectoryNamesInsidePath(scenariosPath);
    const scenarioQuickPickItems = scenarioNames.map(s => ({ label: s }));
    const quickPickOptions = {
      placeHolder: 'Select a scenario to load',
    };
    const selectedScenario = await window.showQuickPick<QuickPickItem>(
      scenarioQuickPickItems,
      quickPickOptions);
    if (!selectedScenario) {
      return;
    }

    const scenarioName = selectedScenario.label;
    const scenarioPath = path.join(scenariosPath, scenarioName);

    const handlers = await createRequestHandlers(scenarioPath);
    this.server.resetHandlers();
    this.server.use(...handlers);

    // Set a value in the context to track whether we have a scenario loaded. 
    // This allows us to use this to show/hide commands (see package.json)
    await commands.executeCommand('setContext', 'codeQL.mockGitHubApiServer.scenarioLoaded', true);

    await window.showInformationMessage(`Loaded scenario '${scenarioName}'`);
  }

  public async unloadScenario(): Promise<void> {
    if (!this.isScenarioLoaded()) {
      await window.showInformationMessage('No scenario currently loaded');
    }
    else {
      await this.unloadAllScenarios();
      await window.showInformationMessage('Unloaded scenario');
    }
  }

  public async startRecording(): Promise<void> {
    if (this.recorder.isRecording) {
      void window.showErrorMessage('A scenario is already being recorded. Use the "Save Scenario" or "Cancel Scenario" commands to finish recording.');
      return;
    }

    if (this.isScenarioLoaded()) {
      await this.unloadAllScenarios();
      void window.showInformationMessage('A scenario was loaded so it has been unloaded');
    }

    this.recorder.start();
    // Set a value in the context to track whether we are recording. This allows us to use this to show/hide commands (see package.json)
    await commands.executeCommand('setContext', 'codeQL.mockGitHubApiServer.recording', true);

    await window.showInformationMessage('Recording scenario. To save the scenario, use the "CodeQL Mock GitHub API Server: Save Scenario" command.');
  }

  public async saveScenario(): Promise<void> {
    const scenariosPath = await this.getScenariosPath();
    if (!scenariosPath) {
      return;
    }

    // Set a value in the context to track whether we are recording. This allows us to use this to show/hide commands (see package.json)
    await commands.executeCommand('setContext', 'codeQL.mockGitHubApiServer.recording', false);

    if (!this.recorder.isRecording) {
      void window.showErrorMessage('No scenario is currently being recorded.');
      return;
    }
    if (!this.recorder.anyRequestsRecorded) {
      void window.showWarningMessage('No requests were recorded. Cancelling scenario.');

      await this.stopRecording();

      return;
    }

    const name = await window.showInputBox({
      title: 'Save scenario',
      prompt: 'Enter a name for the scenario.',
      placeHolder: 'successful-run',
    });
    if (!name) {
      return;
    }

    const filePath = await this.recorder.save(scenariosPath, name);

    await this.stopRecording();

    const action = await window.showInformationMessage(`Scenario saved to ${filePath}`, 'Open directory');
    if (action === 'Open directory') {
      await env.openExternal(Uri.file(filePath));
    }
  }

  public async cancelRecording(): Promise<void> {
    if (!this.recorder.isRecording) {
      void window.showErrorMessage('No scenario is currently being recorded.');
      return;
    }

    await this.stopRecording();

    void window.showInformationMessage('Recording cancelled.');
  }

  private async stopRecording(): Promise<void> {
    // Set a value in the context to track whether we are recording. This allows us to use this to show/hide commands (see package.json)
    await commands.executeCommand('setContext', 'codeQL.mockGitHubApiServer.recording', false);

    await this.recorder.stop();
    await this.recorder.clear();
  }

  private async getScenariosPath(): Promise<string | undefined> {
    const scenariosPath = getMockGitHubApiServerScenariosPath();
    if (scenariosPath) {
      return scenariosPath;
    }

    if (this.ctx.extensionMode === ExtensionMode.Development) {
      const developmentScenariosPath = Uri.joinPath(this.ctx.extensionUri, 'src/mocks/scenarios').fsPath.toString();
      if (await fs.pathExists(developmentScenariosPath)) {
        return developmentScenariosPath;
      }
    }

    const directories = await window.showOpenDialog({
      canSelectFolders: true,
      canSelectFiles: false,
      canSelectMany: false,
      openLabel: 'Select scenarios directory',
      title: 'Select scenarios directory',
    });
    if (directories === undefined || directories.length === 0) {
      void window.showErrorMessage('No scenarios directory selected.');
      return undefined;
    }

    // Unfortunately, we cannot save the directory in the configuration because that requires
    // the configuration to be registered. If we do that, it would be visible to all users; there
    // is no "when" clause that would allow us to only show it to users who have enabled the feature flag.

    return directories[0].fsPath;
  }

  private isScenarioLoaded(): boolean {
    return this.server.listHandlers().length > 0;
  }

  private async unloadAllScenarios(): Promise<void> {
    this.server.resetHandlers();
    await commands.executeCommand('setContext', 'codeQL.mockGitHubApiServer.scenarioLoaded', false);
  }

  private setupConfigListener(): void {
    // The config "changes" from the default at startup, so we need to call onConfigChange() to ensure the server is
    // started if required.
    this.onConfigChange();
    this.config.onDidChangeConfiguration(() => this.onConfigChange());
  }

  private onConfigChange(): void {
    if (this.config.mockServerEnabled && !this.isListening) {
      this.startServer();
    } else if (!this.config.mockServerEnabled && this.isListening) {
      this.stopServer();
    }
  }
}
