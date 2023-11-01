import { Credentials } from "../common/authentication";
import { OctokitResponse } from "@octokit/types";
import fetch from "node-fetch";
import { ModelConfigListener } from "../config";

export enum AutomodelMode {
  Unspecified = "AUTOMODEL_MODE_UNSPECIFIED",
  Framework = "AUTOMODEL_MODE_FRAMEWORK",
  Application = "AUTOMODEL_MODE_APPLICATION",
}

export interface ModelRequest {
  mode: AutomodelMode;
  // Base64-encoded GZIP-compressed SARIF log
  candidates: string;
}

export interface ModelResponse {
  models: string;
}

export async function autoModel(
  credentials: Credentials,
  request: ModelRequest,
  modelingConfig: ModelConfigListener,
): Promise<ModelResponse> {
  const devEndpoint = modelingConfig.llmGenerationDevEndpoint;
  if (devEndpoint) {
    return callAutoModelDevEndpoint(devEndpoint, request);
  } else {
    const octokit = await credentials.getOctokit();

    const response: OctokitResponse<ModelResponse> = await octokit.request(
      "POST /repos/github/codeql/code-scanning/codeql/auto-model",
      {
        data: request,
      },
    );

    return response.data;
  }
}

async function callAutoModelDevEndpoint(
  endpoint: string,
  request: ModelRequest,
): Promise<ModelResponse> {
  const json = JSON.stringify(request);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: json,
  });

  if (!response.ok) {
    throw new Error(
      `Error calling auto-model API: ${response.status} ${response.statusText}`,
    );
  }

  const data = await response.json();
  return data as ModelResponse;
}
