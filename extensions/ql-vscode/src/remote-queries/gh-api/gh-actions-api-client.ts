import { join } from "path";
import { pathExists, readFile, writeFile } from "fs-extra";
import {
  showAndLogErrorMessage,
  showAndLogWarningMessage,
  tmpDir,
} from "../../helpers";
import { getOctokit } from "../../pure/authentication";
import { extLogger } from "../../common";
import { RemoteQueryWorkflowResult } from "../remote-query-workflow-result";
import { DownloadLink, createDownloadPath } from "../download-link";
import { RemoteQuery } from "../remote-query";
import {
  RemoteQueryFailureIndexItem,
  RemoteQueryResultIndex,
  RemoteQuerySuccessIndexItem,
} from "../remote-query-result-index";
import { getErrorMessage } from "../../pure/helpers-pure";
import { unzipFile } from "../../pure/zip";
import { VariantAnalysis } from "../shared/variant-analysis";

export const RESULT_INDEX_ARTIFACT_NAME = "result-index";

interface ApiSuccessIndexItem {
  nwo: string;
  id: string;
  sha?: string;
  results_count: number;
  bqrs_file_size: number;
  sarif_file_size?: number;
  source_location_prefix: string;
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
  remoteQuery: RemoteQuery,
): Promise<RemoteQueryResultIndex | undefined> {
  const controllerRepo = remoteQuery.controllerRepository;
  const owner = controllerRepo.owner;
  const repoName = controllerRepo.name;
  const workflowRunId = remoteQuery.actionsWorkflowRunId;

  const workflowUri = `https://github.com/${owner}/${repoName}/actions/runs/${workflowRunId}`;
  const artifactsUrlPath = `/repos/${owner}/${repoName}/actions/artifacts`;

  const artifactList = await listWorkflowRunArtifacts(
    owner,
    repoName,
    workflowRunId,
  );
  const resultIndexArtifactId = tryGetArtifactIDfromName(
    RESULT_INDEX_ARTIFACT_NAME,
    artifactList,
  );
  if (!resultIndexArtifactId) {
    return undefined;
  }
  const resultIndex = await getResultIndex(
    owner,
    repoName,
    resultIndexArtifactId,
  );

  const successes = resultIndex?.successes.map((item) => {
    const artifactId = getArtifactIDfromName(
      item.id,
      workflowUri,
      artifactList,
    );

    return {
      id: item.id.toString(),
      artifactId,
      nwo: item.nwo,
      sha: item.sha,
      resultCount: item.results_count,
      bqrsFileSize: item.bqrs_file_size,
      sarifFileSize: item.sarif_file_size,
      sourceLocationPrefix: item.source_location_prefix,
    } as RemoteQuerySuccessIndexItem;
  });

  const failures = resultIndex?.failures.map((item) => {
    return {
      id: item.id.toString(),
      nwo: item.nwo,
      error: item.error,
    } as RemoteQueryFailureIndexItem;
  });

  return {
    artifactsUrlPath,
    successes: successes || [],
    failures: failures || [],
  };
}

export async function cancelRemoteQuery(
  remoteQuery: RemoteQuery,
): Promise<void> {
  const octokit = await getOctokit();
  const {
    actionsWorkflowRunId,
    controllerRepository: { owner, name },
  } = remoteQuery;
  const response = await octokit.request(
    `POST /repos/${owner}/${name}/actions/runs/${actionsWorkflowRunId}/cancel`,
  );
  if (response.status >= 300) {
    throw new Error(
      `Error cancelling variant analysis: ${response.status} ${
        response?.data?.message || ""
      }`,
    );
  }
}

export async function cancelVariantAnalysis(
  variantAnalysis: VariantAnalysis,
): Promise<void> {
  const octokit = await getOctokit();
  const {
    actionsWorkflowRunId,
    controllerRepo: { fullName },
  } = variantAnalysis;
  const response = await octokit.request(
    `POST /repos/${fullName}/actions/runs/${actionsWorkflowRunId}/cancel`,
  );
  if (response.status >= 300) {
    throw new Error(
      `Error cancelling variant analysis: ${response.status} ${
        response?.data?.message || ""
      }`,
    );
  }
}

export async function downloadArtifactFromLink(
  storagePath: string,
  downloadLink: DownloadLink,
): Promise<string> {
  const octokit = await getOctokit();

  const extractedPath = createDownloadPath(storagePath, downloadLink);

  // first check if we already have the artifact
  if (!(await pathExists(extractedPath))) {
    // Download the zipped artifact.
    const response = await octokit.request(
      `GET ${downloadLink.urlPath}/zip`,
      {},
    );

    const zipFilePath = createDownloadPath(storagePath, downloadLink, "zip");

    await unzipBuffer(response.data as ArrayBuffer, zipFilePath, extractedPath);
  }
  return join(extractedPath, downloadLink.innerFilePath || "");
}

/**
 * Checks whether a specific artifact is present in the list of artifacts of a workflow run.
 * @param credentials Credentials for authenticating to the GitHub API.
 * @param owner
 * @param repo
 * @param workflowRunId The ID of the workflow run to get the artifact for.
 * @param artifactName The artifact name, as a string.
 * @returns A boolean indicating if the artifact is available.
 */
export async function isArtifactAvailable(
  owner: string,
  repo: string,
  workflowRunId: number,
  artifactName: string,
): Promise<boolean> {
  const artifactList = await listWorkflowRunArtifacts(
    owner,
    repo,
    workflowRunId,
  );

  return tryGetArtifactIDfromName(artifactName, artifactList) !== undefined;
}

/**
 * Downloads the result index artifact and extracts the result index items.
 * @param owner
 * @param repo
 * @param workflowRunId The ID of the workflow run to get the result index for.
 * @returns An object containing the result index.
 */
async function getResultIndex(
  owner: string,
  repo: string,
  artifactId: number,
): Promise<ApiResultIndex | undefined> {
  const artifactPath = await downloadArtifact(owner, repo, artifactId);
  const indexFilePath = join(artifactPath, "index.json");
  if (!(await pathExists(indexFilePath))) {
    void showAndLogWarningMessage(
      "Could not find an `index.json` file in the result artifact.",
    );
    return undefined;
  }
  const resultIndex = await readFile(join(artifactPath, "index.json"), "utf8");

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
  owner: string,
  repo: string,
  workflowRunId: number,
): Promise<RemoteQueryWorkflowResult> {
  const octokit = await getOctokit();

  const workflowRun = await octokit.rest.actions.getWorkflowRun({
    owner,
    repo,
    run_id: workflowRunId,
  });

  if (workflowRun.data.status === "completed") {
    if (workflowRun.data.conclusion === "success") {
      return { status: "CompletedSuccessfully" };
    } else {
      const error = getWorkflowError(workflowRun.data.conclusion);
      return { status: "CompletedUnsuccessfully", error };
    }
  }

  return { status: "InProgress" };
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
  owner: string,
  repo: string,
  workflowRunId: number,
) {
  const octokit = await getOctokit();

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
      page: pageNum,
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
  artifacts: Array<{ id: number; name: string }>,
): number {
  const artifactId = tryGetArtifactIDfromName(artifactName, artifacts);

  if (!artifactId) {
    const errorMessage = `Could not find artifact with name ${artifactName} in workflow ${workflowUri}.
      Please check whether the workflow run has successfully completed.`;
    throw Error(errorMessage);
  }

  return artifactId;
}

/**
 * @param artifactName The artifact name, as a string.
 * @param artifacts An array of artifact details (from the "list workflow run artifacts" API response).
 * @returns The artifact ID corresponding to the given artifact name, if it exists.
 */
function tryGetArtifactIDfromName(
  artifactName: string,
  artifacts: Array<{ id: number; name: string }>,
): number | undefined {
  const artifact = artifacts.find((a) => a.name === artifactName);

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
  owner: string,
  repo: string,
  artifactId: number,
): Promise<string> {
  const octokit = await getOctokit();
  const response = await octokit.rest.actions.downloadArtifact({
    owner,
    repo,
    artifact_id: artifactId,
    archive_format: "zip",
  });
  const artifactPath = join(tmpDir.name, `${artifactId}`);
  await unzipBuffer(
    response.data as ArrayBuffer,
    `${artifactPath}.zip`,
    artifactPath,
  );
  return artifactPath;
}

async function unzipBuffer(
  data: ArrayBuffer,
  filePath: string,
  destinationPath: string,
): Promise<void> {
  void extLogger.log(`Saving file to ${filePath}`);
  await writeFile(filePath, Buffer.from(data));

  void extLogger.log(`Unzipping file to ${destinationPath}`);
  await unzipFile(filePath, destinationPath);
}

function getWorkflowError(conclusion: string | null): string {
  if (!conclusion) {
    return "Workflow finished without a conclusion";
  }

  if (conclusion === "cancelled") {
    return "Variant analysis execution was cancelled.";
  }

  if (conclusion === "timed_out") {
    return "Variant analysis execution timed out.";
  }

  if (conclusion === "failure") {
    // TODO: Get the actual error from the workflow or potentially
    // from an artifact from the action itself.
    return "Variant analysis execution has failed.";
  }

  return `Unexpected variant analysis execution conclusion: ${conclusion}`;
}

const repositoriesMetadataQuery = `query Stars($repos: String!, $pageSize: Int!, $cursor: String) {
  search(
    query: $repos
    type: REPOSITORY
    first: $pageSize
    after: $cursor
  ) {
    edges {
      node {
        ... on Repository {
          name
          owner {
            login
          }
          stargazerCount
          updatedAt
        }
      }
      cursor
    }
  }
}`;

type RepositoriesMetadataQueryResponse = {
  search: {
    edges: Array<{
      cursor: string;
      node: {
        name: string;
        owner: {
          login: string;
        };
        stargazerCount: number;
        updatedAt: string; // Actually a ISO Date string
      };
    }>;
  };
};

export type RepositoriesMetadata = Record<
  string,
  { starCount: number; lastUpdated: number }
>;

export async function getRepositoriesMetadata(
  nwos: string[],
  pageSize = 100,
): Promise<RepositoriesMetadata> {
  const octokit = await getOctokit();
  const repos = `repo:${nwos.join(" repo:")} fork:true`;
  let cursor = null;
  const metadata: RepositoriesMetadata = {};
  try {
    do {
      const response: RepositoriesMetadataQueryResponse = await octokit.graphql(
        {
          query: repositoriesMetadataQuery,
          repos,
          pageSize,
          cursor,
        },
      );
      cursor =
        response.search.edges.length === pageSize
          ? response.search.edges[pageSize - 1].cursor
          : null;

      for (const edge of response.search.edges) {
        const node = edge.node;
        const owner = node.owner.login;
        const name = node.name;
        const starCount = node.stargazerCount;
        // lastUpdated is always negative since it happened in the past.
        const lastUpdated = new Date(node.updatedAt).getTime() - Date.now();
        metadata[`${owner}/${name}`] = {
          starCount,
          lastUpdated,
        };
      }
    } while (cursor);
  } catch (e) {
    void showAndLogErrorMessage(
      `Error retrieving repository metadata for variant analysis: ${getErrorMessage(
        e,
      )}`,
    );
  }

  return metadata;
}
