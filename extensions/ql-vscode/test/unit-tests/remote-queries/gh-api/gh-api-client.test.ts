import { faker } from "@faker-js/faker";

import {
  getRepositoryFromNwo,
  getVariantAnalysis,
  getVariantAnalysisRepo,
  getVariantAnalysisRepoResult,
  submitVariantAnalysis,
} from "../../../../src/remote-queries/gh-api/gh-api-client";
import { createMockSubmission } from "../../../factories/remote-queries/shared/variant-analysis-submission";
import { MockGitHubApiServer } from "../../../../src/mocks/mock-gh-api-server";

import { response } from "../../../../src/mocks/scenarios/problem-query-success/0-getRepo.json";
import { response as variantAnalysisJson_response } from "../../../../src/mocks/scenarios/problem-query-success/1-submitVariantAnalysis.json";
import { response as variantAnalysisRepoJson_response } from "../../../../src/mocks/scenarios/problem-query-success/9-getVariantAnalysisRepo.json";
import { testCredentialsWithRealOctokit } from "../../../factories/authentication";

const mockServer = new MockGitHubApiServer();
beforeAll(() => mockServer.startServer());
afterEach(() => mockServer.unloadScenario());
afterAll(() => mockServer.stopServer());

const controllerRepoId = variantAnalysisJson_response.body.controller_repo.id;
const variantAnalysisId = variantAnalysisJson_response.body.id;
const repoTaskId = variantAnalysisRepoJson_response.body.repository.id;

describe("submitVariantAnalysis", () => {
  it("returns the submitted variant analysis", async () => {
    await mockServer.loadScenario("problem-query-success");

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
    await mockServer.loadScenario("problem-query-success");

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
    await mockServer.loadScenario("problem-query-success");

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

describe("getVariantAnalysisRepoResult", () => {
  it("returns the variant analysis repo result", async () => {
    await mockServer.loadScenario("problem-query-success");

    const result = await getVariantAnalysisRepoResult(
      testCredentialsWithRealOctokit(),
      `https://objects-origin.githubusercontent.com/codeql-query-console/codeql-variant-analysis-repo-tasks/${variantAnalysisId}/${repoTaskId}/${faker.datatype.uuid()}`,
    );

    expect(result).toBeDefined();
    expect(result).toBeInstanceOf(ArrayBuffer);
    expect(result.byteLength).toBe(
      variantAnalysisRepoJson_response.body.artifact_size_in_bytes,
    );
  });
});

describe("getRepositoryFromNwo", () => {
  it("returns the repository", async () => {
    await mockServer.loadScenario("problem-query-success");

    const result = await getRepositoryFromNwo(
      testCredentialsWithRealOctokit(),
      "github",
      "mrva-demo-controller-repo",
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(response.body.id);
  });
});
