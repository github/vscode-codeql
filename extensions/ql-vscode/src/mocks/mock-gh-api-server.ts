import { MockGitHubApiConfigListener } from '../config';

/**
 * Enables mocking of the GitHub API server via HTTP interception, using msw.
 */
export class MockGitHubApiServer {
  private isListening: boolean;
  private config: MockGitHubApiConfigListener;

  constructor() {
    this.isListening = false;
    this.config = new MockGitHubApiConfigListener();
    this.setupConfigListener();
  }

  public startServer(): void {
    this.isListening = true;

    // TODO: Enable HTTP interception.
  }

  public stopServer(): void {
    this.isListening = false;

    // TODO: Disable HTTP interception.
  }

  public loadScenario(): void {
    // TODO: Implement logic to load a scenario from a directory.
  }

  public listScenarios(): void {
    // TODO: Implement logic to list all available scenarios.
  }

  public recordScenario(): void {
    // TODO: Implement logic to record a new scenario to a directory.
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
