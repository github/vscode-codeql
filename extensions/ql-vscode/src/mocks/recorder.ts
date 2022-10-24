import * as fs from 'fs-extra';
import * as path from 'path';

import { MockedRequest } from 'msw';
import { SetupServerApi } from 'msw/node';
import { IsomorphicResponse } from '@mswjs/interceptors';

import { Headers } from 'headers-polyfill';

import { DisposableObject } from '../pure/disposable-object';

import { GetVariantAnalysisRepoResultRequest, GitHubApiRequest, RequestKind } from './gh-api-request';

export class Recorder extends DisposableObject {
  private readonly allRequests = new Map<string, MockedRequest>();
  private currentRecordedScenario: GitHubApiRequest[] = [];

  private _isRecording = false;

  constructor(
    private readonly server: SetupServerApi,
  ) {
    super();
    this.onRequestStart = this.onRequestStart.bind(this);
    this.onResponseBypass = this.onResponseBypass.bind(this);
  }

  public get isRecording(): boolean {
    return this._isRecording;
  }

  public get anyRequestsRecorded(): boolean {
    return this.currentRecordedScenario.length > 0;
  }

  public start(): void {
    if (this._isRecording) {
      return;
    }

    this._isRecording = true;

    this.clear();

    this.server.events.on('request:start', this.onRequestStart);
    this.server.events.on('response:bypass', this.onResponseBypass);
  }

  public stop(): void {
    if (!this._isRecording) {
      return;
    }

    this._isRecording = false;

    this.server.events.removeListener('request:start', this.onRequestStart);
    this.server.events.removeListener('response:bypass', this.onResponseBypass);
  }

  public clear() {
    this.currentRecordedScenario = [];
    this.allRequests.clear();
  }

  public async save(scenariosPath: string, name: string): Promise<string> {
    const scenarioDirectory = path.join(scenariosPath, name);

    await fs.ensureDir(scenarioDirectory);

    for (let i = 0; i < this.currentRecordedScenario.length; i++) {
      const request = this.currentRecordedScenario[i];

      const fileName = `${i}-${request.request.kind}.json`;
      const filePath = path.join(scenarioDirectory, fileName);

      let writtenRequest = {
        ...request
      };

      if (shouldWriteBodyToFile(writtenRequest)) {
        const extension = writtenRequest.response.contentType === 'application/zip' ? 'zip' : 'bin';

        const bodyFileName = `${i}-${writtenRequest.request.kind}.body.${extension}`;
        const bodyFilePath = path.join(scenarioDirectory, bodyFileName);
        await fs.writeFile(bodyFilePath, writtenRequest.response.body);

        writtenRequest = {
          ...writtenRequest,
          response: {
            ...writtenRequest.response,
            body: `file:${bodyFileName}`,
          },
        };
      }

      await fs.writeFile(filePath, JSON.stringify(writtenRequest, null, 2));
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

    const gitHubApiRequest = createGitHubApiRequest(request.url.toString(), response.status, response.body, response.headers);
    if (!gitHubApiRequest) {
      return;
    }

    this.currentRecordedScenario.push(gitHubApiRequest);
  }
}

function createGitHubApiRequest(url: string, status: number, body: string, headers: Headers): GitHubApiRequest | undefined {
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
        body: Buffer.from(body),
        contentType: headers.get('content-type') ?? 'application/octet-stream',
      }
    };
  }

  return undefined;
}

function shouldWriteBodyToFile(request: GitHubApiRequest): request is GetVariantAnalysisRepoResultRequest {
  return request.response.body instanceof Buffer;
}
