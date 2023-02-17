import { Repository } from "../variant-analysis/gh-api/repository";
import {
  VariantAnalysis,
  VariantAnalysisRepoTask,
} from "../variant-analysis/gh-api/variant-analysis";

// Types that represent requests/responses from the GitHub API
// that we need to mock.

export enum RequestKind {
  GetRepo = "getRepo",
  SubmitVariantAnalysis = "submitVariantAnalysis",
  GetVariantAnalysis = "getVariantAnalysis",
  GetVariantAnalysisRepo = "getVariantAnalysisRepo",
  GetVariantAnalysisRepoResult = "getVariantAnalysisRepoResult",
}

export interface BasicErorResponse {
  message: string;
}

export interface GetRepoRequest {
  request: {
    kind: RequestKind.GetRepo;
  };
  response: {
    status: number;
    body: Repository | BasicErorResponse | undefined;
  };
}

export interface SubmitVariantAnalysisRequest {
  request: {
    kind: RequestKind.SubmitVariantAnalysis;
  };
  response: {
    status: number;
    body?: VariantAnalysis | BasicErorResponse;
  };
}

export interface GetVariantAnalysisRequest {
  request: {
    kind: RequestKind.GetVariantAnalysis;
  };
  response: {
    status: number;
    body?: VariantAnalysis | BasicErorResponse;
  };
}

export interface GetVariantAnalysisRepoRequest {
  request: {
    kind: RequestKind.GetVariantAnalysisRepo;
    repositoryId: number;
  };
  response: {
    status: number;
    body?: VariantAnalysisRepoTask | BasicErorResponse;
  };
}

export interface GetVariantAnalysisRepoResultRequest {
  request: {
    kind: RequestKind.GetVariantAnalysisRepoResult;
    repositoryId: number;
  };
  response: {
    status: number;
    body?: Buffer | string;
    contentType: string;
  };
}

export type GitHubApiRequest =
  | GetRepoRequest
  | SubmitVariantAnalysisRequest
  | GetVariantAnalysisRequest
  | GetVariantAnalysisRepoRequest
  | GetVariantAnalysisRepoResultRequest;

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
