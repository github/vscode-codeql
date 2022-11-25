import * as Octokit from "@octokit/rest";
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
import { createMockSubmission } from "../../../../src/vscode-tests/factories/remote-queries/shared/variant-analysis-submission";
import { MockGitHubApiServer } from "../../../../src/mocks/mock-gh-api-server";

import * as getRepoJson from "../../../../src/mocks/scenarios/problem-query-success/0-getRepo.json";
import * as variantAnalysisJson from "../../../../src/mocks/scenarios/problem-query-success/1-submitVariantAnalysis.json";
import * as variantAnalysisRepoJson from "../../../../src/mocks/scenarios/problem-query-success/9-getVariantAnalysisRepo.json";

const mockCredentials = {
  getOctokit: () => Promise.resolve(new Octokit.Octokit({ retry })),
} as unknown as Credentials;

const mockServer = new MockGitHubApiServer();
beforeAll(() => mockServer.startServer());
afterEach(() => mockServer.unloadScenario());
afterAll(() => mockServer.stopServer());

const controllerRepoId = variantAnalysisJson.response.body.controller_repo.id;
const variantAnalysisId = variantAnalysisJson.response.body.id;
const repoTaskId = variantAnalysisRepoJson.response.body.repository.id;

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
      variantAnalysisRepoJson.response.body.artifact_size_in_bytes,
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
    expect(result.id).toBe(getRepoJson.response.body.id);
  });
});
