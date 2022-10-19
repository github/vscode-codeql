import * as fs from 'fs-extra';
import * as path from 'path';

import { MockedRequest } from 'msw';
import { SetupServerApi } from 'msw/node';
import { IsomorphicResponse } from '@mswjs/interceptors';

import { DisposableObject } from '../pure/disposable-object';

import { GitHubApiRequest, RequestKind } from './gh-api-request';

export class Recorder extends DisposableObject {
  private readonly allRequests = new Map<string, MockedRequest>();
  private currentRecordedScenario: GitHubApiRequest[] = [];

  private _recording = false;

  constructor(
    private readonly server: SetupServerApi,
  ) {
    super();
    this.onRequestStart = this.onRequestStart.bind(this);
    this.onResponseBypass = this.onResponseBypass.bind(this);
  }

  public get isRecording(): boolean {
    return this._recording;
  }

  public get scenarioRequestCount(): number {
    return this.currentRecordedScenario.length;
  }

  public start(): void {
    if (this._recording) {
      return;
    }

    this._recording = true;

    this.clear();

    this.server.events.on('request:start', this.onRequestStart);
    this.server.events.on('response:bypass', this.onResponseBypass);
  }

  public stop(): void {
    if (!this._recording) {
      return;
    }

    this._recording = false;

    this.server.events.removeListener('request:start', this.onRequestStart);
    this.server.events.removeListener('response:bypass', this.onResponseBypass);
  }

  public clear() {
    this.currentRecordedScenario = [];
    this.allRequests.clear();
  }

  public async save(scenariosDirectory: string, name: string): Promise<string> {
    const scenarioDirectory = path.join(scenariosDirectory, name);

    await fs.ensureDir(scenarioDirectory);

    for (let i = 0; i < this.currentRecordedScenario.length; i++) {
      const request = this.currentRecordedScenario[i];

      const fileName = `${i}-${request.request.kind}.json`;
      const filePath = path.join(scenarioDirectory, fileName);
      await fs.writeFile(filePath, JSON.stringify(request, null, 2));
    }

    this.stop();

    return scenarioDirectory;
  }

  private onRequestStart(request: MockedRequest): void {
    this.allRequests.set(request.id, request);
  }

  private onResponseBypass(response: IsomorphicResponse, requestId: string): void {
    const request = this.allRequests.get(requestId);
    this.allRequests.delete(requestId);
    if (!request) {
      return;
    }

    if (response.body === undefined) {
      return;
    }

    const gitHubApiRequest = createGitHubApiRequest(request.url.toString(), response.status, response.body);
    if (!gitHubApiRequest) {
      return;
    }

    this.currentRecordedScenario.push(gitHubApiRequest);
  }
}

function createGitHubApiRequest(url: string, status: number, body: string): GitHubApiRequest | undefined {
  if (!url) {
    return undefined;
  }

  if (url.match(/\/repos\/[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/)) {
    return {
      request: {
        kind: RequestKind.GetRepo,
      },
      response: {
        status,
        body: JSON.parse(body),
      },
    };
  }

  if (url.match(/\/repositories\/\d+\/code-scanning\/codeql\/variant-analyses$/)) {
    return {
      request: {
        kind: RequestKind.SubmitVariantAnalysis,
      },
      response: {
        status,
        body: JSON.parse(body),
      },
    };
  }

  if (url.match(/\/repositories\/\d+\/code-scanning\/codeql\/variant-analyses\/\d+$/)) {
    return {
      request: {
        kind: RequestKind.GetVariantAnalysis,
      },
      response: {
        status,
        body: JSON.parse(body),
      },
    };
  }

  const repoTaskMatch = url.match(/\/repositories\/\d+\/code-scanning\/codeql\/variant-analyses\/\d+\/repositories\/(?<repositoryId>\d+)$/);
  if (repoTaskMatch?.groups?.repositoryId) {
    return {
      request: {
        kind: RequestKind.GetVariantAnalysisRepo,
        repositoryId: parseInt(repoTaskMatch.groups.repositoryId, 10),
      },
      response: {
        status,
        body: JSON.parse(body),
      },
    };
  }

  // if url is a download URL for a variant analysis result, then it's a get-variant-analysis-repoResult.
  const repoDownloadMatch = url.match(/objects-origin\.githubusercontent\.com\/codeql-query-console\/codeql-variant-analysis-repo-tasks\/\d+\/(?<repositoryId>\d+)/);
  if (repoDownloadMatch?.groups?.repositoryId) {
    return {
      request: {
        kind: RequestKind.GetVariantAnalysisRepoResult,
        repositoryId: parseInt(repoDownloadMatch.groups.repositoryId, 10),
      },
      response: {
        status,
        body: body as unknown as ArrayBuffer,
      }
    };
  }

  return undefined;
}
