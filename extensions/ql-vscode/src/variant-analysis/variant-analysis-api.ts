import type { Credentials } from "../common/authentication";
import { getErrorMessage } from "../common/helpers-pure";
import { extLogger } from "../common/logging/vscode";
import { getVariantAnalysisServerConfig } from "../config";
import { cancelVariantAnalysis as cancelGitHubVariantAnalysis } from "./gh-api/gh-actions-api-client";
import { createGist as createGitHubGist } from "./gh-api/gh-api-client";
import type {
  VariantAnalysis as ApiVariantAnalysis,
  VariantAnalysisRepoTask as ApiVariantAnalysisRepoTask,
} from "./gh-api/variant-analysis";
import {
  withVariantAnalysisServerProvider,
  requestVariantAnalysisServer,
} from "./gh-api/variant-analysis-server-client";
import { mapVariantAnalysisSubmission } from "./variant-analysis-mapper";
import type {
  VariantAnalysis,
  VariantAnalysisSubmission,
} from "./shared/variant-analysis";
import { Disposable, EventEmitter, workspace } from "vscode";

/**
 * Variant analysis API calls. These go to GitHub, unless an internal custom
 * variant analysis server is configured (see config.ts), in which case they
 * go to that server and the GitHub credentials are not used.
 */

function variantAnalysesPath(controllerRepoId: number): string {
  return `/repositories/${controllerRepoId}/code-scanning/codeql/variant-analyses`;
}

async function request<T>(
  credentials: Credentials,
  serverUrl: string | undefined,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<T> {
  const server = getServerForVariantAnalysis(serverUrl);
  if (server) {
    return requestVariantAnalysisServer<T>(server, method, path, body);
  }
  const octokit = await credentials.getOctokit();
  return (await octokit.request<T>({ method, url: path, data: body })).data;
}

export function getServerForVariantAnalysis(serverUrl: string | undefined) {
  const server = getVariantAnalysisServerConfig();
  if (server?.url !== serverUrl) {
    throw new Error(
      "This variant analysis belongs to a different server. Restore the server setting used to submit it before retrying.",
    );
  }
  return server;
}

const logCapabilities = new Map<string, { available: boolean }>();
const logCapabilitiesChanged = new EventEmitter<void>();
export const onDidChangeVariantAnalysisLogCapabilities =
  logCapabilitiesChanged.event;

export function watchVariantAnalysisLogCapabilities(): Disposable {
  logCapabilities.clear();
  return Disposable.from(
    workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("codeQL.variantAnalysis.serverUrl") ||
        event.affectsConfiguration("codeQL.variantAnalysis.serverTokenProvider")
      ) {
        logCapabilities.clear();
        logCapabilitiesChanged.fire();
      }
    }),
    new Disposable(() => logCapabilities.clear()),
  );
}

export function canViewVariantAnalysisLogs(run: VariantAnalysis): boolean {
  if (!run.serverUrl) {
    return run.actionsWorkflowRunId !== undefined;
  }
  const server = getVariantAnalysisServerConfig();
  if (server?.url !== run.serverUrl || !server.tokenProviderExtensionId) {
    return false;
  }
  const key = JSON.stringify([server.url, server.tokenProviderExtensionId]);
  const cached = logCapabilities.get(key);
  if (cached) {
    return cached.available;
  }
  const capability = { available: false };
  logCapabilities.set(key, capability);
  void getServerLogOpener(run)
    .then((openLogs) => {
      capability.available = openLogs !== undefined;
    })
    .catch((error: unknown) => {
      void extLogger.log(
        `Unable to discover variant analysis logs: ${getErrorMessage(error)}`,
      );
    })
    .then(() => {
      if (logCapabilities.get(key) === capability) {
        logCapabilitiesChanged.fire();
      }
    });
  return false;
}

async function getServerLogOpener(
  run: VariantAnalysis,
): Promise<(() => Promise<void>) | undefined> {
  const server = getVariantAnalysisServerConfig();
  if (
    !run.serverUrl ||
    server?.url !== run.serverUrl ||
    !server.tokenProviderExtensionId
  ) {
    return undefined;
  }
  return withVariantAnalysisServerProvider(server, async (provider) => {
    const openLogs = provider?.openVariantAnalysisLogs;
    return typeof openLogs === "function"
      ? () => openLogs.call(provider, server.url, run.id)
      : undefined;
  });
}

export function withVariantAnalysisLogCapability(
  run: VariantAnalysis,
): VariantAnalysis {
  return { ...run, canViewLogs: canViewVariantAnalysisLogs(run) };
}

export async function openServerVariantAnalysisLogs(
  run: VariantAnalysis,
): Promise<void> {
  getServerForVariantAnalysis(run.serverUrl);
  const openLogs = await getServerLogOpener(run);
  if (!openLogs) {
    throw new Error(
      "The configured variant analysis provider does not support viewing logs.",
    );
  }
  await openLogs();
}

export async function submitVariantAnalysis(
  credentials: Credentials,
  submission: VariantAnalysisSubmission,
): Promise<ApiVariantAnalysis> {
  return request<ApiVariantAnalysis>(
    credentials,
    submission.serverUrl,
    "POST",
    variantAnalysesPath(submission.controllerRepoId),
    mapVariantAnalysisSubmission(submission),
  );
}

export async function getVariantAnalysis(
  credentials: Credentials,
  controllerRepoId: number,
  variantAnalysisId: number,
  serverUrl?: string,
): Promise<ApiVariantAnalysis> {
  return request<ApiVariantAnalysis>(
    credentials,
    serverUrl,
    "GET",
    `${variantAnalysesPath(controllerRepoId)}/${variantAnalysisId}`,
  );
}

export async function getVariantAnalysisRepo(
  credentials: Credentials,
  controllerRepoId: number,
  variantAnalysisId: number,
  repoId: number,
  serverUrl?: string,
): Promise<ApiVariantAnalysisRepoTask> {
  return request<ApiVariantAnalysisRepoTask>(
    credentials,
    serverUrl,
    "GET",
    `${variantAnalysesPath(controllerRepoId)}/${variantAnalysisId}/repositories/${repoId}`,
  );
}

export async function cancelVariantAnalysis(
  credentials: Credentials,
  variantAnalysis: VariantAnalysis,
): Promise<void> {
  const server = getServerForVariantAnalysis(variantAnalysis.serverUrl);
  if (!server) {
    return cancelGitHubVariantAnalysis(credentials, variantAnalysis);
  }

  await requestVariantAnalysisServer(
    server,
    "POST",
    `${variantAnalysesPath(variantAnalysis.controllerRepo.id)}/${variantAnalysis.id}/cancel`,
    undefined,
    true,
  );
}

export async function createGist(
  credentials: Credentials,
  description: string,
  files: { [key: string]: { content: string } },
  serverUrl?: string,
): Promise<string | undefined> {
  // Results from a custom server must not be uploaded to GitHub.
  if (serverUrl) {
    throw new Error(
      "Exporting to a gist is not supported when using a custom variant analysis server.",
    );
  }
  return createGitHubGist(credentials, description, files);
}
