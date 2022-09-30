import {
  VariantAnalysis as ApiVariantAnalysis,
  VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories as ApiVariantAnalysisSkippedRepositories,
  VariantAnalysisRepoStatus as ApiVariantAnalysisRepoStatus,
  VariantAnalysisFailureReason as ApiVariantAnalysisFailureReason,
  VariantAnalysisStatus as ApiVariantAnalysisStatus,
  VariantAnalysisSkippedRepositoryGroup as ApiVariantAnalysisSkippedRepositoryGroup,
  VariantAnalysisNotFoundRepositoryGroup as ApiVariantAnalysisNotFoundRepositoryGroup
} from './gh-api/variant-analysis';
import {
  VariantAnalysis,
  VariantAnalysisFailureReason,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisStatus,
  VariantAnalysisRepoStatus,
  VariantAnalysisSubmission,
  VariantAnalysisSkippedRepositoryGroup
} from './shared/variant-analysis';

export function processVariantAnalysis(
  submission: VariantAnalysisSubmission,
  response: ApiVariantAnalysis
): VariantAnalysis {

  let scannedRepos: VariantAnalysisScannedRepository[] = [];
  let skippedRepos: VariantAnalysisSkippedRepositories = {};

  if (response.scanned_repositories) {
    scannedRepos = processScannedRepositories(response.scanned_repositories as ApiVariantAnalysisScannedRepository[]);
  }

  if (response.skipped_repositories) {
    skippedRepos = processSkippedRepositories(response.skipped_repositories as ApiVariantAnalysisSkippedRepositories);
  }

  const variantAnalysis: VariantAnalysis = {
    id: response.id,
    controllerRepoId: response.controller_repo.id,
    query: {
      name: submission.query.name,
      filePath: submission.query.filePath,
      language: submission.query.language
    },
    databases: submission.databases,
    status: processApiStatus(response.status),
    actionsWorkflowRunId: response.actions_workflow_run_id,
    scannedRepos: scannedRepos,
    skippedRepos: skippedRepos
  };

  if (response.failure_reason) {
    variantAnalysis.failureReason = processFailureReason(response.failure_reason);
  }

  return variantAnalysis;
}

function processScannedRepositories(
  scannedRepos: ApiVariantAnalysisScannedRepository[]
): VariantAnalysisScannedRepository[] {
  return scannedRepos.map(scannedRepo => {
    return {
      repository: {
        id: scannedRepo.repository.id,
        fullName: scannedRepo.repository.full_name,
        private: scannedRepo.repository.private,
      },
      analysisStatus: processApiRepoStatus(scannedRepo.analysis_status),
      resultCount: scannedRepo.result_count,
      artifactSizeInBytes: scannedRepo.artifact_size_in_bytes,
      failureMessage: scannedRepo.failure_message
    };
  });
}

function processSkippedRepositories(
  skippedRepos: ApiVariantAnalysisSkippedRepositories
): VariantAnalysisSkippedRepositories {

  return {
    accessMismatchRepos: processRepoGroup(skippedRepos.access_mismatch_repos),
    notFoundRepos: processNotFoundRepoGroup(skippedRepos.not_found_repo_nwos),
    noCodeqlDbRepos: processRepoGroup(skippedRepos.no_codeql_db_repos),
    overLimitRepos: processRepoGroup(skippedRepos.over_limit_repos)
  };
}

function processRepoGroup(repoGroup: ApiVariantAnalysisSkippedRepositoryGroup): VariantAnalysisSkippedRepositoryGroup {
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

function processNotFoundRepoGroup(repoGroup: ApiVariantAnalysisNotFoundRepositoryGroup): VariantAnalysisSkippedRepositoryGroup {
  const repo_full_names = repoGroup.repository_full_names.map(nwo => {
    return {
      fullName: nwo
    };
  });

  return {
    repositoryCount: repoGroup.repository_count,
    repositories: repo_full_names
  };
}

function processApiRepoStatus(analysisStatus: ApiVariantAnalysisRepoStatus): VariantAnalysisRepoStatus {
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

function processApiStatus(status: ApiVariantAnalysisStatus): VariantAnalysisStatus {
  switch (status) {
    case 'in_progress':
      return VariantAnalysisStatus.InProgress;
    case 'completed':
      return VariantAnalysisStatus.Succeeded;
  }
}

export function processFailureReason(failureReason: ApiVariantAnalysisFailureReason): VariantAnalysisFailureReason {
  switch (failureReason) {
    case 'no_repos_queried':
      return VariantAnalysisFailureReason.NoReposQueried;
    case 'internal_error':
      return VariantAnalysisFailureReason.InternalError;
  }
}
