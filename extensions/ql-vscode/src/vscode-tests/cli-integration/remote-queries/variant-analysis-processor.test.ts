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
      'status': 'in_progress',
      'actionsWorkflowRunId': 456,
      'scannedRepos': [
        transformScannedRepo(VariantAnalysisRepoStatus.Succeeded, scannedRepos[0]),
        transformScannedRepo(VariantAnalysisRepoStatus.Pending, scannedRepos[1]),
        transformScannedRepo(VariantAnalysisRepoStatus.InProgress, scannedRepos[2]),
      ],
      'skippedRepos': skippedRepos
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
