import * as unzipper from 'unzipper';
import * as path from 'path';
import * as fs from 'fs-extra';
import { showAndLogWarningMessage } from '../helpers';
import { Credentials } from '../authentication';
import { logger } from '../logging';
import { tmpDir } from '../run-queries';
import { RemoteQueryWorkflowResult } from './remote-query-workflow-result';

export interface ResultIndexItem {
  nwo: string;
  id: string;
  results_count: number;
  bqrs_file_size: number;
  sarif_file_size?: number;
}

/**
 * Gets the result index file for a given remote queries run.
 * @param credentials Credentials for authenticating to the GitHub API.
 * @param owner
 * @param repo
 * @param workflowRunId The ID of the workflow run to get the result index for.
 * @returns An object containing the result index.
 */
export async function getResultIndex(
  credentials: Credentials,
  owner: string,
  repo: string,
  workflowRunId: number
): Promise<ResultIndexItem[]> {
  const artifactList = await listWorkflowRunArtifacts(credentials, owner, repo, workflowRunId);
  const artifactId = getArtifactIDfromName('result-index', artifactList);
  if (!artifactId) {
    void showAndLogWarningMessage(
      `Could not find a result index for the [specified workflow](https://github.com/${owner}/${repo}/actions/runs/${workflowRunId}).
      Please check whether the workflow run has successfully completed.`
    );
    return [];
  }
  const artifactPath = await downloadArtifact(credentials, owner, repo, artifactId);
  const indexFilePath = path.join(artifactPath, 'index.json');
  if (!(await fs.pathExists(indexFilePath))) {
    void showAndLogWarningMessage('Could not find an `index.json` file in the result artifact.');
    return [];
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
  const response = await octokit.rest.actions.listWorkflowRunArtifacts({
    owner,
    repo,
    run_id: workflowRunId,
  });

  return response.data.artifacts;
}

/**
 * @param artifactName The artifact name, as a string.
 * @param artifacts An array of artifact details (from the "list workflow run artifacts" API response).
 * @returns The artifact ID corresponding to the given artifact name.
 */
function getArtifactIDfromName(artifactName: string, artifacts: Array<{ id: number, name: string }>): number | undefined {
  const artifact = artifacts.find(a => a.name === artifactName);
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
  void logger.log(`Downloading artifact to ${artifactPath}.zip`);
  await fs.writeFile(
    `${artifactPath}.zip`,
    Buffer.from(response.data as ArrayBuffer)
  );

  void logger.log(`Extracting artifact to ${artifactPath}`);
  await (
    await unzipper.Open.file(`${artifactPath}.zip`)
  ).extract({ path: artifactPath });
  return artifactPath;
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
