import { RepositoryIdentifier } from './repo-models';

export type VariantAnalysisLanguage =
  | 'csharp'
  | 'cpp'
  | 'javascript'
  | 'go'
  | 'python'
  | 'ruby';

export interface VariantAnalysisSubmissionRequest {
  action_repo_ref: string,
  language: VariantAnalysisLanguage,
  query_pack: string,
  repositories?: string[],
  repository_lists?: string[],
  repository_owners?: string[]
}

export type VariantAnalysisStatus =
  | 'in_progress'
  | 'completed';

export type VariantAnalysisFailureReason =
  | 'no_repos_queried'
  | 'internal_error';

export type VariantAnalysisRepoStatus =
  | 'pending'
  | 'in_progress'
  | 'succeeded'
  | 'failed'
  | 'canceled'
  | 'timed_out';

export interface VariantAnalysisScannedRepository {
  repository: RepositoryIdentifier,
  analysis_status: VariantAnalysisRepoStatus,
  result_count?: number,
  artifact_size_in_bytes?: number,
  failure_message?: string
}

export interface VariantAnalysisSkippedRepositoryGroup {
  repository_count: number,
  repositories: Array<{
    id: number,
    full_name: string
  }>
}

export interface VariantAnalysisRepoTask {
  repository: RepositoryIdentifier,
  analysis_status: VariantAnalysisRepoStatus,
  artifact_size_in_bytes?: number,
  result_count?: number,
  failure_message?: string,
  database_commit_sha?: string,
  source_location_prefix?: string,
  artifact_url?: string
}

export interface VariantAnalysisSkippedRepositories {
  access_mismatch_repos: VariantAnalysisSkippedRepositoryGroup,
  not_found_repos: VariantAnalysisSkippedRepositoryGroup,
  no_codeql_db_repos: VariantAnalysisSkippedRepositoryGroup,
  over_limit_repos: VariantAnalysisSkippedRepositoryGroup
}

export interface VariantAnalysis {
  id: number,
  // TODO: Simple repo
  controller_repo: RepositoryIdentifier,
  actor_id: number,
  query_language: VariantAnalysisLanguage,
  query_pack_url: string,
  status: VariantAnalysisStatus,
  actions_workflow_run_id?: number,
  failure_reason?: VariantAnalysisFailureReason,
  scanned_repositories?: VariantAnalysisScannedRepository[],
  skipped_repositories?: VariantAnalysisSkippedRepositories
}
