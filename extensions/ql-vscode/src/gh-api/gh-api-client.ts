import * as file from '../common/file';
import * as path from 'path';
import * as fs from 'fs-extra';
import fetch from 'node-fetch';
import { Credentials } from '../authentication';
import { OctokitResponse } from '@octokit/types/dist-types';
import { VariantAnalysisSubmission } from '../remote-queries/shared/variant-analysis';
import {
  VariantAnalysis,
  VariantAnalysisLanguage,
  VariantAnalysisRepoTask,
  VariantAnalysisSubmissionRequest
} from './variant-analysis-models';

export async function submitVariantAnalysis(
  credentials: Credentials,
  analysisSubmission: VariantAnalysisSubmission
): Promise<VariantAnalysis> {
  const octokit = await credentials.getOctokit();

  const { actionRepoRef, query, databases } = analysisSubmission;

  const data: VariantAnalysisSubmissionRequest = {
    action_repo_ref: actionRepoRef,
    language: query.language as VariantAnalysisLanguage, // TODO: Validate language?
    query_pack: query.pack,
    repositories: databases.repositories,
    repository_lists: databases.repositoryLists,
    repository_owners: databases.repositoryOwners,
  };

  try {
    const response: OctokitResponse<VariantAnalysis, number> = await octokit.request(
      'POST /repositories/:controllerRepoId/code-scanning/codeql/variant-analyses',
      {
        controllerRepoId: analysisSubmission.controllerRepoId,
        data
      }
    );
    return response.data;
  }
  catch (error: any) {
    // TODO: Don't catch?
    throw Error('Failed to submit variant analysis: ' + error.message);
  }
}

export async function getVariantAnalysis(
  credentials: Credentials,
  controllerRepoId: number,
  variantAnalysisId: number
): Promise<VariantAnalysis> {
  const octokit = await credentials.getOctokit();

  try {
    const response: OctokitResponse<VariantAnalysis, number> = await octokit.request(
      'GET /repositories/:controllerRepoId/code-scanning/codeql/variant-analyses/:variantAnalysisId',
      {
        controllerRepoId,
        variantAnalysisId
      }
    );
    return response.data;
  }
  catch (error: any) {
    throw Error('Failed to get variant analysis: ' + error.message);
    // TODO: Handle different error cases.
    // - No access to feature (403)
    // - Not found (404)
    //   - Controller repo not found
    //   - Variant analysis not found
    //   - Enterprise :D 
    // => Mark as failed locally
    // - 503
    //   => Keep monitoring/try later
  }
}

export async function getVariantAnalysisRepo(
  credentials: Credentials,
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number
): Promise<VariantAnalysisRepoTask> {
  const octokit = await credentials.getOctokit();

  try {
    const response: OctokitResponse<VariantAnalysisRepoTask, number> = await octokit.request(
      'GET /repositories/:controllerRepoId/code-scanning/codeql/variant-analyses/:variantAnalysisId/repositories/:repoId',
      {
        controllerRepoId,
        variantAnalysisId,
        repoId: repoId
      }
    );
    return response.data;
  }
  catch (error: any) {
    throw Error('Failed to get variant analysis: ' + error.message);
    // TODO: Handle different error cases.
  }
}

export async function downloadVariantAnalysisResults(
  resultsUrl: string,
  storagePath: string
): Promise<void> {
  const headers = { 'Accept': 'application/zip' };
  const response = await fetch(resultsUrl, { headers });
  if (!response.ok) {
    throw Error(`Failed to download ${resultsUrl}. Server responded with ${response.statusText}. ${response.body}`);
  }

  const zipPath = path.join(storagePath, 'results.zip');
  const fileStream = fs.createWriteStream(zipPath);

  await new Promise((resolve, reject) =>
    response.body.pipe(fileStream)
      .on('finish', resolve)
      .on('error', reject)
  );

  await file.unzipFile(zipPath, storagePath);
  await fs.remove(zipPath);
}

export async function getRepositoryIdFromNwo(
  credentials: Credentials,
  owner: string,
  repo: string
): Promise<number> {
  const octokit = await credentials.getOctokit();
  try {
    const response = await octokit.rest.repos.get({ owner, repo });
    return response.data.id;
  } catch (error: any) {
    throw Error('Failed to get repository: ' + error.message);
  }
}
