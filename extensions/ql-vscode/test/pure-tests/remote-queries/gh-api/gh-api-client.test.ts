import { expect } from 'chai';

import * as Octokit from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';

import {
  getRepositoryFromNwo,
  getVariantAnalysis,
  getVariantAnalysisRepo, getVariantAnalysisRepoResult,
  submitVariantAnalysis
} from '../../../../src/remote-queries/gh-api/gh-api-client';
import { Credentials } from '../../../../src/authentication';
import {
  createMockSubmission
} from '../../../../src/vscode-tests/factories/remote-queries/shared/variant-analysis-submission';
import { MockGitHubApiServer } from '../../../../src/mocks/mock-gh-api-server';

const mockCredentials = {
  getOctokit: () => Promise.resolve(new Octokit.Octokit({ retry }))
} as unknown as Credentials;

const mockServer = new MockGitHubApiServer();
before(() => mockServer.startServer());
afterEach(() => mockServer.unloadScenario());
after(() => mockServer.stopServer());

describe('submitVariantAnalysis', () => {
  it('returns the submitted variant analysis', async () => {
    await mockServer.loadScenario('problem-query-success');

    const result = await submitVariantAnalysis(mockCredentials, createMockSubmission());

    expect(result).not.to.be.undefined;
    expect(result.id).to.eq(146);
  });
});

describe('getVariantAnalysis', () => {
  it('returns the variant analysis', async () => {
    await mockServer.loadScenario('problem-query-success');

    const result = await getVariantAnalysis(mockCredentials, 557804416, 146);

    expect(result).not.to.be.undefined;
    expect(result.status).not.to.be.undefined;
  });
});

describe('getVariantAnalysisRepo', () => {
  it('returns the variant analysis repo task', async () => {
    await mockServer.loadScenario('problem-query-success');

    const result = await getVariantAnalysisRepo(mockCredentials, 557804416, 146, 206444);

    expect(result).not.to.be.undefined;
    expect(result.repository.id).to.eq(206444);
  });
});

describe('getVariantAnalysisRepoResult', () => {
  it('returns the variant analysis repo result', async () => {
    await mockServer.loadScenario('problem-query-success');

    const result = await getVariantAnalysisRepoResult(mockCredentials, 'https://objects-origin.githubusercontent.com/codeql-query-console/codeql-variant-analysis-repo-tasks/146/206444/f6752c5c-ad60-46ba-b8dc-977546108458');

    expect(result).not.to.be.undefined;
    expect(result).to.be.an('ArrayBuffer');
    expect(result.byteLength).to.eq(81841);
  });
});

describe('getRepositoryFromNwo', () => {
  it('returns the repository', async () => {
    await mockServer.loadScenario('problem-query-success');

    const result = await getRepositoryFromNwo(mockCredentials, 'github', 'mrva-demo-controller-repo');

    expect(result).not.to.be.undefined;
    expect(result.id).to.eq(557804416);
  });
});
