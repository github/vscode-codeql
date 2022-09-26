import { expect } from 'chai';
import {
  VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories as ApiVariantAnalysisSkippedRepositories,
  VariantAnalysisSkippedRepositoryGroup as ApiVariantAnalysisSkippedRepositoryGroup,
  VariantAnalysisNotFoundRepositoryGroup as ApiVariantAnalysisNotFoundRepositoryGroup
} from '../../../remote-queries/gh-api/variant-analysis';
import {
  VariantAnalysisQueryLanguage,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisSkippedRepositoryGroup,
  VariantAnalysisScannedRepository,
  VariantAnalysisRepoStatus
} from '../../../remote-queries/shared/variant-analysis';
import { processVariantAnalysis } from '../../../remote-queries/variant-analysis-processor';
import { createMockScannedRepos } from '../../factories/remote-queries/gh-api/scanned-repositories';
import { createMockSkippedRepos } from '../../factories/remote-queries/gh-api/skipped-repositories';
import { createMockApiResponse } from '../../factories/remote-queries/gh-api/variant-analysis-api-response';
import { createMockSubmission } from '../../factories/remote-queries/shared/variant-analysis-submission';

describe('Variant Analysis processor', function() {
  const scannedRepos = createMockScannedRepos();
  const skippedRepos = createMockSkippedRepos();
  const mockApiResponse = createMockApiResponse(scannedRepos, skippedRepos);
  const mockSubmission = createMockSubmission();

  it('should process an API response and return a variant analysis', () => {
    const result = processVariantAnalysis(mockSubmission, mockApiResponse);

    expect(result).to.eql({
      'id': 123,
      'controllerRepoId': 456,
      'query': {
        'filePath': 'query-file-path',
        'language': VariantAnalysisQueryLanguage.Javascript,
        'name': 'query-name',
      },
      'databases': {
        'repositories': ['1', '2', '3'],
        'repositoryLists': ['top10', 'top100'],
        'repositoryOwners': ['mona', 'lisa']
      },
      'status': 'succeeded',
      'actionsWorkflowRunId': 456,
      'scannedRepos': [
        transformScannedRepo(VariantAnalysisRepoStatus.Succeeded, scannedRepos[0]),
        transformScannedRepo(VariantAnalysisRepoStatus.Pending, scannedRepos[1]),
        transformScannedRepo(VariantAnalysisRepoStatus.InProgress, scannedRepos[2]),
      ],
      'skippedRepos': transformSkippedRepos(skippedRepos)
    });
  });

  function transformScannedRepo(
    status: VariantAnalysisRepoStatus,
    scannedRepo: ApiVariantAnalysisScannedRepository
  ): VariantAnalysisScannedRepository {
    return {
      'analysisStatus': status,
      'artifactSizeInBytes': scannedRepo.artifact_size_in_bytes,
      'failureMessage': scannedRepo.failure_message,
      'repository': {
        'fullName': scannedRepo.repository.full_name,
        'id': scannedRepo.repository.id,
        'private': scannedRepo.repository.private,
      },
      'resultCount': scannedRepo.result_count
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
