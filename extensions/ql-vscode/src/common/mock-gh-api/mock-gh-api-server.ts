import { join, resolve } from "path";
import { pathExists } from "fs-extra";
import { setupServer, SetupServer } from "msw/node";

import { DisposableObject } from "../disposable-object";

import { Recorder } from "./recorder";
import { createRequestHandlers } from "./request-handlers";
import { getDirectoryNamesInsidePath } from "../files";

/**
 * Enables mocking of the GitHub API server via HTTP interception, using msw.
 */
export class MockGitHubApiServer extends DisposableObject {
  private readonly server: SetupServer;
  private readonly recorder: Recorder;

  constructor() {
    super();

    this.server = setupServer();
    this.recorder = this.push(new Recorder(this.server));
  }

  public stopServer(): void {
    this.server.close();
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

    const handlers = await createRequestHandlers(scenarioPath);
    this.server.resetHandlers();
    this.server.use(...handlers);
    this.server.listen({ onUnhandledRequest: "bypass" });
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
    this.recorder.stop();
    this.recorder.clear();
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
    this.server.resetHandlers();
  }
}
