export interface RemoteQueriesSubmissionRequest {
  ref: string;
  language: string;
  repositories?: string[];
  repository_lists?: string[];
  repository_owners?: string[];
  query_pack: string;
}

export interface RemoteQueriesResponse {
  workflow_run_id: number;
  errors?: {
    invalid_repositories?: string[];
    repositories_without_database?: string[];
    private_repositories?: string[];
    cutoff_repositories?: string[];
    cutoff_repositories_count?: number;
  };
  repositories_queried: string[];
}
