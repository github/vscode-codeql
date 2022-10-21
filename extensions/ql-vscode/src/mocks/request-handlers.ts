import * as path from 'path';
import * as fs from 'fs-extra';
import { DefaultBodyType, MockedRequest, rest, RestHandler } from 'msw';
import {
  GitHubApiRequest,
  isGetRepoRequest,
  isGetVariantAnalysisRepoRequest,
  isGetVariantAnalysisRepoResultRequest,
  isGetVariantAnalysisRequest,
  isSubmitVariantAnalysisRequest
} from './gh-api-request';

const baseUrl = 'https://api.github.com';

export type RequestHandler = RestHandler<MockedRequest<DefaultBodyType>>;

export async function createRequestHandlers(scenarioDirPath: string): Promise<RequestHandler[]> {
  const requests = await readRequestFiles(scenarioDirPath);

  const handlers = [
    createGetRepoRequestHandler(requests),
    createSubmitVariantAnalysisRequestHandler(requests),
    createGetVariantAnalysisRequestHandler(requests),
    ...createGetVariantAnalysisRepoRequestHandlers(requests),
    ...createGetVariantAnalysisRepoResultRequestHandlers(requests),
  ];

  return handlers;
}

async function readRequestFiles(scenarioDirPath: string): Promise<GitHubApiRequest[]> {
  const files = await fs.readdir(scenarioDirPath);

  const orderedFiles = files.sort((a, b) => {
    const aNum = parseInt(a.split('-')[0]);
    const bNum = parseInt(b.split('-')[0]);
    return aNum - bNum;
  });

  const requests: GitHubApiRequest[] = [];
  for (const file of orderedFiles) {
    const filePath = path.join(scenarioDirPath, file);
    const request: GitHubApiRequest = await fs.readJson(filePath, { encoding: 'utf8' });
    requests.push(request);
  }

  return requests;
}

function createGetRepoRequestHandler(requests: GitHubApiRequest[]): RequestHandler {
  const getRepoRequests = requests.filter(isGetRepoRequest);

  if (getRepoRequests.length > 1) {
    throw Error('More than one get repo request found');
  }

  const getRepoRequest = getRepoRequests[0];

  return rest.get(`${baseUrl}/repos/:owner/:name`, (_req, res, ctx) => {
    return res(
      ctx.status(getRepoRequest.response.status),
      ctx.json(getRepoRequest.response.body),
    );
  });
}

function createSubmitVariantAnalysisRequestHandler(requests: GitHubApiRequest[]): RequestHandler {
  const submitVariantAnalysisRequests = requests.filter(isSubmitVariantAnalysisRequest);

  if (submitVariantAnalysisRequests.length > 1) {
    throw Error('More than one submit variant analysis request found');
  }

  const getRepoRequest = submitVariantAnalysisRequests[0];

  return rest.post(`${baseUrl}/repositories/:controllerRepoId/code-scanning/codeql/variant-analyses`, (_req, res, ctx) => {
    return res(
      ctx.status(getRepoRequest.response.status),
      ctx.json(getRepoRequest.response.body),
    );
  });
}

function createGetVariantAnalysisRequestHandler(requests: GitHubApiRequest[]): RequestHandler {
  const getVariantAnalysisRequests = requests.filter(isGetVariantAnalysisRequest);
  let requestIndex = 0;

  // During the lifetime of a variant analysis run, there are multiple requests
  // to get the variant analysis. We need to return different responses for each
  // request, so keep an index of the request and return the appropriate response.
  return rest.get(`${baseUrl}/repositories/:controllerRepoId/code-scanning/codeql/variant-analyses/:variantAnalysisId`, (_req, res, ctx) => {
    const request = getVariantAnalysisRequests[requestIndex];

    if (requestIndex < getVariantAnalysisRequests.length - 1) {
      // If there are more requests to come, increment the index.
      requestIndex++;
    }

    return res(
      ctx.status(request.response.status),
      ctx.json(request.response.body),
    );
  });
}

function createGetVariantAnalysisRepoRequestHandlers(requests: GitHubApiRequest[]): RequestHandler[] {
  const getVariantAnalysisRepoRequests = requests.filter(isGetVariantAnalysisRepoRequest);

  return getVariantAnalysisRepoRequests.map(request => rest.get(
    `${baseUrl}/repositories/:controllerRepoId/code-scanning/codeql/variant-analyses/:variantAnalysisId/repositories/${request.request.repositoryId}`,
    (_req, res, ctx) => {
      return res(
        ctx.status(request.response.status),
        ctx.json(request.response.body),
      );
    }));
}

function createGetVariantAnalysisRepoResultRequestHandlers(requests: GitHubApiRequest[]): RequestHandler[] {
  const getVariantAnalysisRepoResultRequests = requests.filter(isGetVariantAnalysisRepoResultRequest);

  return getVariantAnalysisRepoResultRequests.map(request => rest.get(
    `https://objects-origin.githubusercontent.com/codeql-query-console/codeql-variant-analysis-repo-tasks/:variantAnalysisId/${request.request.repositoryId}/*`,
    (_req, res, ctx) => {
      return res(
        ctx.status(request.response.status),
        ctx.body(request.response.body)
      );
    }));
}
