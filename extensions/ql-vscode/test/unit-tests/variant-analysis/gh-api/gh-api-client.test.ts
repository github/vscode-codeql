import {
  getRepositoryFromNwo,
  getVariantAnalysis,
  getVariantAnalysisRepo,
  submitVariantAnalysis,
} from "../../../../src/variant-analysis/gh-api/gh-api-client";
import { createMockSubmission } from "../../../factories/variant-analysis/shared/variant-analysis-submission";
import { MockGitHubApiServer } from "../../../../src/common/mock-gh-api/mock-gh-api-server";

import { response } from "../../../../src/common/mock-gh-api/scenarios/mrva-problem-query-success/0-getRepo.json";
import { response as variantAnalysisJson_response } from "../../../../src/common/mock-gh-api/scenarios/mrva-problem-query-success/1-submitVariantAnalysis.json";
import { response as variantAnalysisRepoJson_response } from "../../../../src/common/mock-gh-api/scenarios/mrva-problem-query-success/9-getVariantAnalysisRepo.json";
import { testCredentialsWithRealOctokit } from "../../../factories/authentication";

const mockServer = new MockGitHubApiServer();
beforeAll(() => mockServer.startServer("error"));
afterEach(() => mockServer.unloadScenario());
afterAll(() => mockServer.stopServer());

const controllerRepoId = variantAnalysisJson_response.body.controller_repo.id;
const variantAnalysisId = variantAnalysisJson_response.body.id;
const repoTaskId = variantAnalysisRepoJson_response.body.repository.id;

describe("submitVariantAnalysis", () => {
  it("returns the submitted variant analysis", async () => {
    await mockServer.loadScenario("mrva-problem-query-success");

    const result = await submitVariantAnalysis(
      testCredentialsWithRealOctokit(),
      createMockSubmission(),
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(variantAnalysisId);
  });
});

describe("getVariantAnalysis", () => {
  it("returns the variant analysis", async () => {
    await mockServer.loadScenario("mrva-problem-query-success");

    const result = await getVariantAnalysis(
      testCredentialsWithRealOctokit(),
      controllerRepoId,
      variantAnalysisId,
    );

    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
  });
});

describe("getVariantAnalysisRepo", () => {
  it("returns the variant analysis repo task", async () => {
    await mockServer.loadScenario("mrva-problem-query-success");

    const result = await getVariantAnalysisRepo(
      testCredentialsWithRealOctokit(),
      controllerRepoId,
      variantAnalysisId,
      repoTaskId,
    );

    expect(result).toBeDefined();
    expect(result.repository.id).toBe(repoTaskId);
  });
});

describe("getRepositoryFromNwo", () => {
  it("returns the repository", async () => {
    await mockServer.loadScenario("mrva-problem-query-success");

    const result = await getRepositoryFromNwo(
      testCredentialsWithRealOctokit(),
      "github",
      "mrva-demo-controller-repo",
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(response.body.id);
  });
});
