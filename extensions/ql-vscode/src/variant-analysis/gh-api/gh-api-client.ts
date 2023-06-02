import { OctokitResponse } from "@octokit/types/dist-types";
import { Credentials } from "../../common/authentication";
import { VariantAnalysisSubmission } from "../shared/variant-analysis";
import {
  VariantAnalysis,
  VariantAnalysisRepoTask,
  VariantAnalysisSubmissionRequest,
} from "./variant-analysis";
import { Repository } from "./repository";
import { Progress } from "vscode";
import { CancellationToken } from "vscode-jsonrpc";
import { throttling } from "@octokit/plugin-throttling";
import { Octokit } from "@octokit/rest";

export async function getCodeSearchRepositories(
  credentials: Credentials,
  query: string,
  progress: Progress<{
    message?: string | undefined;
    increment?: number | undefined;
  }>,
  token: CancellationToken,
): Promise<string[]> {
  let nwos: string[] = [];
  const MyOctokit = Octokit.plugin(throttling);
  const auth = await credentials.getAccessToken();

  const octokit = new MyOctokit({
    auth,
    throttle: {
      onRateLimit: (
        retryAfter: number,
        options: any,
        octokit: Octokit,
      ): boolean => {
        octokit.log.warn(
          `Request quota exhausted for request ${options.method} ${options.url}. Retrying after ${retryAfter} seconds!`,
        );

        return true;
      },
      onSecondaryRateLimit: (
        _retryAfter: number,
        options: any,
        octokit: Octokit,
      ): void => {
        octokit.log.warn(
          `SecondaryRateLimit detected for request ${options.method} ${options.url}`,
        );
      },
    },
  });

  for await (const response of octokit.paginate.iterator(
    octokit.rest.search.code,
    {
      q: query,
      per_page: 100,
    },
  )) {
    nwos.push(...response.data.map((item) => item.repository.full_name));
    // calculate progress bar: 80% of the progress bar is used for the code search
    const totalNumberOfRequests = Math.ceil(response.data.total_count / 100);
    // Since we have a maximum of 1000 responses of the api, we can use a fixed increment whenever the totalNumberOfRequests would be greater than 10
    const increment =
      totalNumberOfRequests < 10 ? 80 / totalNumberOfRequests : 8;
    progress.report({ increment });

    if (token.isCancellationRequested) {
      nwos = [];
      break;
    }
  }

  return [...new Set(nwos)];
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
