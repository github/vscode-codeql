import { faker } from "@faker-js/faker";

import {
  getRepositoryFromNwo,
  getVariantAnalysis,
  getVariantAnalysisRepo,
  getVariantAnalysisRepoResult,
  submitVariantAnalysis,
} from "../../../../src/remote-queries/gh-api/gh-api-client";
import { createMockSubmission } from "../../../../src/vscode-tests/factories/remote-queries/shared/variant-analysis-submission";
import { MockGitHubApiServer } from "../../../../src/mocks/mock-gh-api-server";

import { response } from "../../../../src/mocks/scenarios/problem-query-success/0-getRepo.json";
import { response as variantAnalysisJson_response } from "../../../../src/mocks/scenarios/problem-query-success/1-submitVariantAnalysis.json";
import { response as variantAnalysisRepoJson_response } from "../../../../src/mocks/scenarios/problem-query-success/9-getVariantAnalysisRepo.json";
import { registerCredentials } from "../../../../src/pure/authentication";
import { TestCredentials } from "../../../../src/vscode-tests/factories/authentication";

let credentialsDisposer: () => void;
const mockServer = new MockGitHubApiServer();

beforeAll(() => {
  credentialsDisposer = registerCredentials(
    TestCredentials.initializeWithUnauthenticatedOctokit(),
  );
  mockServer.startServer();
});
afterEach(() => mockServer.unloadScenario());
afterAll(() => {
  mockServer.stopServer();
  credentialsDisposer();
});

const controllerRepoId = variantAnalysisJson_response.body.controller_repo.id;
const variantAnalysisId = variantAnalysisJson_response.body.id;
const repoTaskId = variantAnalysisRepoJson_response.body.repository.id;

describe("submitVariantAnalysis", () => {
  it("returns the submitted variant analysis", async () => {
    await mockServer.loadScenario("problem-query-success");

    const result = await submitVariantAnalysis(createMockSubmission());

    expect(result).toBeDefined();
    expect(result.id).toBe(variantAnalysisId);
  });
});

describe("getVariantAnalysis", () => {
  it("returns the variant analysis", async () => {
    await mockServer.loadScenario("problem-query-success");

    const result = await getVariantAnalysis(
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
      "github",
      "mrva-demo-controller-repo",
    );

    expect(result).toBeDefined();
    expect(result.id).toBe(response.body.id);
  });
});
