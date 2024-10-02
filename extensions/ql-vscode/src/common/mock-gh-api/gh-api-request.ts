import type { Repository } from "../../variant-analysis/gh-api/repository";
import type {
  VariantAnalysis,
  VariantAnalysisRepoTask,
} from "../../variant-analysis/gh-api/variant-analysis";

// Types that represent requests/responses from the GitHub API
// that we need to mock.

export enum RequestKind {
  GetRepo = "getRepo",
  SubmitVariantAnalysis = "submitVariantAnalysis",
  GetVariantAnalysis = "getVariantAnalysis",
  GetVariantAnalysisRepo = "getVariantAnalysisRepo",
  GetVariantAnalysisRepoResult = "getVariantAnalysisRepoResult",
  CodeSearch = "codeSearch",
}

export interface BasicErrorResponse {
  message: string;
}

interface GetRepoRequest {
  request: {
    kind: RequestKind.GetRepo;
  };
  response: {
    status: number;
    body: Repository | BasicErrorResponse | undefined;
  };
}

interface SubmitVariantAnalysisRequest {
  request: {
    kind: RequestKind.SubmitVariantAnalysis;
  };
  response: {
    status: number;
    body?: VariantAnalysis | BasicErrorResponse;
  };
}

interface GetVariantAnalysisRequest {
  request: {
    kind: RequestKind.GetVariantAnalysis;
  };
  response: {
    status: number;
    body?: VariantAnalysis | BasicErrorResponse;
  };
}

interface GetVariantAnalysisRepoRequest {
  request: {
    kind: RequestKind.GetVariantAnalysisRepo;
    repositoryId: number;
  };
  response: {
    status: number;
    body?: VariantAnalysisRepoTask | BasicErrorResponse;
  };
}

export interface GetVariantAnalysisRepoResultRequest {
  request: {
    kind: RequestKind.GetVariantAnalysisRepoResult;
    repositoryId: number;
  };
  response: {
    status: number;
    body?: ArrayBuffer | string;
    contentType: string;
  };
}

export interface CodeSearchResponse {
  total_count: number;
  items: Array<{
    repository: Repository;
  }>;
}

interface CodeSearchRequest {
  request: {
    kind: RequestKind.CodeSearch;
    query: string;
  };
  response: {
    status: number;
    body?: CodeSearchResponse | BasicErrorResponse;
  };
}

export type GitHubApiRequest =
  | GetRepoRequest
  | SubmitVariantAnalysisRequest
  | GetVariantAnalysisRequest
  | GetVariantAnalysisRepoRequest
  | GetVariantAnalysisRepoResultRequest
  | CodeSearchRequest;

export const isGetRepoRequest = (
  request: GitHubApiRequest,
): request is GetRepoRequest => request.request.kind === RequestKind.GetRepo;

export const isSubmitVariantAnalysisRequest = (
  request: GitHubApiRequest,
): request is SubmitVariantAnalysisRequest =>
  request.request.kind === RequestKind.SubmitVariantAnalysis;

export const isGetVariantAnalysisRequest = (
  request: GitHubApiRequest,
): request is GetVariantAnalysisRequest =>
  request.request.kind === RequestKind.GetVariantAnalysis;

export const isGetVariantAnalysisRepoRequest = (
  request: GitHubApiRequest,
): request is GetVariantAnalysisRepoRequest =>
  request.request.kind === RequestKind.GetVariantAnalysisRepo;

export const isGetVariantAnalysisRepoResultRequest = (
  request: GitHubApiRequest,
): request is GetVariantAnalysisRepoResultRequest =>
  request.request.kind === RequestKind.GetVariantAnalysisRepoResult;

export const isCodeSearchRequest = (
  request: GitHubApiRequest,
): request is CodeSearchRequest =>
  request.request.kind === RequestKind.CodeSearch;
