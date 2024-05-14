import type { VariantAnalysisConfig } from "../../src/config";

export function createMockVariantAnalysisConfig(): VariantAnalysisConfig {
  return {
    controllerRepo: "foo/bar",
    showSystemDefinedRepositoryLists: true,
    githubUrl: new URL("https://github.com"),
    onDidChangeConfiguration: jest.fn(),
  };
}
