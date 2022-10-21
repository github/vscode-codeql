import { MockGitHubApiConfigListener } from '../config';

import { setupServer, SetupServerApi } from 'msw/node';
import { Recorder } from './recorder';
import { commands, env, Uri, window } from 'vscode';
import { DisposableObject } from '../pure/disposable-object';
import { getMockGitHubApiServerScenariosPath } from '../config';

/**
 * Enables mocking of the GitHub API server via HTTP interception, using msw.
 */
export class MockGitHubApiServer extends DisposableObject {
  private isListening: boolean;
  private config: MockGitHubApiConfigListener;

  private readonly server: SetupServerApi;
  private readonly recorder: Recorder;

  constructor() {
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

  public loadScenario(): void {
    // TODO: Implement logic to load a scenario from a directory.
  }

  public listScenarios(): void {
    // TODO: Implement logic to list all available scenarios.
  }

  public async recordScenario(): Promise<void> {
    if (this.recorder.isRecording) {
      void window.showErrorMessage('A scenario is already being recorded. Use the "Save Scenario" or "Cancel Scenario" commands to finish recording.');
      return;
    }

    this.recorder.start();
    await commands.executeCommand('setContext', 'codeQLMockGitHubApiServer.recording', true);

    await window.showInformationMessage('Recording scenario. To save the scenario, use the "CodeQL Mock GitHub API Server: Save Scenario" command.');
  }

  public async saveScenario(): Promise<void> {
    const scenariosDirectory = await this.getScenariosDirectory();
    if (!scenariosDirectory) {
      return;
    }

    await commands.executeCommand('setContext', 'codeQLMockGitHubApiServer.recording', false);

    if (!this.recorder.isRecording) {
      void window.showErrorMessage('No scenario is currently being recorded.');
      return;
    }
    if (this.recorder.scenarioRequestCount === 0) {
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

    const filepath = await this.recorder.save(scenariosDirectory, name);

    await this.stopRecording();

    const action = await window.showInformationMessage(`Scenario saved to ${filepath}`, 'Open directory');
    if (action === 'Open directory') {
      await env.openExternal(Uri.file(filepath));
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
    await commands.executeCommand('setContext', 'codeQLMockGitHubApiServer.recording', false);

    await this.recorder.stop();
    await this.recorder.clear();
  }

  private async getScenariosDirectory(): Promise<string | undefined> {
    const scenariosDirectory = getMockGitHubApiServerScenariosPath();
    if (scenariosDirectory) {
      return scenariosDirectory;
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

  private setupConfigListener(): void {
    this.config.onDidChangeConfiguration(() => {
      if (this.config.mockServerEnabled && !this.isListening) {
        this.startServer();
      } else if (!this.config.mockServerEnabled && this.isListening) {
        this.stopServer();
      }
    });
  }
}
