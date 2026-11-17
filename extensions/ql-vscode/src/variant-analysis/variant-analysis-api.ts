import { Disposable, EventEmitter, workspace } from "vscode";
import type { Credentials } from "../common/authentication";
import { getErrorMessage } from "../common/helpers-pure";
import { extLogger } from "../common/logging/vscode";
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

/**
 * Whether the companion extension can open logs for a server run. Discovery
 * runs in the background: this returns `false` until it finishes, then
 * `onDidChangeVariantAnalysisLogCapabilities` fires.
 */
export function canViewServerVariantAnalysisLogs(
  run: VariantAnalysis,
): boolean {
  let server: VariantAnalysisServerConfig | undefined;
  try {
    server = getVariantAnalysisServerConfig();
  } catch {
    return false;
  }
  if (
    !run.serverUrl ||
    server?.url !== run.serverUrl ||
    !server.tokenProviderExtensionId
  ) {
    return false;
  }
  const key = JSON.stringify([server.url, server.tokenProviderExtensionId]);
  const cached = logCapabilities.get(key);
  if (cached) {
    return cached.available;
  }
  const capability = { available: false };
  logCapabilities.set(key, capability);
  void getServerLogOpener(server, run.id)
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

/** Adds the log capability to a server run before it is sent to a webview. */
export function withVariantAnalysisLogCapability(
  run: VariantAnalysis,
): VariantAnalysis {
  return run.serverUrl
    ? { ...run, canViewLogs: canViewServerVariantAnalysisLogs(run) }
    : run;
}
