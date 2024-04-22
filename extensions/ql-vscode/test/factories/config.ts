import type { VariantAnalysisConfig } from "../../src/config";

export function createMockVariantAnalysisConfig(): VariantAnalysisConfig {
  return {
    controllerRepo: "foo/bar",
    showSystemDefinedRepositoryLists: true,
    onDidChangeConfiguration: jest.fn(),
  };
}
