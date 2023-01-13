import { Octokit as Octokit_Octokit } from "@octokit/rest";
import { retry } from "@octokit/plugin-retry";

import { faker } from "@faker-js/faker";

import {
  getRepositoryFromNwo,
  getVariantAnalysis,
  getVariantAnalysisRepo,
  getVariantAnalysisRepoResult,
  submitVariantAnalysis,
} from "../../../../src/remote-queries/gh-api/gh-api-client";
import { Credentials } from "../../../../src/authentication";
import { createMockSubmission } from "../../../factories/remote-queries/shared/variant-analysis-submission";
import { MockGitHubApiServer } from "../../../../src/mocks/mock-gh-api-server";

import { response } from "../../../../src/mocks/scenarios/problem-query-success/0-getRepo.json";
import { response as variantAnalysisJson_response } from "../../../../src/mocks/scenarios/problem-query-success/1-submitVariantAnalysis.json";
import { response as variantAnalysisRepoJson_response } from "../../../../src/mocks/scenarios/problem-query-success/9-getVariantAnalysisRepo.json";

const mockCredentials = {
  getOctokit: () => Promise.resolve(new Octokit_Octokit({ retry })),
} as unknown as Credentials;

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
      mockCredentials,
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
      mockCredentials,
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
      mockCredentials,
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
      mockCredentials,
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
      mockCredentials,
      "github",
      "mrva-demo-controller-repo",
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(response.body.id);
  });
});
