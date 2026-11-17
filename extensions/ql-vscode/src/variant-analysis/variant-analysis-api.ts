import type { Credentials } from "../common/authentication";
import type { VariantAnalysisServerConfig } from "../config";
import { getVariantAnalysisServerConfig } from "../config";
import { cancelVariantAnalysis as cancelGitHubVariantAnalysis } from "./gh-api/gh-actions-api-client";
import {
  getVariantAnalysis as getGitHubVariantAnalysis,
  getVariantAnalysisRepo as getGitHubVariantAnalysisRepo,
  submitVariantAnalysis as submitGitHubVariantAnalysis,
} from "./gh-api/gh-api-client";
import type {
  VariantAnalysis as ApiVariantAnalysis,
  VariantAnalysisRepoTask as ApiVariantAnalysisRepoTask,
} from "./gh-api/variant-analysis";
import { withVariantAnalysisServerProvider } from "./gh-api/variant-analysis-server-client";
import type {
  VariantAnalysis,
  VariantAnalysisSubmission,
} from "./shared/variant-analysis";

export async function submitVariantAnalysis(
  credentials: Credentials,
  submission: VariantAnalysisSubmission,
): Promise<ApiVariantAnalysis> {
  return submitGitHubVariantAnalysis(credentials, submission);
}

export async function getVariantAnalysis(
  credentials: Credentials,
  controllerRepoId: number,
  variantAnalysisId: number,
): Promise<ApiVariantAnalysis> {
  return getGitHubVariantAnalysis(
    credentials,
    controllerRepoId,
    variantAnalysisId,
  );
}

export async function getVariantAnalysisRepo(
  credentials: Credentials,
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number,
): Promise<ApiVariantAnalysisRepoTask> {
  return getGitHubVariantAnalysisRepo(
    credentials,
    controllerRepoId,
    variantAnalysisId,
    repoId,
  );
}

export async function cancelVariantAnalysis(
  credentials: Credentials,
  variantAnalysis: VariantAnalysis,
): Promise<void> {
  return cancelGitHubVariantAnalysis(credentials, variantAnalysis);
}

/**
 * Returns the configured server for a run submitted to `serverUrl`, or
 * `undefined` for a GitHub run while no server is configured. Throws if the
 * run belongs to a different server than the configured one.
 */
function getServerForVariantAnalysis(
  serverUrl: string | undefined,
): VariantAnalysisServerConfig | undefined {
  const server = getVariantAnalysisServerConfig();
  if (server?.url !== serverUrl) {
    throw new Error(
      "This variant analysis belongs to a different server. Restore the server setting used to submit it before retrying.",
    );
  }
  return server;
}

export async function openServerVariantAnalysisLogs(
  run: VariantAnalysis,
): Promise<void> {
  const server = getServerForVariantAnalysis(run.serverUrl);
  const openLogs = server && (await getServerLogOpener(server, run.id));
  if (!openLogs) {
    throw new Error(
      "The configured variant analysis provider does not support viewing logs.",
    );
  }
  await openLogs();
}

async function getServerLogOpener(
  server: VariantAnalysisServerConfig,
  analysisId: number,
): Promise<(() => Promise<void>) | undefined> {
  return withVariantAnalysisServerProvider(server, async (provider) => {
    const openLogs = provider?.openVariantAnalysisLogs;
    return typeof openLogs === "function"
      ? () => openLogs.call(provider, server.url, analysisId)
      : undefined;
  });
}
