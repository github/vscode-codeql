import { Repository } from '../remote-queries/gh-api/repository';
import { VariantAnalysis, VariantAnalysisRepoTask } from '../remote-queries/gh-api/variant-analysis';

// Types that represent requests/responses from the GitHub API
// that we need to mock.

export enum RequestKind {
  GetRepo = 'getRepo',
  SubmitVariantAnalysis = 'submitVariantAnalysis',
  GetVariantAnalysis = 'getVariantAnalysis',
  GetVariantAnalysisRepo = 'getVariantAnalysisRepo',
  GetVariantAnalysisRepoResult = 'getVariantAnalysisRepoResult',
}

export interface BasicErorResponse {
  message: string;
}

export interface GetRepoRequest {
  request: {
    kind: RequestKind.GetRepo
  },
  response: {
    status: number,
    body: Repository | BasicErorResponse | undefined
  }
}

export interface SubmitVariantAnalysisRequest {
  request: {
    kind: RequestKind.SubmitVariantAnalysis
  },
  response: {
    status: number,
    body: VariantAnalysis | BasicErorResponse | undefined
  }
}

export interface GetVariantAnalysisRequest {
  request: {
    kind: RequestKind.GetVariantAnalysis
  },
  response: {
    status: number,
    body: VariantAnalysis | BasicErorResponse | undefined
  }
}

export interface GetVariantAnalysisRepoRequest {
  request: {
    kind: RequestKind.GetVariantAnalysisRepo,
    repositoryId: number
  },
  response: {
    status: number,
    body: VariantAnalysisRepoTask | BasicErorResponse | undefined
  }
}

export interface GetVariantAnalysisRepoResultRequest {
  request: {
    kind: RequestKind.GetVariantAnalysisRepoResult,
    repositoryId: number
  },
  response: {
    status: number,
    body: ArrayBuffer | undefined
  }
}

export type GitHubApiRequest =
  | GetRepoRequest
  | SubmitVariantAnalysisRequest
  | GetVariantAnalysisRequest
  | GetVariantAnalysisRepoRequest
  | GetVariantAnalysisRepoResultRequest;
