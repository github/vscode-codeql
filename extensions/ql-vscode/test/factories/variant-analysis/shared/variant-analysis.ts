import { faker } from "@faker-js/faker";
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
} from "../../../../src/variant-analysis/shared/variant-analysis";
import { VariantAnalysisStatus } from "../../../../src/variant-analysis/shared/variant-analysis";
import { createMockScannedRepos } from "./scanned-repositories";
import { createMockSkippedRepos } from "./skipped-repositories";
import { createMockRepository } from "./repository";
import { QueryLanguage } from "../../../../src/common/query-language";
import type { ModelPackDetails } from "../../../../src/common/model-pack-details";

export function createMockVariantAnalysis({
  status = VariantAnalysisStatus.InProgress,
  scannedRepos = createMockScannedRepos(),
  skippedRepos = createMockSkippedRepos(),
  executionStartTime = faker.number.int(),
  language = QueryLanguage.Javascript,
  modelPacks = undefined,
}: {
  status?: VariantAnalysisStatus;
  scannedRepos?: VariantAnalysisScannedRepository[];
  skippedRepos?: VariantAnalysisSkippedRepositories;
  executionStartTime?: number | undefined;
  language?: QueryLanguage;
  modelPacks?: ModelPackDetails[] | undefined;
}): VariantAnalysis {
  return {
    id: faker.number.int(),
    controllerRepo: {
      ...createMockRepository(),
      fullName: `github/${faker.string.hexadecimal({
        prefix: "",
      })}`,
    },
    language,
    query: {
      name: "a-query-name",
      filePath: "a-query-file-path",
      text: "a-query-text",
    },
    modelPacks,
    databases: {
      repositories: ["1", "2", "3"],
    },
    executionStartTime,
    createdAt: faker.date.recent().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    status,
    actionsWorkflowRunId: faker.number.int(),
    scannedRepos,
    skippedRepos,
  };
}
