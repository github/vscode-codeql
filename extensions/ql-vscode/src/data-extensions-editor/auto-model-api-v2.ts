import { Credentials } from "../common/authentication";
import { OctokitResponse } from "@octokit/types";

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

export async function autoModelV2(
  credentials: Credentials,
  request: ModelRequest,
): Promise<ModelResponse> {
  const octokit = await credentials.getOctokit();

  const response: OctokitResponse<ModelResponse> = await octokit.request(
    "POST /repos/github/codeql/code-scanning/codeql/auto-model",
    {
      data: request,
    },
  );

  return response.data;
}
