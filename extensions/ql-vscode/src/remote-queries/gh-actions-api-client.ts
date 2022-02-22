import * as unzipper from 'unzipper';
import * as path from 'path';
import * as fs from 'fs-extra';
import { showAndLogWarningMessage, tmpDir } from '../helpers';
import { Credentials } from '../authentication';
import { logger } from '../logging';
import { RemoteQueryWorkflowResult } from './remote-query-workflow-result';
import { DownloadLink } from './download-link';
import { RemoteQuery } from './remote-query';
import { RemoteQueryFailureIndexItem, RemoteQueryResultIndex, RemoteQuerySuccessIndexItem } from './remote-query-result-index';

interface ApiSuccessIndexItem {
  nwo: string;
  id: string;
  results_count: number;
  bqrs_file_size: number;
  sarif_file_size?: number;
}

interface ApiFailureIndexItem {
  nwo: string;
  id: string;
  error: string;
}

interface ApiResultIndex {
  successes: ApiSuccessIndexItem[];
  failures: ApiFailureIndexItem[];
}

export async function getRemoteQueryIndex(
  credentials: Credentials,
  remoteQuery: RemoteQuery
): Promise<RemoteQueryResultIndex | undefined> {
  const controllerRepo = remoteQuery.controllerRepository;
  const owner = controllerRepo.owner;
  const repoName = controllerRepo.name;
  const workflowRunId = remoteQuery.actionsWorkflowRunId;

  const workflowUri = `https://github.com/${owner}/${repoName}/actions/runs/${workflowRunId}`;
  const artifactsUrlPath = `/repos/${owner}/${repoName}/actions/artifacts`;

  const artifactList = await listWorkflowRunArtifacts(credentials, owner, repoName, workflowRunId);
  const resultIndexArtifactId = getArtifactIDfromName('result-index', workflowUri, artifactList);
  const resultIndex = await getResultIndex(credentials, owner, repoName, resultIndexArtifactId);

  const successes = resultIndex?.successes.map(item => {
    const artifactId = getArtifactIDfromName(item.id, workflowUri, artifactList);

    return {
      id: item.id.toString(),
      artifactId: artifactId,
      nwo: item.nwo,
      resultCount: item.results_count,
      bqrsFileSize: item.bqrs_file_size,
      sarifFileSize: item.sarif_file_size
    } as RemoteQuerySuccessIndexItem;
  });

  const failures = resultIndex?.failures.map(item => {
    return {
      id: item.id.toString(),
      nwo: item.nwo,
      error: item.error
    } as RemoteQueryFailureIndexItem;
  });

  return {
    artifactsUrlPath,
    successes: successes || [],
    failures: failures || []
  };
}

export async function downloadArtifactFromLink(
  credentials: Credentials,
  storagePath: string,
  downloadLink: DownloadLink
): Promise<string> {

  const octokit = await credentials.getOctokit();

  // Download the zipped artifact.
  const response = await octokit.request(`GET ${downloadLink.urlPath}/zip`, {});

  const zipFilePath = path.join(storagePath, downloadLink.queryId, `${downloadLink.id}.zip`);
  await saveFile(`${zipFilePath}`, response.data as ArrayBuffer);

  // Extract the zipped artifact.
  const extractedPath = path.join(storagePath, downloadLink.queryId, downloadLink.id);
  await unzipFile(zipFilePath, extractedPath);

  return path.join(extractedPath, downloadLink.innerFilePath || '');
}

/**
 * Downloads the result index artifact and extracts the result index items.
 * @param credentials Credentials for authenticating to the GitHub API.
 * @param owner
 * @param repo
 * @param workflowRunId The ID of the workflow run to get the result index for.
 * @returns An object containing the result index.
 */
async function getResultIndex(
  credentials: Credentials,
  owner: string,
  repo: string,
  artifactId: number
): Promise<ApiResultIndex | undefined> {
  const artifactPath = await downloadArtifact(credentials, owner, repo, artifactId);
  const indexFilePath = path.join(artifactPath, 'index.json');
  if (!(await fs.pathExists(indexFilePath))) {
    void showAndLogWarningMessage('Could not find an `index.json` file in the result artifact.');
    return undefined;
  }
  const resultIndex = await fs.readFile(path.join(artifactPath, 'index.json'), 'utf8');

  try {
    return JSON.parse(resultIndex);
  } catch (error) {
    throw new Error(`Invalid result index file: ${error}`);
  }
}

/**
 * Gets the status of a workflow run.
 * @param credentials Credentials for authenticating to the GitHub API.
 * @param owner
 * @param repo
 * @param workflowRunId The ID of the workflow run to get the result index for.
 * @returns The workflow run status.
 */
export async function getWorkflowStatus(
  credentials: Credentials,
  owner: string,
  repo: string,
  workflowRunId: number): Promise<RemoteQueryWorkflowResult> {
  const octokit = await credentials.getOctokit();

  const workflowRun = await octokit.rest.actions.getWorkflowRun({
    owner,
    repo,
    run_id: workflowRunId
  });

  if (workflowRun.data.status === 'completed') {
    if (workflowRun.data.conclusion === 'success') {
      return { status: 'CompletedSuccessfully' };
    } else {
      const error = getWorkflowError(workflowRun.data.conclusion);
      return { status: 'CompletedUnsuccessfully', error };
    }
  }

  return { status: 'InProgress' };
}

/**
 * Lists the workflow run artifacts for the given workflow run ID.
 * @param credentials Credentials for authenticating to the GitHub API.
 * @param owner
 * @param repo
 * @param workflowRunId The ID of the workflow run to list artifacts for.
 * @returns An array of artifact details (including artifact name and ID).
 */
async function listWorkflowRunArtifacts(
  credentials: Credentials,
  owner: string,
  repo: string,
  workflowRunId: number
) {
  const octokit = await credentials.getOctokit();

  // There are limits on the number of artifacts that are returned by the API
  // so we use paging to make sure we retrieve all of them.
  let morePages = true;
  let pageNum = 1;
  const allArtifacts = [];

  while (morePages) {
    const response = await octokit.rest.actions.listWorkflowRunArtifacts({
      owner,
      repo,
      run_id: workflowRunId,
      per_page: 100,
      page: pageNum
    });

    allArtifacts.push(...response.data.artifacts);
    pageNum++;
    if (response.data.artifacts.length < 100) {
      morePages = false;
    }
  }

  return allArtifacts;
}

/**
 * @param artifactName The artifact name, as a string.
 * @param artifacts An array of artifact details (from the "list workflow run artifacts" API response).
 * @returns The artifact ID corresponding to the given artifact name.
 */
function getArtifactIDfromName(
  artifactName: string,
  workflowUri: string,
  artifacts: Array<{ id: number, name: string }>
): number {
  const artifact = artifacts.find(a => a.name === artifactName);

  if (!artifact) {
    const errorMessage =
      `Could not find artifact with name ${artifactName} in workflow ${workflowUri}.
      Please check whether the workflow run has successfully completed.`;
    throw Error(errorMessage);
  }

  return artifact?.id;
}

/**
 * Downloads an artifact from a workflow run.
 * @param credentials Credentials for authenticating to the GitHub API.
 * @param owner
 * @param repo
 * @param artifactId The ID of the artifact to download.
 * @returns The path to the enclosing directory of the unzipped artifact.
 */
async function downloadArtifact(
  credentials: Credentials,
  owner: string,
  repo: string,
  artifactId: number
): Promise<string> {
  const octokit = await credentials.getOctokit();
  const response = await octokit.rest.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: artifactId,
    archive_format: 'zip',
  });
  const artifactPath = path.join(tmpDir.name, `${artifactId}`);
  await saveFile(`${artifactPath}.zip`, response.data as ArrayBuffer);
  await unzipFile(`${artifactPath}.zip`, artifactPath);
  return artifactPath;
}

async function saveFile(filePath: string, data: ArrayBuffer): Promise<void> {
  void logger.log(`Saving file to ${filePath}`);
  await fs.writeFile(filePath, Buffer.from(data));
}

async function unzipFile(sourcePath: string, destinationPath: string) {
  void logger.log(`Unzipping file to ${destinationPath}`);
  const file = await unzipper.Open.file(sourcePath);
  await file.extract({ path: destinationPath });
}

function getWorkflowError(conclusion: string | null): string {
  if (!conclusion) {
    return 'Workflow finished without a conclusion';
  }

  if (conclusion === 'cancelled') {
    return 'The remote query execution was cancelled.';
  }

  if (conclusion === 'timed_out') {
    return 'The remote query execution timed out.';
  }

  if (conclusion === 'failure') {
    // TODO: Get the actual error from the workflow or potentially
    // from an artifact from the action itself.
    return 'The remote query execution has failed.';
  }

  return `Unexpected query execution conclusion: ${conclusion}`;
}
