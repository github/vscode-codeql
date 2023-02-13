import { join } from "path";
import { pathExists, writeFile } from "fs-extra";
import { Credentials } from "../../common/authentication";
import { extLogger } from "../../common";
import { createDownloadPath, DownloadLink } from "../download-link";
import { RemoteQuery } from "../remote-query";
import { unzipFile } from "../../pure/zip";
import { VariantAnalysis } from "../shared/variant-analysis";

export async function cancelRemoteQuery(
  credentials: Credentials,
  remoteQuery: RemoteQuery,
): Promise<void> {
  const octokit = await credentials.getOctokit();
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
  credentials: Credentials,
  variantAnalysis: VariantAnalysis,
): Promise<void> {
  const octokit = await credentials.getOctokit();
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
  credentials: Credentials,
  storagePath: string,
  downloadLink: DownloadLink,
): Promise<string> {
  const octokit = await credentials.getOctokit();

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
