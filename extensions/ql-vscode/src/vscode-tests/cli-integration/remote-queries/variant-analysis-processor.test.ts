import { faker } from '@faker-js/faker';
import { expect } from 'chai';
import {
  VariantAnalysis as VariantAnalysisApiResponse,
  VariantAnalysisRepoStatus as ApiVariantAnalysisRepoStatus,
  VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories as ApiVariantAnalysisSkippedRepositories,
  VariantAnalysisSkippedRepositoryGroup as ApiVariantAnalysisSkippedRepositoryGroup,
  VariantAnalysisNotFoundRepositoryGroup as ApiVariantAnalysisNotFoundRepositoryGroup
} from '../../../remote-queries/gh-api/variant-analysis';
import {
  VariantAnalysisSubmission,
  VariantAnalysisQueryLanguage,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisSkippedRepositoryGroup
} from '../../../remote-queries/shared/variant-analysis';
import { processVariantAnalysis } from '../../../remote-queries/variant-analysis-processor';

describe('Variant Analysis processor', function() {
  let mockApiResponse: VariantAnalysisApiResponse;
  let mockSubmission: VariantAnalysisSubmission;
  let scannedRepo1: ApiVariantAnalysisScannedRepository;
  let scannedRepo2: ApiVariantAnalysisScannedRepository;
  let scannedRepo3: ApiVariantAnalysisScannedRepository;
  let skippedRepos: ApiVariantAnalysisSkippedRepositories;

  beforeEach(() => {
    scannedRepo1 = createMockScannedRepo('mona1', false, 'succeeded');
    scannedRepo2 = createMockScannedRepo('mona2', false, 'pending');
    scannedRepo3 = createMockScannedRepo('mona3', false, 'in_progress');
    skippedRepos = createMockSkippedRepos();

    mockApiResponse = createMockApiResponse();
    mockSubmission = createMockSubmission();
  });

  it('should process an API response and return a variant analysis', () => {
    const result = processVariantAnalysis(mockSubmission, mockApiResponse);

    expect(result).to.eql({
      'id': 123,
      'controllerRepoId': 456,
      'query': {
        'filePath': 'query-file-path',
        'language': 'javascript',
        'name': 'query-name',
      },
      'databases': {
        'repositories': ['1', '2', '3'],
        'repositoryLists': ['top10', 'top100'],
        'repositoryOwners': ['mona', 'lisa']
      },
      'status': 'succeeded',
      'actionsWorkflowRunId': 456,
      'failureReason': 'internal_error',
      'scannedRepos': [
        {
          'analysisStatus': 'succeeded',
          'artifactSizeInBytes': scannedRepo1.artifact_size_in_bytes,
          'failureMessage': '',
          'repository': {
            'fullName': scannedRepo1.repository.full_name,
            'id': scannedRepo1.repository.id,
            'private': scannedRepo1.repository.private,
          },
          'resultCount': scannedRepo1.result_count
        },
        {
          'analysisStatus': 'pending',
          'artifactSizeInBytes': scannedRepo2.artifact_size_in_bytes,
          'failureMessage': '',
          'repository': {
            'fullName': scannedRepo2.repository.full_name,
            'id': scannedRepo2.repository.id,
            'private': scannedRepo2.repository.private,
          },
          'resultCount': scannedRepo2.result_count
        },
        {
          'analysisStatus': 'inProgress',
          'artifactSizeInBytes': scannedRepo3.artifact_size_in_bytes,
          'failureMessage': '',
          'repository': {
            'fullName': scannedRepo3.repository.full_name,
            'id': scannedRepo3.repository.id,
            'private': scannedRepo3.repository.private,
          },
          'resultCount': scannedRepo3.result_count
        }
      ],
      'skippedRepos': transformSkippedRepos(skippedRepos)
    });
  });

  function createMockApiResponse(): VariantAnalysisApiResponse {
    const variantAnalysis: VariantAnalysisApiResponse = {
      id: 123,
      controller_repo: {
        id: 456,
        name: 'pickles',
        full_name: 'github/pickles',
        private: false,
      },
      actor_id: 123,
      query_language: 'javascript',
      query_pack_url: 'https://example.com/foo',
      status: 'in_progress',
      actions_workflow_run_id: 456,
      failure_reason: 'internal_error',
      scanned_repositories: [scannedRepo1, scannedRepo2, scannedRepo3],
      skipped_repositories: skippedRepos
    };

    return variantAnalysis;
  }

  function createMockScannedRepo(
    name: string,
    isPrivate: boolean,
    analysisStatus: ApiVariantAnalysisRepoStatus,
  ): ApiVariantAnalysisScannedRepository {
    return {
      repository: {
        id: faker.datatype.number(),
        name: name,
        full_name: 'github/' + name,
        private: isPrivate,
      },
      analysis_status: analysisStatus,
      result_count: faker.datatype.number(),
      artifact_size_in_bytes: faker.datatype.number(),
      failure_message: ''
    };
  }

  function createMockSubmission(): VariantAnalysisSubmission {
    return {
      startTime: 1234,
      controllerRepoId: 5678,
      actionRepoRef: 'repo-ref',
      query: {
        name: 'query-name',
        filePath: 'query-file-path',
        language: VariantAnalysisQueryLanguage.Javascript,
        pack: 'base64-encoded-string',
      },
      databases: {
        repositories: ['1', '2', '3'],
        repositoryLists: ['top10', 'top100'],
        repositoryOwners: ['mona', 'lisa'],
      }
    };
  }

  function createMockSkippedRepos(): ApiVariantAnalysisSkippedRepositories {
    return {
      access_mismatch_repos: createMockSkippedRepoGroup(),
      no_codeql_db_repos: createMockSkippedRepoGroup(),
      not_found_repo_nwos: createMockNotFoundSkippedRepoGroup(),
      over_limit_repos: createMockSkippedRepoGroup()
    };
  }

  function createMockSkippedRepoGroup(): ApiVariantAnalysisSkippedRepositoryGroup {
    return {
      repository_count: 2,
      repositories: [
        {
          id: faker.datatype.number(),
          name: faker.random.word(),
          full_name: 'github/' + faker.random.word(),
          private: true
        },
        {
          id: faker.datatype.number(),
          name: faker.random.word(),
          full_name: 'github/' + faker.random.word(),
          private: false
        }
      ]
    };
  }

  function createMockNotFoundSkippedRepoGroup(): ApiVariantAnalysisNotFoundRepositoryGroup {
    const repoName1 = 'github' + faker.random.word();
    const repoName2 = 'github' + faker.random.word();

    return {
      repository_count: 2,
      repository_nwos: [repoName1, repoName2]
    };
  }

  function transformSkippedRepos(
    skippedRepos: ApiVariantAnalysisSkippedRepositories
  ): VariantAnalysisSkippedRepositories {
    return {
      accessMismatchRepos: transformSkippedRepoGroup(skippedRepos.access_mismatch_repos),
      noCodeqlDbRepos: transformSkippedRepoGroup(skippedRepos.no_codeql_db_repos),
      notFoundRepos: transformNotFoundRepoGroup(skippedRepos.not_found_repo_nwos),
      overLimitRepos: transformSkippedRepoGroup(skippedRepos.over_limit_repos)
    };
  }
});

function transformSkippedRepoGroup(repoGroup: ApiVariantAnalysisSkippedRepositoryGroup): VariantAnalysisSkippedRepositoryGroup {
  const repos = repoGroup.repositories.map(repo => {
    return {
      id: repo.id,
      fullName: repo.full_name
    };
  });

  return {
    repositoryCount: repoGroup.repository_count,
    repositories: repos
  };
}

function transformNotFoundRepoGroup(repoGroup: ApiVariantAnalysisNotFoundRepositoryGroup): VariantAnalysisSkippedRepositoryGroup {
  const repos = repoGroup.repository_nwos.map(nwo => {
    return {
      fullName: nwo
    };
  });

  return {
    repositoryCount: repoGroup.repository_count,
    repositories: repos
  };
}
