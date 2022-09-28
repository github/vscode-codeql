import { expect } from 'chai';
import {
  VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository,
} from '../../../remote-queries/gh-api/variant-analysis';
import {
  VariantAnalysisQueryLanguage,
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
  const mockApiResponse = createMockApiResponse('completed', scannedRepos, skippedRepos);
  const mockSubmission = createMockSubmission();

  it('should process an API response and return a variant analysis', () => {
    const result = processVariantAnalysis(mockSubmission, mockApiResponse);

    const { access_mismatch_repos, no_codeql_db_repos, not_found_repo_nwos, over_limit_repos } = skippedRepos;

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
      },
      'status': 'succeeded',
      'actionsWorkflowRunId': 456,
      'scannedRepos': [
        transformScannedRepo(VariantAnalysisRepoStatus.Succeeded, scannedRepos[0]),
        transformScannedRepo(VariantAnalysisRepoStatus.Pending, scannedRepos[1]),
        transformScannedRepo(VariantAnalysisRepoStatus.InProgress, scannedRepos[2]),
      ],
      'skippedRepos': {
        'accessMismatchRepos': {
          'repositories': [
            {
              'fullName': access_mismatch_repos.repositories[0].full_name,
              'id': access_mismatch_repos.repositories[0].id
            },
            {
              'fullName': access_mismatch_repos.repositories[1].full_name,
              'id': access_mismatch_repos.repositories[1].id
            }
          ],
          'repositoryCount': access_mismatch_repos.repository_count
        },
        'noCodeqlDbRepos': {
          'repositories': [
            {
              'fullName': no_codeql_db_repos.repositories[0].full_name,
              'id': no_codeql_db_repos.repositories[0].id
            },
            {
              'fullName': no_codeql_db_repos.repositories[1].full_name,
              'id': no_codeql_db_repos.repositories[1].id,
            }
          ],
          'repositoryCount': 2
        },
        'notFoundRepos': {
          'repositories': [
            {
              'fullName': not_found_repo_nwos.repository_full_names[0]
            },
            {
              'fullName': not_found_repo_nwos.repository_full_names[1]
            }
          ],
          'repositoryCount': not_found_repo_nwos.repository_count
        },
        'overLimitRepos': {
          'repositories': [
            {
              'fullName': over_limit_repos.repositories[0].full_name,
              'id': over_limit_repos.repositories[0].id
            },
            {
              'fullName': over_limit_repos.repositories[1].full_name,
              'id': over_limit_repos.repositories[1].id
            }
          ],
          'repositoryCount': over_limit_repos.repository_count
        }
      }
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
});
