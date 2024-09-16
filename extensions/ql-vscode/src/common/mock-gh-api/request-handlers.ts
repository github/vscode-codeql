import { join } from "path";
import { readdir, readJson, readFile } from "fs-extra";
import type { RequestHandler } from "msw";
import { http } from "msw";
import type { GitHubApiRequest } from "./gh-api-request";
import {
  isCodeSearchRequest,
  isGetRepoRequest,
  isGetVariantAnalysisRepoRequest,
  isGetVariantAnalysisRepoResultRequest,
  isGetVariantAnalysisRequest,
  isSubmitVariantAnalysisRequest,
} from "./gh-api-request";

const baseUrl = "https://api.github.com";

const jsonResponse = <T>(
  body: T,
  init?: ResponseInit,
  contentType = "application/json",
): Response => {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": contentType,
      ...init?.headers,
    },
  });
};

export async function createRequestHandlers(
  scenarioDirPath: string,
): Promise<RequestHandler[]> {
  const requests = await readRequestFiles(scenarioDirPath);

  const handlers = [
    createGetRepoRequestHandler(requests),
    createSubmitVariantAnalysisRequestHandler(requests),
    createGetVariantAnalysisRequestHandler(requests),
    createGetVariantAnalysisRepoRequestHandler(requests),
    createGetVariantAnalysisRepoResultRequestHandler(requests),
    createCodeSearchRequestHandler(requests),
  ];

  return handlers;
}

async function readRequestFiles(
  scenarioDirPath: string,
): Promise<GitHubApiRequest[]> {
  const files = await readdir(scenarioDirPath);

  const orderedFiles = files.sort((a, b) => {
    const aNum = parseInt(a.split("-")[0]);
    const bNum = parseInt(b.split("-")[0]);
    return aNum - bNum;
  });

  const requests: GitHubApiRequest[] = [];
  for (const file of orderedFiles) {
    if (!file.endsWith(".json")) {
      continue;
    }

    const filePath = join(scenarioDirPath, file);
    const request: GitHubApiRequest = await readJson(filePath, {
      encoding: "utf8",
    });

    if (
      typeof request.response.body === "string" &&
      request.response.body.startsWith("file:")
    ) {
      request.response.body = await readFile(
        join(scenarioDirPath, request.response.body.substring(5)),
      );
    }

    requests.push(request);
  }

  return requests;
}

function createGetRepoRequestHandler(
  requests: GitHubApiRequest[],
): RequestHandler {
  const getRepoRequests = requests.filter(isGetRepoRequest);

  if (getRepoRequests.length > 1) {
    throw Error("More than one get repo request found");
  }

  const getRepoRequest = getRepoRequests[0];

  return http.get(`${baseUrl}/repos/:owner/:name`, () => {
    return jsonResponse(getRepoRequest.response.body, {
      status: getRepoRequest.response.status,
    });
  });
}

function createSubmitVariantAnalysisRequestHandler(
  requests: GitHubApiRequest[],
): RequestHandler {
  const submitVariantAnalysisRequests = requests.filter(
    isSubmitVariantAnalysisRequest,
  );

  if (submitVariantAnalysisRequests.length > 1) {
    throw Error("More than one submit variant analysis request found");
  }

  const getRepoRequest = submitVariantAnalysisRequests[0];

  return http.post(
    `${baseUrl}/repositories/:controllerRepoId/code-scanning/codeql/variant-analyses`,
    () => {
      return jsonResponse(getRepoRequest.response.body, {
        status: getRepoRequest.response.status,
      });
    },
  );
}

function createGetVariantAnalysisRequestHandler(
  requests: GitHubApiRequest[],
): RequestHandler {
  const getVariantAnalysisRequests = requests.filter(
    isGetVariantAnalysisRequest,
  );
  let requestIndex = 0;

  // During the lifetime of a variant analysis run, there are multiple requests
  // to get the variant analysis. We need to return different responses for each
  // request, so keep an index of the request and return the appropriate response.
  return http.get(
    `${baseUrl}/repositories/:controllerRepoId/code-scanning/codeql/variant-analyses/:variantAnalysisId`,
    () => {
      const request = getVariantAnalysisRequests[requestIndex];

      if (requestIndex < getVariantAnalysisRequests.length - 1) {
        // If there are more requests to come, increment the index.
        requestIndex++;
      }

      return jsonResponse(request.response.body, {
        status: request.response.status,
      });
    },
  );
}

function createGetVariantAnalysisRepoRequestHandler(
  requests: GitHubApiRequest[],
): RequestHandler {
  const getVariantAnalysisRepoRequests = requests.filter(
    isGetVariantAnalysisRepoRequest,
  );

  return http.get(
    `${baseUrl}/repositories/:controllerRepoId/code-scanning/codeql/variant-analyses/:variantAnalysisId/repositories/:repoId`,
    ({ request, params }) => {
      const scenarioRequest = getVariantAnalysisRepoRequests.find(
        (r) => r.request.repositoryId.toString() === params.repoId,
      );
      if (!scenarioRequest) {
        throw Error(`No scenario request found for ${request.url}`);
      }

      return jsonResponse(scenarioRequest.response.body, {
        status: scenarioRequest.response.status,
      });
    },
  );
}

function createGetVariantAnalysisRepoResultRequestHandler(
  requests: GitHubApiRequest[],
): RequestHandler {
  const getVariantAnalysisRepoResultRequests = requests.filter(
    isGetVariantAnalysisRepoResultRequest,
  );

  return http.get(
    "https://objects-origin.githubusercontent.com/codeql-query-console/codeql-variant-analysis-repo-tasks/:variantAnalysisId/:repoId/*",
    ({ request, params }) => {
      const scenarioRequest = getVariantAnalysisRepoResultRequests.find(
        (r) => r.request.repositoryId.toString() === params.repoId,
      );
      if (!scenarioRequest) {
        throw Error(`No scenario request found for ${request.url}`);
      }

      if (scenarioRequest.response.body) {
        return new Response(scenarioRequest.response.body, {
          status: scenarioRequest.response.status,
          headers: {
            "Content-Type": scenarioRequest.response.contentType,
          },
        });
      } else {
        return new Response(null, { status: scenarioRequest.response.status });
      }
    },
  );
}

function createCodeSearchRequestHandler(
  requests: GitHubApiRequest[],
): RequestHandler {
  const codeSearchRequests = requests.filter(isCodeSearchRequest);
  let requestIndex = 0;

  // During a code search, there are multiple request to get pages of results. We
  // need to return different responses for each request, so keep an index of the
  // request and return the appropriate response.
  return http.get(`${baseUrl}/search/code`, () => {
    const request = codeSearchRequests[requestIndex];

    if (requestIndex < codeSearchRequests.length - 1) {
      // If there are more requests to come, increment the index.
      requestIndex++;
    }

    return jsonResponse(request.response.body, {
      status: request.response.status,
    });
  });
}
