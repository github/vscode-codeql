import { expect } from 'chai';
import * as path from 'path';

import * as Octokit from '@octokit/rest';
import { retry } from '@octokit/plugin-retry';

import { setupServer } from 'msw/node';

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
import { createRequestHandlers } from '../../../../src/mocks/request-handlers';

const mockCredentials = {
  getOctokit: () => Promise.resolve(new Octokit.Octokit({ retry }))
} as unknown as Credentials;

const server = setupServer();

before(() => server.listen());

afterEach(() => server.resetHandlers());

after(() => server.close());

async function loadScenario(scenarioName: string) {
  const handlers = await createRequestHandlers(path.join(__dirname, '../../../../src/mocks/scenarios', scenarioName));

  server.use(...handlers);
}

describe('submitVariantAnalysis', () => {
  it('returns the submitted variant analysis', async () => {
    await loadScenario('problem-query-success');

    const result = await submitVariantAnalysis(mockCredentials, createMockSubmission());

    expect(result).not.to.be.undefined;
    expect(result.id).to.eq(146);
  });
});

describe('getVariantAnalysis', () => {
  it('returns the variant analysis', async () => {
    await loadScenario('problem-query-success');

    const result = await getVariantAnalysis(mockCredentials, 557804416, 146);

    expect(result).not.to.be.undefined;
    expect(result.status).not.to.be.undefined;
  });
});

describe('getVariantAnalysisRepo', () => {
  it('returns the variant analysis repo task', async () => {
    await loadScenario('problem-query-success');

    const result = await getVariantAnalysisRepo(mockCredentials, 557804416, 146, 206444);

    expect(result).not.to.be.undefined;
    expect(result.repository.id).to.eq(206444);
  });
});

describe('getVariantAnalysisRepoResult', () => {
  it('returns the variant analysis repo result', async () => {
    await loadScenario('problem-query-success');

    const result = await getVariantAnalysisRepoResult(mockCredentials, 'https://objects-origin.githubusercontent.com/codeql-query-console/codeql-variant-analysis-repo-tasks/146/206444/f6752c5c-ad60-46ba-b8dc-977546108458');

    expect(result).not.to.be.undefined;
    expect(result).to.be.an('ArrayBuffer');
    expect(result.byteLength).to.eq(81841);
  });
});

describe('getRepositoryFromNwo', () => {
  it('returns the repository', async () => {
    await loadScenario('problem-query-success');

    const result = await getRepositoryFromNwo(mockCredentials, 'github', 'mrva-demo-controller-repo');

    expect(result).not.to.be.undefined;
    expect(result.id).to.eq(557804416);
  });
});
