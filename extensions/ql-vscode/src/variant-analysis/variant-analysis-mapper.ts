import type { ModelPackDetails } from "../common/model-pack-details";
import type {
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
import type {
  VariantAnalysis,
  VariantAnalysisScannedRepository,
  VariantAnalysisSkippedRepositories,
  VariantAnalysisSubmission,
  VariantAnalysisSkippedRepositoryGroup,
  VariantAnalysisRepositoryTask,
} from "./shared/variant-analysis";
import {
  VariantAnalysisFailureReason,
  VariantAnalysisStatus,
  VariantAnalysisRepoStatus,
} from "./shared/variant-analysis";

export function mapVariantAnalysisFromSubmission(
  submission: VariantAnalysisSubmission,
  apiVariantAnalysis: ApiVariantAnalysis,
  modelPacks: ModelPackDetails[],
): VariantAnalysis {
  return mapVariantAnalysis(
    {
      language: submission.language,
      query: {
        name: submission.query.name,
        filePath: submission.query.filePath,
        text: submission.query.text,
        kind: submission.query.kind,
      },
      queries: submission.queries,
      modelPacks,
      databases: submission.databases,
      executionStartTime: submission.startTime,
    },
    undefined,
    apiVariantAnalysis,
  );
}

export function mapUpdatedVariantAnalysis(
  currentVariantAnalysis: VariantAnalysis,
  apiVariantAnalysis: ApiVariantAnalysis,
): VariantAnalysis {
  return mapVariantAnalysis(
    currentVariantAnalysis,
    currentVariantAnalysis.status,
    apiVariantAnalysis,
  );
}

function mapVariantAnalysis(
  currentVariantAnalysis: Pick<
    VariantAnalysis,
    | "language"
    | "query"
    | "queries"
    | "databases"
    | "executionStartTime"
    | "modelPacks"
  >,
  currentStatus: VariantAnalysisStatus | undefined,
  response: ApiVariantAnalysis,
): VariantAnalysis {
  let scannedRepos: VariantAnalysisScannedRepository[] = [];
  let skippedRepos: VariantAnalysisSkippedRepositories = {};

  if (response.scanned_repositories) {
    scannedRepos = mapScannedRepositories(
      response.scanned_repositories as ApiVariantAnalysisScannedRepository[],
    );
  }

  if (response.skipped_repositories) {
    skippedRepos = mapSkippedRepositories(
      response.skipped_repositories as ApiVariantAnalysisSkippedRepositories,
    );
  }

  // Maintain the canceling status if we are still canceling.
  const status =
    currentStatus === VariantAnalysisStatus.Canceling &&
    response.status === "in_progress"
      ? VariantAnalysisStatus.Canceling
      : mapApiStatus(response.status);

  const variantAnalysis: VariantAnalysis = {
    id: response.id,
    controllerRepo: {
      id: response.controller_repo.id,
      fullName: response.controller_repo.full_name,
      private: response.controller_repo.private,
    },
    language: currentVariantAnalysis.language,
    query: currentVariantAnalysis.query,
    queries: currentVariantAnalysis.queries,
    modelPacks: currentVariantAnalysis.modelPacks,
    databases: currentVariantAnalysis.databases,
    executionStartTime: currentVariantAnalysis.executionStartTime,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    status,
    completedAt: response.completed_at,
    actionsWorkflowRunId: response.actions_workflow_run_id,
    scannedRepos,
    skippedRepos,
  };

  if (response.failure_reason) {
    variantAnalysis.failureReason = mapFailureReason(response.failure_reason);
  }

  return variantAnalysis;
}

export function mapVariantAnalysisRepositoryTask(
  response: ApiVariantAnalysisRepoTask,
): VariantAnalysisRepositoryTask {
  return {
    repository: {
      id: response.repository.id,
      fullName: response.repository.full_name,
      private: response.repository.private,
    },
    analysisStatus: mapApiRepoStatus(response.analysis_status),
    resultCount: response.result_count,
    artifactSizeInBytes: response.artifact_size_in_bytes,
    failureMessage: response.failure_message,
    databaseCommitSha: response.database_commit_sha,
    sourceLocationPrefix: response.source_location_prefix,
    artifactUrl: response.artifact_url,
  };
}

export function mapScannedRepository(
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
    analysisStatus: mapApiRepoStatus(scannedRepo.analysis_status),
    resultCount: scannedRepo.result_count,
    artifactSizeInBytes: scannedRepo.artifact_size_in_bytes,
    failureMessage: scannedRepo.failure_message,
  };
}

function mapScannedRepositories(
  scannedRepos: ApiVariantAnalysisScannedRepository[],
): VariantAnalysisScannedRepository[] {
  return scannedRepos.map((scannedRepo) => mapScannedRepository(scannedRepo));
}

function mapSkippedRepositories(
  skippedRepos: ApiVariantAnalysisSkippedRepositories,
): VariantAnalysisSkippedRepositories {
  return {
    accessMismatchRepos: mapRepoGroup(skippedRepos.access_mismatch_repos),
    notFoundRepos: mapNotFoundRepoGroup(skippedRepos.not_found_repos),
    noCodeqlDbRepos: mapRepoGroup(skippedRepos.no_codeql_db_repos),
    overLimitRepos: mapRepoGroup(skippedRepos.over_limit_repos),
  };
}

function mapRepoGroup(
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

function mapNotFoundRepoGroup(
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

function mapApiRepoStatus(
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

function mapApiStatus(status: ApiVariantAnalysisStatus): VariantAnalysisStatus {
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

export function mapFailureReason(
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
