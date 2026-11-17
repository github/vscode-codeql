import type { Credentials } from "../common/authentication";
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
