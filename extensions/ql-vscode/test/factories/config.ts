import type { VariantAnalysisConfig } from "../../src/config";
import { GITHUB_URL } from "../../src/config";

export function createMockVariantAnalysisConfig(): VariantAnalysisConfig {
  return {
    controllerRepo: "foo/bar",
    showSystemDefinedRepositoryLists: true,
    githubUrl: GITHUB_URL,
    onDidChangeConfiguration: jest.fn(),
  };
}
