import {
  VariantAnalysis as ApiVariantAnalysis,
  VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository,
  VariantAnalysisRepoStatus as ApiVariantAnalysisRepoStatus
} from './gh-api/variant-analysis';
import {
  VariantAnalysis,
  VariantAnalysisFailureReason,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisStatus,
  VariantAnalysisRepoStatus,
  VariantAnalysisSubmission
} from './shared/variant-analysis';

export function processVariantAnalysis(
  submission: VariantAnalysisSubmission,
  response: ApiVariantAnalysis
): VariantAnalysis {

  const scannedRepos = processScannedRepositories(response.scanned_repositories as ApiVariantAnalysisScannedRepository[]);

  const variantAnalysis: VariantAnalysis = {
    id: response.id,
    controllerRepoId: response.controller_repo.id,
    query: {
      name: submission.query.name,
      filePath: submission.query.filePath,
      language: submission.query.language
    },
    databases: submission.databases,
    status: response.status as VariantAnalysisStatus,
    actionsWorkflowRunId: response.actions_workflow_run_id,
    scannedRepos: scannedRepos,
    skippedRepos: response.skipped_repositories as VariantAnalysisSkippedRepositories
  };

  if (response.failure_reason) {
    variantAnalysis.failureReason = response.failure_reason as VariantAnalysisFailureReason;
  }

  return variantAnalysis;
}

function processScannedRepositories(
  scannedRepos: ApiVariantAnalysisScannedRepository[]
): VariantAnalysisScannedRepository[] {

  const result: VariantAnalysisScannedRepository[] = [];

  scannedRepos.forEach(function(scannedRepo) {
    const parsedRepo: VariantAnalysisScannedRepository = {
      repository: {
        id: scannedRepo.repository.id,
        fullName: scannedRepo.repository.full_name,
        private: scannedRepo.repository.private,
      },
      analysisStatus: processApiAnalysisStatus(scannedRepo.analysis_status),
      resultCount: scannedRepo.result_count,
      artifactSizeInBytes: scannedRepo.artifact_size_in_bytes,
      failureMessage: scannedRepo.failure_message
    };

    result.push(parsedRepo);
  });

  return result;
}

function processApiAnalysisStatus(analysisStatus: ApiVariantAnalysisRepoStatus): VariantAnalysisRepoStatus {
  switch (analysisStatus) {
    case 'pending':
      return VariantAnalysisRepoStatus.Pending;
    case 'in_progress':
      return VariantAnalysisRepoStatus.InProgress;
    case 'succeeded':
      return VariantAnalysisRepoStatus.Succeeded;
    case 'failed':
      return VariantAnalysisRepoStatus.Failed;
    case 'canceled':
      return VariantAnalysisRepoStatus.Canceled;
    case 'timed_out':
      return VariantAnalysisRepoStatus.TimedOut;
  }
}
