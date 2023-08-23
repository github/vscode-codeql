import {
  VariantAnalysis as ApiVariantAnalysis,
  VariantAnalysisScannedRepository as ApiVariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories as ApiVariantAnalysisSkippedRepositories,
  VariantAnalysisRepoStatus as ApiVariantAnalysisRepoStatus,
  VariantAnalysisFailureReason as ApiVariantAnalysisFailureReason,
  VariantAnalysisStatus as ApiVariantAnalysisStatus,
  VariantAnalysisSkippedRepositoryGroup as ApiVariantAnalysisSkippedRepositoryGroup,
  VariantAnalysisNotFoundRepositoryGroup as ApiVariantAnalysisNotFoundRepositoryGroup,
  VariantAnalysisRepoTask as ApiVariantAnalysisRepoTask,
} from "./gh-api/variant-analysis";
import {
  VariantAnalysis,
  VariantAnalysisFailureReason,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisStatus,
  VariantAnalysisRepoStatus,
  VariantAnalysisSubmission,
  VariantAnalysisSkippedRepositoryGroup,
  VariantAnalysisRepositoryTask,
} from "./shared/variant-analysis";

export function processVariantAnalysis(
  submission: VariantAnalysisSubmission,
  response: ApiVariantAnalysis,
): VariantAnalysis {
  return processUpdatedVariantAnalysis(
    {
      query: {
        name: submission.query.name,
        filePath: submission.query.filePath,
        language: submission.query.language,
        text: submission.query.text,
        kind: submission.query.kind,
      },
      databases: submission.databases,
      executionStartTime: submission.startTime,
    },
    response,
  );
}

export function processUpdatedVariantAnalysis(
  previousVariantAnalysis: Pick<
    VariantAnalysis,
    "query" | "databases" | "executionStartTime"
  >,
  response: ApiVariantAnalysis,
): VariantAnalysis {
  let scannedRepos: VariantAnalysisScannedRepository[] = [];
  let skippedRepos: VariantAnalysisSkippedRepositories = {};

  if (response.scanned_repositories) {
    scannedRepos = processScannedRepositories(
      response.scanned_repositories as ApiVariantAnalysisScannedRepository[],
    );
  }

  if (response.skipped_repositories) {
    skippedRepos = processSkippedRepositories(
      response.skipped_repositories as ApiVariantAnalysisSkippedRepositories,
    );
  }

  const variantAnalysis: VariantAnalysis = {
    id: response.id,
    controllerRepo: {
      id: response.controller_repo.id,
      fullName: response.controller_repo.full_name,
      private: response.controller_repo.private,
    },
    query: previousVariantAnalysis.query,
    databases: previousVariantAnalysis.databases,
    executionStartTime: previousVariantAnalysis.executionStartTime,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    status: processApiStatus(response.status),
    completedAt: response.completed_at,
    actionsWorkflowRunId: response.actions_workflow_run_id,
    scannedRepos,
    skippedRepos,
  };

  if (response.failure_reason) {
    variantAnalysis.failureReason = processFailureReason(
      response.failure_reason,
    );
  }

  return variantAnalysis;
}

export function processVariantAnalysisRepositoryTask(
  response: ApiVariantAnalysisRepoTask,
): VariantAnalysisRepositoryTask {
  return {
    repository: {
      id: response.repository.id,
      fullName: response.repository.full_name,
      private: response.repository.private,
    },
    analysisStatus: processApiRepoStatus(response.analysis_status),
    resultCount: response.result_count,
    artifactSizeInBytes: response.artifact_size_in_bytes,
    failureMessage: response.failure_message,
    databaseCommitSha: response.database_commit_sha,
    sourceLocationPrefix: response.source_location_prefix,
    artifactUrl: response.artifact_url,
  };
}

export function processScannedRepository(
  scannedRepo: ApiVariantAnalysisScannedRepository,
): VariantAnalysisScannedRepository {
  return {
    repository: {
      id: scannedRepo.repository.id,
      fullName: scannedRepo.repository.full_name,
      private: scannedRepo.repository.private,
      stargazersCount: scannedRepo.repository.stargazers_count,
      updatedAt: scannedRepo.repository.updated_at,
    },
    analysisStatus: processApiRepoStatus(scannedRepo.analysis_status),
    resultCount: scannedRepo.result_count,
    artifactSizeInBytes: scannedRepo.artifact_size_in_bytes,
    failureMessage: scannedRepo.failure_message,
  };
}

function processScannedRepositories(
  scannedRepos: ApiVariantAnalysisScannedRepository[],
): VariantAnalysisScannedRepository[] {
  return scannedRepos.map((scannedRepo) =>
    processScannedRepository(scannedRepo),
  );
}

function processSkippedRepositories(
  skippedRepos: ApiVariantAnalysisSkippedRepositories,
): VariantAnalysisSkippedRepositories {
  return {
    accessMismatchRepos: processRepoGroup(skippedRepos.access_mismatch_repos),
    notFoundRepos: processNotFoundRepoGroup(skippedRepos.not_found_repos),
    noCodeqlDbRepos: processRepoGroup(skippedRepos.no_codeql_db_repos),
    overLimitRepos: processRepoGroup(skippedRepos.over_limit_repos),
  };
}

function processRepoGroup(
  repoGroup: ApiVariantAnalysisSkippedRepositoryGroup | undefined,
): VariantAnalysisSkippedRepositoryGroup | undefined {
  if (!repoGroup) {
    return undefined;
  }

  const repos = repoGroup.repositories.map((repo) => {
    return {
      id: repo.id,
      fullName: repo.full_name,
      private: repo.private,
      stargazersCount: repo.stargazers_count,
      updatedAt: repo.updated_at,
    };
  });

  return {
    repositoryCount: repoGroup.repository_count,
    repositories: repos,
  };
}

function processNotFoundRepoGroup(
  repoGroup: ApiVariantAnalysisNotFoundRepositoryGroup | undefined,
): VariantAnalysisSkippedRepositoryGroup | undefined {
  if (!repoGroup) {
    return undefined;
  }

  const repo_full_names = repoGroup.repository_full_names.map((nwo) => {
    return {
      fullName: nwo,
    };
  });

  return {
    repositoryCount: repoGroup.repository_count,
    repositories: repo_full_names,
  };
}

function processApiRepoStatus(
  analysisStatus: ApiVariantAnalysisRepoStatus,
): VariantAnalysisRepoStatus {
  switch (analysisStatus) {
    case "pending":
      return VariantAnalysisRepoStatus.Pending;
    case "in_progress":
      return VariantAnalysisRepoStatus.InProgress;
    case "succeeded":
      return VariantAnalysisRepoStatus.Succeeded;
    case "failed":
      return VariantAnalysisRepoStatus.Failed;
    case "canceled":
      return VariantAnalysisRepoStatus.Canceled;
    case "timed_out":
      return VariantAnalysisRepoStatus.TimedOut;
  }
}

function processApiStatus(
  status: ApiVariantAnalysisStatus,
): VariantAnalysisStatus {
  if (status === "succeeded") {
    return VariantAnalysisStatus.Succeeded;
  } else if (status === "in_progress") {
    return VariantAnalysisStatus.InProgress;
  } else if (status === "failed") {
    return VariantAnalysisStatus.Failed;
  } else if (status === "cancelled") {
    return VariantAnalysisStatus.Canceled;
  } else {
    return VariantAnalysisStatus.InProgress;
  }
}

export function processFailureReason(
  failureReason: ApiVariantAnalysisFailureReason,
): VariantAnalysisFailureReason {
  switch (failureReason) {
    case "no_repos_queried":
      return VariantAnalysisFailureReason.NoReposQueried;
    case "actions_workflow_run_failed":
      return VariantAnalysisFailureReason.ActionsWorkflowRunFailed;
    case "internal_error":
      return VariantAnalysisFailureReason.InternalError;
  }
}
