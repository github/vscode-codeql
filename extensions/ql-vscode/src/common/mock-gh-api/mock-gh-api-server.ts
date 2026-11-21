import { join, resolve } from "path";
import { pathExists } from "fs-extra";
import type { SetupServer } from "msw/node";
import type { http, UnhandledFrameStrategy } from "msw";

import { DisposableObject } from "../disposable-object";

import { Recorder } from "./recorder";
import { createRequestHandlers } from "./request-handlers";
import { getDirectoryNamesInsidePath } from "../files";

/**
 * Enables mocking of the GitHub API server via HTTP interception, using msw.
 */
export class MockGitHubApiServer extends DisposableObject {
  private _isListening = false;

  private state?: {
    server: SetupServer;
    recorder: Recorder;
    http: typeof http;
  };

  private async getState() {
    if (this.state) {
      return this.state;
    }

    const [{ setupServer }, { http }] = await Promise.all([
      import("msw/node"),
      import("msw"),
    ]);
    if (!this.state) {
      const server = setupServer();
      this.state = { server, recorder: this.push(new Recorder(server)), http };
    }
    return this.state;
  }

  public async startServer(
    onUnhandledFrame: UnhandledFrameStrategy = "bypass",
  ): Promise<void> {
    const { server } = await this.getState();
    if (this._isListening) {
      return;
    }

    server.listen({ onUnhandledFrame });
    this._isListening = true;
  }

  public stopServer(): void {
    this.state?.server.close();
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

    const scenarioPath = join(scenariosPath, scenarioName);

    const { server, http } = await this.getState();
    const handlers = await createRequestHandlers(http, scenarioPath);
    server.resetHandlers(...handlers);
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

    const { recorder } = await this.getState();
    const filePath = await recorder.save(scenariosPath, scenarioName);

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
    const { recorder } = await this.getState();
    if (recorder.isRecording) {
      return;
    }

    if (this.isScenarioLoaded) {
      await this.unloadAllScenarios();
    }

    recorder.start();
  }

  public async stopRecording(): Promise<void> {
    this.state?.recorder.stop();
    this.state?.recorder.clear();
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
    return this.state?.recorder.isRecording ?? false;
  }

  public get anyRequestsRecorded(): boolean {
    return this.state?.recorder.anyRequestsRecorded ?? false;
  }

  public get isScenarioLoaded(): boolean {
    return (this.state?.server.listHandlers().length ?? 0) > 0;
  }

  public async getDefaultScenariosPath(): Promise<string | undefined> {
    // This should be the directory where package.json is located
    const rootDirectory = resolve(__dirname, "../../..");

    const scenariosPath = resolve(
      rootDirectory,
      "src/common/mock-gh-api/scenarios",
    );
    if (await pathExists(scenariosPath)) {
      return scenariosPath;
    }

    return undefined;
  }

  private async unloadAllScenarios(): Promise<void> {
    this.state?.server.resetHandlers();
  }
}
