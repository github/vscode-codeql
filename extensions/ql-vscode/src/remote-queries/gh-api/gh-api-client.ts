import * as t from "io-ts";
import { fold, isLeft } from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import { Credentials } from "../../authentication";
import { OctokitResponse } from "@octokit/types/dist-types";
import { RemoteQueriesSubmission } from "../shared/remote-queries";
import { VariantAnalysisSubmission } from "../shared/variant-analysis";
import {
  VariantAnalysis,
  VariantAnalysisRepoTask,
  VariantAnalysisSubmissionRequest,
} from "./variant-analysis";
import { Repository } from "./repository";
import {
  RemoteQueriesResponse,
  RemoteQueriesSubmissionRequest,
} from "./remote-queries";

function stringify(v: any): string {
  if (typeof v === "function") {
    return t.getFunctionName(v);
  }
  if (typeof v === "number" && !isFinite(v)) {
    if (isNaN(v)) {
      return "NaN";
    }
    return v > 0 ? "Infinity" : "-Infinity";
  }
  return JSON.stringify(v);
}

function getContextPath(context: t.Context): string {
  return context.map(({ key }) => key).join(".");
}

function getMessage(e: t.ValidationError): string {
  return e.message !== undefined
    ? e.message
    : `Invalid value ${stringify(e.value)} supplied to ${getContextPath(
        e.context,
      )}`;
}

const getErrors = <A>(v: t.Validation<A>): string[] => {
  return pipe(
    v,
    fold(
      (errors) => errors.map(getMessage),
      () => ["no errors"],
    ),
  );
};

function validateApiResponse<T extends t.Any>(
  data: unknown,
  type: T,
): t.TypeOf<T> {
  const result = type.decode(data);
  if (isLeft(result)) {
    throw new Error(
      `Invalid response from GitHub API: ${getErrors(result).join(", ")}`,
    );
  }
  return result.right;
}

export async function submitVariantAnalysis(
  credentials: Credentials,
  submissionDetails: VariantAnalysisSubmission,
): Promise<VariantAnalysis> {
  const octokit = await credentials.getOctokit();

  const { actionRepoRef, query, databases, controllerRepoId } =
    submissionDetails;

  const data: VariantAnalysisSubmissionRequest = {
    action_repo_ref: actionRepoRef,
    language: query.language,
    query_pack: query.pack,
    repositories: databases.repositories,
    repository_lists: databases.repositoryLists,
    repository_owners: databases.repositoryOwners,
  };

  const response = await octokit.request(
    "POST /repositories/:controllerRepoId/code-scanning/codeql/variant-analyses",
    {
      controllerRepoId,
      data,
    },
  );

  return validateApiResponse(response.data, VariantAnalysis);
}

export async function getVariantAnalysis(
  credentials: Credentials,
  controllerRepoId: number,
  variantAnalysisId: number,
): Promise<VariantAnalysis> {
  const octokit = await credentials.getOctokit();

  const response = await octokit.request(
    "GET /repositories/:controllerRepoId/code-scanning/codeql/variant-analyses/:variantAnalysisId",
    {
      controllerRepoId,
      variantAnalysisId,
    },
  );

  return validateApiResponse(response.data, VariantAnalysis);
}

export async function getVariantAnalysisRepo(
  credentials: Credentials,
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number,
): Promise<VariantAnalysisRepoTask> {
  const octokit = await credentials.getOctokit();

  const response = await octokit.request(
    "GET /repositories/:controllerRepoId/code-scanning/codeql/variant-analyses/:variantAnalysisId/repositories/:repoId",
    {
      controllerRepoId,
      variantAnalysisId,
      repoId,
    },
  );

  return validateApiResponse(response.data, VariantAnalysisRepoTask);
}

export async function getVariantAnalysisRepoResult(
  credentials: Credentials,
  downloadUrl: string,
): Promise<ArrayBuffer> {
  const octokit = await credentials.getOctokit();
  const response = await octokit.request(`GET ${downloadUrl}`);

  return response.data;
}

export async function getRepositoryFromNwo(
  credentials: Credentials,
  owner: string,
  repo: string,
): Promise<Repository> {
  const octokit = await credentials.getOctokit();

  const response = await octokit.rest.repos.get({ owner, repo });
  return validateApiResponse(response.data, Repository);
}

/**
 * Creates a gist with the given description and files.
 * Returns the URL of the created gist.
 */
export async function createGist(
  credentials: Credentials,
  description: string,
  files: { [key: string]: { content: string } },
): Promise<string | undefined> {
  const octokit = await credentials.getOctokit();
  const response = await octokit.request("POST /gists", {
    description,
    files,
    public: false,
  });
  if (response.status >= 300) {
    throw new Error(
      `Error exporting variant analysis results: ${response.status} ${
        response?.data || ""
      }`,
    );
  }
  return response.data.html_url;
}

export async function submitRemoteQueries(
  credentials: Credentials,
  submissionDetails: RemoteQueriesSubmission,
): Promise<RemoteQueriesResponse> {
  const octokit = await credentials.getOctokit();

  const {
    ref,
    language,
    repositories,
    repositoryLists,
    repositoryOwners,
    queryPack,
    controllerRepoId,
  } = submissionDetails;

  const data: RemoteQueriesSubmissionRequest = {
    ref,
    language,
    repositories,
    repository_lists: repositoryLists,
    repository_owners: repositoryOwners,
    query_pack: queryPack,
  };

  const response: OctokitResponse<RemoteQueriesResponse> =
    await octokit.request(
      "POST /repositories/:controllerRepoId/code-scanning/codeql/queries",
      {
        controllerRepoId,
        data,
      },
    );

  return response.data;
}
