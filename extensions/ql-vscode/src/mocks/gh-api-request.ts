import * as t from "io-ts";
import { Repository } from "../remote-queries/gh-api/repository";
import {
  VariantAnalysis,
  VariantAnalysisRepoTask,
} from "../remote-queries/gh-api/variant-analysis";

// Types that represent requests/responses from the GitHub API
// that we need to mock.

export enum RequestKind {
  GetRepo = "getRepo",
  SubmitVariantAnalysis = "submitVariantAnalysis",
  GetVariantAnalysis = "getVariantAnalysis",
  GetVariantAnalysisRepo = "getVariantAnalysisRepo",
  GetVariantAnalysisRepoResult = "getVariantAnalysisRepoResult",
}

const buffer = new t.Type<Buffer, Buffer, unknown>(
  "string",
  (input: unknown): input is Buffer =>
    typeof input === "object" && input instanceof Buffer,
  // `t.success` and `t.failure` are helpers used to build `Either` instances
  (input, context) =>
    typeof input === "object" && input instanceof Buffer
      ? t.success(input)
      : t.failure(input, context),
  // `A` and `O` are the same, so `encode` is just the identity function
  t.identity,
);

export const BasicErorResponse = t.type({
  message: t.string,
});

export type BasicErorResponse = t.TypeOf<typeof BasicErorResponse>;

export const GetRepoRequest = t.type({
  request: t.type({
    kind: t.literal(RequestKind.GetRepo),
  }),
  response: t.intersection([
    t.type({
      status: t.number,
    }),
    t.partial({
      body: t.union([Repository, BasicErorResponse]),
    }),
  ]),
});

export type GetRepoRequest = t.TypeOf<typeof GetRepoRequest>;

export const SubmitVariantAnalysisRequest = t.type({
  request: t.type({
    kind: t.literal(RequestKind.SubmitVariantAnalysis),
  }),
  response: t.intersection([
    t.type({
      status: t.number,
    }),
    t.partial({
      body: t.union([VariantAnalysis, BasicErorResponse]),
    }),
  ]),
});

export type SubmitVariantAnalysisRequest = t.TypeOf<
  typeof SubmitVariantAnalysisRequest
>;

export const GetVariantAnalysisRequest = t.type({
  request: t.type({
    kind: t.literal(RequestKind.GetVariantAnalysis),
  }),
  response: t.intersection([
    t.type({
      status: t.number,
    }),
    t.partial({
      body: t.union([VariantAnalysis, BasicErorResponse]),
    }),
  ]),
});

export type GetVariantAnalysisRequest = t.TypeOf<
  typeof GetVariantAnalysisRequest
>;

export const GetVariantAnalysisRepoRequest = t.type({
  request: t.type({
    kind: t.literal(RequestKind.GetVariantAnalysisRepo),
    repositoryId: t.number,
  }),
  response: t.intersection([
    t.type({
      status: t.number,
    }),
    t.partial({
      body: t.union([VariantAnalysisRepoTask, BasicErorResponse]),
    }),
  ]),
});

export type GetVariantAnalysisRepoRequest = t.TypeOf<
  typeof GetVariantAnalysisRepoRequest
>;

export const GetVariantAnalysisRepoResultRequest = t.type({
  request: t.type({
    kind: t.literal(RequestKind.GetVariantAnalysisRepoResult),
    repositoryId: t.number,
  }),
  response: t.intersection([
    t.type({
      status: t.number,
      contentType: t.string,
    }),
    t.partial({
      body: t.union([t.string, buffer]),
    }),
  ]),
});

export type GetVariantAnalysisRepoResultRequest = t.TypeOf<
  typeof GetVariantAnalysisRepoResultRequest
>;

export const GitHubApiRequest = t.union([
  GetRepoRequest,
  SubmitVariantAnalysisRequest,
  GetVariantAnalysisRequest,
  GetVariantAnalysisRepoRequest,
  GetVariantAnalysisRepoResultRequest,
]);

export type GitHubApiRequest = t.TypeOf<typeof GitHubApiRequest>;

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
