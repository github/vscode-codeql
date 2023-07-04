import { ensureDir, writeFile } from "fs-extra";
import { join } from "path";

import { MockedRequest } from "msw";
import { SetupServer } from "msw/node";
import { IsomorphicResponse } from "@mswjs/interceptors";

import { Headers } from "headers-polyfill";
import fetch from "node-fetch";

import { DisposableObject } from "../../../common/disposable-object";

import {
  GetVariantAnalysisRepoResultRequest,
  GitHubApiRequest,
  RequestKind,
} from "./gh-api-request";

export class Recorder extends DisposableObject {
  private readonly allRequests = new Map<string, MockedRequest>();
  private currentRecordedScenario: GitHubApiRequest[] = [];

  private _isRecording = false;

  constructor(private readonly server: SetupServer) {
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

    this.server.events.on("request:start", this.onRequestStart);
    this.server.events.on("response:bypass", this.onResponseBypass);
  }

  public stop(): void {
    if (!this._isRecording) {
      return;
    }

    this._isRecording = false;

    this.server.events.removeListener("request:start", this.onRequestStart);
    this.server.events.removeListener("response:bypass", this.onResponseBypass);
  }

  public clear() {
    this.currentRecordedScenario = [];
    this.allRequests.clear();
  }

  public async save(scenariosPath: string, name: string): Promise<string> {
    const scenarioDirectory = join(scenariosPath, name);

    await ensureDir(scenarioDirectory);

    for (let i = 0; i < this.currentRecordedScenario.length; i++) {
      const request = this.currentRecordedScenario[i];

      const fileName = `${i}-${request.request.kind}.json`;
      const filePath = join(scenarioDirectory, fileName);

      let writtenRequest = {
        ...request,
      };

      if (shouldWriteBodyToFile(writtenRequest)) {
        const extension =
          writtenRequest.response.contentType === "application/zip"
            ? "zip"
            : "bin";

        const bodyFileName = `${i}-${writtenRequest.request.kind}.body.${extension}`;
        const bodyFilePath = join(scenarioDirectory, bodyFileName);

        let bodyFileLink = undefined;
        if (writtenRequest.response.body) {
          await writeFile(bodyFilePath, writtenRequest.response.body || "");
          bodyFileLink = `file:${bodyFileName}`;
        }

        writtenRequest = {
          ...writtenRequest,
          response: {
            ...writtenRequest.response,
            body: bodyFileLink,
          },
        };
      }

      await writeFile(filePath, JSON.stringify(writtenRequest, null, 2));
    }

    this.stop();

    return scenarioDirectory;
  }

  private onRequestStart(request: MockedRequest): void {
    if (request.headers.has("x-vscode-codeql-msw-bypass")) {
      return;
    }

    this.allRequests.set(request.id, request);
  }

  private async onResponseBypass(
    response: IsomorphicResponse,
    requestId: string,
  ): Promise<void> {
    const request = this.allRequests.get(requestId);
    this.allRequests.delete(requestId);
    if (!request) {
      return;
    }

    if (response.body === undefined) {
      return;
    }

    const gitHubApiRequest = await createGitHubApiRequest(
      request.url.toString(),
      response.status,
      response.body,
      response.headers,
    );
    if (!gitHubApiRequest) {
      return;
    }

    this.currentRecordedScenario.push(gitHubApiRequest);
  }
}

async function createGitHubApiRequest(
  url: string,
  status: number,
  body: string,
  headers: Headers,
): Promise<GitHubApiRequest | undefined> {
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

  if (
    url.match(/\/repositories\/\d+\/code-scanning\/codeql\/variant-analyses$/)
  ) {
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

  if (
    url.match(
      /\/repositories\/\d+\/code-scanning\/codeql\/variant-analyses\/\d+$/,
    )
  ) {
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

  const repoTaskMatch = url.match(
    /\/repositories\/\d+\/code-scanning\/codeql\/variant-analyses\/\d+\/repositories\/(?<repositoryId>\d+)$/,
  );
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
  const repoDownloadMatch = url.match(
    /objects-origin\.githubusercontent\.com\/codeql-query-console\/codeql-variant-analysis-repo-tasks\/\d+\/(?<repositoryId>\d+)/,
  );
  if (repoDownloadMatch?.groups?.repositoryId) {
    // msw currently doesn't support binary response bodies, so we need to download this separately
    // see https://github.com/mswjs/interceptors/blob/15eafa6215a328219999403e3ff110e71699b016/src/interceptors/ClientRequest/utils/getIncomingMessageBody.ts#L24-L33
    // Essentially, mws is trying to decode a ZIP file as UTF-8 which changes the bytes and corrupts the file.
    const response = await fetch(url, {
      headers: {
        // We need to ensure we don't end up in an infinite loop, since this request will also be intercepted
        "x-vscode-codeql-msw-bypass": "true",
      },
    });
    const responseBuffer = await response.buffer();

    return {
      request: {
        kind: RequestKind.GetVariantAnalysisRepoResult,
        repositoryId: parseInt(repoDownloadMatch.groups.repositoryId, 10),
      },
      response: {
        status,
        body: responseBuffer,
        contentType: headers.get("content-type") ?? "application/octet-stream",
      },
    };
  }

  const codeSearchMatch = url.match(/\/search\/code\?q=(?<query>.*)$/);
  if (codeSearchMatch?.groups?.query) {
    return {
      request: {
        kind: RequestKind.CodeSearch,
        query: codeSearchMatch?.groups?.query,
      },
      response: {
        status,
        body: JSON.parse(body),
      },
    };
  }

  return undefined;
}

function shouldWriteBodyToFile(
  request: GitHubApiRequest,
): request is GetVariantAnalysisRepoResultRequest {
  return request.response.body instanceof Buffer;
}
