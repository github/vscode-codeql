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

  const response: OctokitResponse<VariantAnalysis> = await octokit.request(
    "POST /repositories/:controllerRepoId/code-scanning/codeql/variant-analyses",
    {
      controllerRepoId,
      data,
    },
  );

  return response.data;
}

export async function getVariantAnalysis(
  credentials: Credentials,
  controllerRepoId: number,
  variantAnalysisId: number,
): Promise<VariantAnalysis> {
  const octokit = await credentials.getOctokit();

  const response: OctokitResponse<VariantAnalysis> = await octokit.request(
    "GET /repositories/:controllerRepoId/code-scanning/codeql/variant-analyses/:variantAnalysisId",
    {
      controllerRepoId,
      variantAnalysisId,
    },
  );

  return response.data;
}

export async function getVariantAnalysisRepo(
  credentials: Credentials,
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number,
): Promise<VariantAnalysisRepoTask> {
  const octokit = await credentials.getOctokit();

  const response: OctokitResponse<VariantAnalysisRepoTask> =
    await octokit.request(
      "GET /repositories/:controllerRepoId/code-scanning/codeql/variant-analyses/:variantAnalysisId/repositories/:repoId",
      {
        controllerRepoId,
        variantAnalysisId,
        repoId,
      },
    );

  return response.data;
}

export async function getRepositoryFromNwo(
  credentials: Credentials,
  owner: string,
  repo: string,
): Promise<Repository> {
  const octokit = await credentials.getOctokit();

  const response = await octokit.rest.repos.get({ owner, repo });
  return response.data as Repository;
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
