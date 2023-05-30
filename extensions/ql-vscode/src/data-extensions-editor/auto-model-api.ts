import { Credentials } from "../common/authentication";
import { OctokitResponse } from "@octokit/types";

export enum ClassificationType {
  Unknown = "CLASSIFICATION_TYPE_UNKNOWN",
  Neutral = "CLASSIFICATION_TYPE_NEUTRAL",
  Source = "CLASSIFICATION_TYPE_SOURCE",
  Sink = "CLASSIFICATION_TYPE_SINK",
  Summary = "CLASSIFICATION_TYPE_SUMMARY",
}

export interface Classification {
  type: ClassificationType;
  kind: string;
  explanation: string;
}

export interface Method {
  package: string;
  type: string;
  name: string;
  signature: string;
  usages: string[];
  classification?: Classification;
  input?: string;
  output?: string;
}

export interface ModelRequest {
  language: string;
  candidates: Method[];
  samples: Method[];
}

export interface ModelResponse {
  language: string;
  predicted: Method[];
}

export async function autoModel(
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
