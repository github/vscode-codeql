import * as path from "path";
import * as fs from "fs-extra";
import { setupServer, SetupServerApi } from "msw/node";

import { DisposableObject } from "../pure/disposable-object";

import { Recorder } from "./recorder";
import { createRequestHandlers } from "./request-handlers";
import { getDirectoryNamesInsidePath } from "../pure/files";

/**
 * Enables mocking of the GitHub API server via HTTP interception, using msw.
 */
export class MockGitHubApiServer extends DisposableObject {
  private _isListening: boolean;

  private readonly server: SetupServerApi;
  private readonly recorder: Recorder;

  constructor() {
    super();
    this._isListening = false;

    this.server = setupServer();
    this.recorder = this.push(new Recorder(this.server));
  }

  public startServer(): void {
    if (this._isListening) {
      return;
    }

    this.server.listen({ onUnhandledRequest: "bypass" });
    this._isListening = true;
  }

  public stopServer(): void {
    this.server.close();
    this._isListening = false;
  }

  public async loadScenario(
    scenarioName: string,
    scenariosPath?: string,
  ): Promise<void> {
    if (!scenariosPath) {
      scenariosPath = await this.getDefaultScenariosPath();
      if (!scenariosPath) {
        return;
      }
    }

    const scenarioPath = path.join(scenariosPath, scenarioName);

    const handlers = await createRequestHandlers(scenarioPath);
    this.server.resetHandlers();
    this.server.use(...handlers);
  }

  public async saveScenario(
    scenarioName: string,
    scenariosPath?: string,
  ): Promise<string> {
    if (!scenariosPath) {
      scenariosPath = await this.getDefaultScenariosPath();
      if (!scenariosPath) {
        throw new Error("Could not find scenarios path");
      }
    }

    const filePath = await this.recorder.save(scenariosPath, scenarioName);

    await this.stopRecording();

    return filePath;
  }

  public async unloadScenario(): Promise<void> {
    if (!this.isScenarioLoaded) {
      return;
    }

    await this.unloadAllScenarios();
  }

  public async startRecording(): Promise<void> {
    if (this.recorder.isRecording) {
      return;
    }

    if (this.isScenarioLoaded) {
      await this.unloadAllScenarios();
    }

    this.recorder.start();
  }

  public async stopRecording(): Promise<void> {
    await this.recorder.stop();
    await this.recorder.clear();
  }

  public async getScenarioNames(scenariosPath?: string): Promise<string[]> {
    if (!scenariosPath) {
      scenariosPath = await this.getDefaultScenariosPath();
      if (!scenariosPath) {
        return [];
      }
    }

    return await getDirectoryNamesInsidePath(scenariosPath);
  }

  public get isListening(): boolean {
    return this._isListening;
  }

  public get isRecording(): boolean {
    return this.recorder.isRecording;
  }

  public get anyRequestsRecorded(): boolean {
    return this.recorder.anyRequestsRecorded;
  }

  public get isScenarioLoaded(): boolean {
    return this.server.listHandlers().length > 0;
  }

  public async getDefaultScenariosPath(): Promise<string | undefined> {
    // This should be the directory where package.json is located
    const rootDirectory = path.resolve(__dirname, "../..");

    const scenariosPath = path.resolve(rootDirectory, "src/mocks/scenarios");
    if (await fs.pathExists(scenariosPath)) {
      return scenariosPath;
    }

    return undefined;
  }

  private async unloadAllScenarios(): Promise<void> {
    this.server.resetHandlers();
  }
}
