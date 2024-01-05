import type { QueryLanguage } from "../../common/query-language";
import type { Repository, RepositoryWithMetadata } from "./repository";

export interface VariantAnalysisSubmissionRequest {
  action_repo_ref: string;
  language: QueryLanguage;
  query_pack: string;
  repositories?: string[];
  repository_lists?: string[];
  repository_owners?: string[];
}

export interface VariantAnalysis {
  id: number;
  controller_repo: Repository;
  query_language: QueryLanguage;
  query_pack_url: string;
  created_at: string;
  updated_at: string;
  status: VariantAnalysisStatus;
  completed_at?: string;
  actions_workflow_run_id?: number;
  failure_reason?: VariantAnalysisFailureReason;
  scanned_repositories?: VariantAnalysisScannedRepository[];
  skipped_repositories?: VariantAnalysisSkippedRepositories;
}

export type VariantAnalysisStatus =
  | "in_progress"
  | "succeeded"
  | "failed"
  | "cancelled";

export type VariantAnalysisFailureReason =
  | "no_repos_queried"
  | "actions_workflow_run_failed"
  | "internal_error";

export type VariantAnalysisRepoStatus =
  | "pending"
  | "in_progress"
  | "succeeded"
  | "failed"
  | "canceled"
  | "timed_out";

export interface VariantAnalysisScannedRepository {
  repository: RepositoryWithMetadata;
  analysis_status: VariantAnalysisRepoStatus;
  result_count?: number;
  artifact_size_in_bytes?: number;
  failure_message?: string;
}

export interface VariantAnalysisSkippedRepositoryGroup {
  repository_count: number;
  repositories: RepositoryWithMetadata[];
}

export interface VariantAnalysisNotFoundRepositoryGroup {
  repository_count: number;
  repository_full_names: string[];
}
export interface VariantAnalysisRepoTask {
  repository: Repository;
  analysis_status: VariantAnalysisRepoStatus;
  artifact_size_in_bytes?: number;
  result_count?: number;
  failure_message?: string;
  database_commit_sha?: string;
  source_location_prefix?: string;
  artifact_url?: string;
}

export interface VariantAnalysisSkippedRepositories {
  access_mismatch_repos?: VariantAnalysisSkippedRepositoryGroup;
  not_found_repos?: VariantAnalysisNotFoundRepositoryGroup;
  no_codeql_db_repos?: VariantAnalysisSkippedRepositoryGroup;
  over_limit_repos?: VariantAnalysisSkippedRepositoryGroup;
}
