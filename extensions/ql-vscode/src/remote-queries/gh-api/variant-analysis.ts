import * as t from "io-ts";
import { Repository, RepositoryWithMetadata } from "./repository";

export interface VariantAnalysisSubmissionRequest {
  action_repo_ref: string;
  language: VariantAnalysisQueryLanguage;
  query_pack: string;
  repositories?: string[];
  repository_lists?: string[];
  repository_owners?: string[];
}

export const VariantAnalysisQueryLanguage = t.keyof({
  csharp: null,
  cpp: null,
  go: null,
  java: null,
  javascript: null,
  python: null,
  ruby: null,
  swift: null,
});

export type VariantAnalysisQueryLanguage = t.TypeOf<
  typeof VariantAnalysisQueryLanguage
>;

export const VariantAnalysisStatus = t.keyof({
  in_progress: null,
  succeeded: null,
  failed: null,
  cancelled: null,
});

export type VariantAnalysisStatus = t.TypeOf<typeof VariantAnalysisStatus>;

export const VariantAnalysisFailureReason = t.keyof({
  no_repos_queried: null,
  actions_workflow_run_failed: null,
  internal_error: null,
});

export type VariantAnalysisFailureReason = t.TypeOf<
  typeof VariantAnalysisFailureReason
>;

export const VariantAnalysisRepoStatus = t.keyof({
  pending: null,
  in_progress: null,
  succeeded: null,
  failed: null,
  canceled: null,
  timed_out: null,
});

export type VariantAnalysisRepoStatus = t.TypeOf<
  typeof VariantAnalysisRepoStatus
>;

export const VariantAnalysisScannedRepository = t.intersection([
  t.type({
    repository: RepositoryWithMetadata,
    analysis_status: VariantAnalysisRepoStatus,
  }),
  t.partial({
    result_count: t.number,
    artifact_size_in_bytes: t.number,
    failure_message: t.string,
  }),
]);

export type VariantAnalysisScannedRepository = t.TypeOf<
  typeof VariantAnalysisScannedRepository
>;

export const VariantAnalysisSkippedRepositoryGroup = t.type({
  repository_count: t.number,
  repositories: t.array(RepositoryWithMetadata),
});

export type VariantAnalysisSkippedRepositoryGroup = t.TypeOf<
  typeof VariantAnalysisSkippedRepositoryGroup
>;

export const VariantAnalysisNotFoundRepositoryGroup = t.type({
  repository_count: t.number,
  repository_full_names: t.array(t.string),
});

export type VariantAnalysisNotFoundRepositoryGroup = t.TypeOf<
  typeof VariantAnalysisNotFoundRepositoryGroup
>;

export const VariantAnalysisRepoTask = t.intersection([
  t.type({
    repository: Repository,
    analysis_status: VariantAnalysisRepoStatus,
  }),
  t.partial({
    artifact_size_in_bytes: t.number,
    result_count: t.number,
    failure_message: t.string,
    database_commit_sha: t.string,
    source_location_prefix: t.string,
    artifact_url: t.string,
  }),
]);

export type VariantAnalysisRepoTask = t.TypeOf<typeof VariantAnalysisRepoTask>;

export const VariantAnalysisSkippedRepositories = t.partial({
  access_mismatch_repos: VariantAnalysisSkippedRepositoryGroup,
  not_found_repos: VariantAnalysisNotFoundRepositoryGroup,
  no_codeql_db_repos: VariantAnalysisSkippedRepositoryGroup,
  over_limit_repos: VariantAnalysisSkippedRepositoryGroup,
});

export type VariantAnalysisSkippedRepositories = t.TypeOf<
  typeof VariantAnalysisSkippedRepositories
>;

export const VariantAnalysis = t.intersection([
  t.type({
    id: t.number,
    controller_repo: Repository,
    query_language: VariantAnalysisQueryLanguage,
    query_pack_url: t.string,
    created_at: t.string,
    updated_at: t.string,
    status: VariantAnalysisStatus,
  }),
  t.partial({
    completed_at: t.string,
    actions_workflow_run_id: t.number,
    failure_reason: VariantAnalysisFailureReason,
    scanned_repositories: t.array(VariantAnalysisScannedRepository),
    skipped_repositories: VariantAnalysisSkippedRepositories,
  }),
]);

export type VariantAnalysis = t.TypeOf<typeof VariantAnalysis>;
