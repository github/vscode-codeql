import { MockGitHubApiServer } from "../../mocks/mock-gh-api-server";
import { MockedRequest } from "msw";

export class MockGitHubApiServerTest {
  private readonly _requests: MockedRequest[] = [];

  constructor(public readonly mockServer: MockGitHubApiServer) {
    this.onRequestStart = this.onRequestStart.bind(this);
  }

  public get requests(): MockedRequest[] {
    return this._requests.slice();
  }

  public beforeAll() {
    this.mockServer.startServer();

    this.mockServer.server.events.on("request:start", this.onRequestStart);
  }

  public async afterEach() {
    await this.mockServer.unloadScenario();
  }

  public afterAll() {
    this.mockServer.server.events.removeListener(
      "request:start",
      this.onRequestStart,
    );

    this.mockServer.stopServer();
  }

  public async loadScenario(scenarioName: string) {
    await this.mockServer.loadScenario(scenarioName);
  }

  private onRequestStart(request: MockedRequest): void {
    if (request.headers.has("x-vscode-codeql-msw-bypass")) {
      return;
    }

    this._requests.push(request);
  }
}

export function mockGitHubApiServer() {
  const mockServer = new MockGitHubApiServer();
  const testServer = new MockGitHubApiServerTest(mockServer);
  beforeAll(() => testServer.beforeAll());
  afterEach(async () => {
    await testServer.afterEach();
  });
  afterAll(() => testServer.afterAll());
  return testServer;
}
