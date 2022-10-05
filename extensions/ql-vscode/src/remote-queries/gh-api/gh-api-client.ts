import { Credentials } from '../../authentication';
import { OctokitResponse } from '@octokit/types/dist-types';
import { VariantAnalysisSubmission } from '../shared/variant-analysis';
import {
  VariantAnalysis,
  VariantAnalysisRepoTask,
  VariantAnalysisSubmissionRequest
} from './variant-analysis';
import { Repository } from './repository';

export async function submitVariantAnalysis(
  credentials: Credentials,
  submissionDetails: VariantAnalysisSubmission
): Promise<VariantAnalysis> {
  const octokit = await credentials.getOctokit();

  const { actionRepoRef, query, databases, controllerRepoId } = submissionDetails;

  const data: VariantAnalysisSubmissionRequest = {
    action_repo_ref: actionRepoRef,
    language: query.language,
    query_pack: query.pack,
    repositories: databases.repositories,
    repository_lists: databases.repositoryLists,
    repository_owners: databases.repositoryOwners,
  };

  const response: OctokitResponse<VariantAnalysis> = await octokit.request(
    'POST /repositories/:controllerRepoId/code-scanning/codeql/variant-analyses',
    {
      controllerRepoId,
      data
    }
  );

  return response.data;
}

export async function getVariantAnalysis(
  credentials: Credentials,
  controllerRepoId: number,
  variantAnalysisId: number
): Promise<VariantAnalysis> {
  const octokit = await credentials.getOctokit();

  const response: OctokitResponse<VariantAnalysis> = await octokit.request(
    'GET /repositories/:controllerRepoId/code-scanning/codeql/variant-analyses/:variantAnalysisId',
    {
      controllerRepoId,
      variantAnalysisId
    }
  );

  return response.data;
}

export async function getVariantAnalysisRepo(
  credentials: Credentials,
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number
): Promise<VariantAnalysisRepoTask> {
  const octokit = await credentials.getOctokit();

  const response: OctokitResponse<VariantAnalysisRepoTask> = await octokit.request(
    'GET /repositories/:controllerRepoId/code-scanning/codeql/variant-analyses/:variantAnalysisId/repositories/:repoId',
    {
      controllerRepoId,
      variantAnalysisId,
      repoId
    }
  );

  return response.data;
}

export async function getVariantAnalysisRepoResult(
  credentials: Credentials,
  downloadUrl: string,
): Promise<unknown> {
  const octokit = await credentials.getOctokit();

  const response: OctokitResponse<VariantAnalysisRepoTask> = await octokit.request(
    `GET ${downloadUrl}`
  );

  return response.data;
}

export async function getRepositoryFromNwo(
  credentials: Credentials,
  owner: string,
  repo: string
): Promise<Repository> {
  const octokit = await credentials.getOctokit();

  const response = await octokit.rest.repos.get({ owner, repo });
  return response.data as Repository;
}
