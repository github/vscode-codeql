import { faker } from "@faker-js/faker";
import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisStatus,
} from "../../../../src/remote-queries/gh-api/variant-analysis";
import { VariantAnalysisQueryLanguage } from "../../../../src/remote-queries/shared/variant-analysis";
import { createMockScannedRepos } from "./scanned-repositories";
import { createMockSkippedRepos } from "./skipped-repositories";
import { createMockRepository } from "./repository";

export function createMockApiResponse(
  status: VariantAnalysisStatus = "in_progress",
  scannedRepos: VariantAnalysisScannedRepository[] = createMockScannedRepos(),
  skippedRepos: VariantAnalysisSkippedRepositories = createMockSkippedRepos(),
): VariantAnalysisApiResponse {
  const variantAnalysis: VariantAnalysisApiResponse = {
    id: faker.datatype.number(),
    controller_repo: {
      ...createMockRepository(),
      name: "pickles",
      full_name: "github/pickles",
      private: false,
    },
    query_language: VariantAnalysisQueryLanguage.Javascript,
    query_pack_url: "https://example.com/foo",
    created_at: faker.date.recent().toISOString(),
    updated_at: faker.date.recent().toISOString(),
    status,
    actions_workflow_run_id: faker.datatype.number(),
    scanned_repositories: scannedRepos,
    skipped_repositories: skippedRepos,
  };

  return variantAnalysis;
}

export function createFailedMockApiResponse(
  scannedRepos: VariantAnalysisScannedRepository[] = createMockScannedRepos(),
  skippedRepos: VariantAnalysisSkippedRepositories = createMockSkippedRepos(),
): VariantAnalysisApiResponse {
  const variantAnalysis = createMockApiResponse(
    "failed",
    scannedRepos,
    skippedRepos,
  );
  variantAnalysis.failure_reason = "internal_error";
  return variantAnalysis;
}
