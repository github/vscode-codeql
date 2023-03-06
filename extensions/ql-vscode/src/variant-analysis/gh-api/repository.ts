/**
 * Defines basic information about a repository.
 *
 * Different parts of the API may return different subsets of information
 * about a repository, but this model represents the very basic information
 * that will always be available.
 */
export interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
}

export interface RepositoryWithMetadata extends Repository {
  stargazers_count: number;
  updated_at: string | null;
}
