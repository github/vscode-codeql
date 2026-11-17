import { extensions } from "vscode";
import { RequestError } from "@octokit/request-error";
import type { VariantAnalysisServerConfig } from "../../config";

/**
 * INTERNAL AND UNSUPPORTED: client for a self-hosted variant analysis server
 * that implements the GitHub variant analysis REST endpoints. See
 * docs/variant-analysis-custom-server.md.
 *
 * The export that the configured token provider extension must implement.
 */
export interface VariantAnalysisServerTokenProvider {
  getVariantAnalysisServerToken(serverUrl: string): Promise<string | undefined>;
  openVariantAnalysisLogs?(
    serverUrl: string,
    analysisId: number,
  ): Promise<void>;
}

const MAX_ERROR_BODY_LENGTH = 500;
const TOKEN_PROVIDER_TIMEOUT_MS = 30_000;

/**
 * Activates the configured token provider extension and runs `action` with its
 * exports, failing if the provider does not respond within 30 seconds.
 */
export async function withVariantAnalysisServerProvider<T>(
  server: VariantAnalysisServerConfig,
  action: (provider: Partial<VariantAnalysisServerTokenProvider>) => Promise<T>,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      activateProvider(server).then(action),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
          reject(
            new Error(
              `The variant analysis token provider '${server.tokenProviderExtensionId}' did not respond within 30 seconds. Complete sign-in in the provider extension and retry.`,
            ),
          );
        }, TOKEN_PROVIDER_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function activateProvider(
  server: VariantAnalysisServerConfig,
): Promise<Partial<VariantAnalysisServerTokenProvider>> {
  const extensionId = server.tokenProviderExtensionId;
  if (!extensionId) {
    throw new Error(
      "No token provider is configured for the variant analysis server. Set codeQL.variantAnalysis.serverTokenProvider in your user settings.",
    );
  }

  const extension =
    extensions.getExtension<Partial<VariantAnalysisServerTokenProvider>>(
      extensionId,
    );
  if (!extension) {
    throw new Error(
      `The variant analysis server token provider extension '${extensionId}' is not installed.`,
    );
  }

  return extension.isActive ? extension.exports : await extension.activate();
}

async function getToken(server: VariantAnalysisServerConfig): Promise<string> {
  return withVariantAnalysisServerProvider(server, async (provider) => {
    if (typeof provider?.getVariantAnalysisServerToken !== "function") {
      throw new Error(
        `The extension '${server.tokenProviderExtensionId}' does not provide a variant analysis server token.`,
      );
    }

    const token = await provider.getVariantAnalysisServerToken(server.url);
    if (typeof token !== "string" || !token) {
      throw new Error(
        `The extension '${server.tokenProviderExtensionId}' did not return a variant analysis server token. Check that you are signed in.`,
      );
    }
    return token;
  });
}

/**
 * Sends a request to the variant analysis server. Neither the request body
 * nor the token is logged or included in errors. Errors are `RequestError`s,
 * so callers can handle HTTP statuses the same way as for GitHub.
 */
export async function requestVariantAnalysisServer<T>(
  server: VariantAnalysisServerConfig,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  allowEmptyResponse = false,
): Promise<T> {
  const token = await getToken(server);
  const url = `${server.url}${path}`;

  const response = await fetch(url, {
    redirect: "error",
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (cause) {
      if (response.ok) {
        throw new Error("Variant analysis server returned invalid JSON.", {
          cause,
        });
      }
      data = text;
    }
  }

  if (!response.ok) {
    const authenticationMessage =
      response.status === 401 || response.status === 403
        ? ` Re-authenticate using the token provider '${server.tokenProviderExtensionId}' and retry.`
        : "";
    throw new RequestError(
      `Variant analysis server request failed: ${method} ${path}: ${response.status} ${response.statusText}${describeErrorBody(data)}${authenticationMessage}`,
      response.status,
      { request: { method, url, headers: {} } },
    );
  }

  if (!text && !allowEmptyResponse) {
    throw new Error("Variant analysis server returned an empty response.");
  }

  return data as T;
}

function describeErrorBody(data: unknown): string {
  const message =
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof data.message === "string"
      ? data.message
      : typeof data === "string"
        ? data
        : undefined;
  return message ? `: ${message.slice(0, MAX_ERROR_BODY_LENGTH)}` : "";
}
