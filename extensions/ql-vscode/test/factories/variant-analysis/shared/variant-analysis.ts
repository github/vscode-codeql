import { faker } from "@faker-js/faker";
import {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisStatus,
} from "../../../../src/variant-analysis/shared/variant-analysis";
import { createMockScannedRepos } from "./scanned-repositories";
import { createMockSkippedRepos } from "./skipped-repositories";
import { createMockRepository } from "./repository";
import { QueryLanguage } from "../../../../src/common/query-languagee";

export function createMockVariantAnalysis({
  status = VariantAnalysisStatus.InProgress,
  scannedRepos = createMockScannedRepos(),
  skippedRepos = createMockSkippedRepos(),
  executionStartTime = faker.datatype.number(),
}: {
  status?: VariantAnalysisStatus;
  scannedRepos?: VariantAnalysisScannedRepository[];
  skippedRepos?: VariantAnalysisSkippedRepositories;
  executionStartTime?: number | undefined;
}): VariantAnalysis {
  return {
    id: faker.datatype.number(),
    controllerRepo: {
      ...createMockRepository(),
      fullName: `github/${faker.datatype.hexadecimal({
        prefix: "",
      })}`,
    },
    query: {
      name: "a-query-name",
      filePath: "a-query-file-path",
      language: QueryLanguage.Javascript,
      text: "a-query-text",
    },
    databases: {
      repositories: ["1", "2", "3"],
    },
    executionStartTime,
    createdAt: faker.date.recent().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    status,
    actionsWorkflowRunId: faker.datatype.number(),
    scannedRepos,
    skippedRepos,
  };
}
