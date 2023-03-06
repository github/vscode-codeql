export interface Repository {
  id: number;
  fullName: string;
  private: boolean;
}

export interface RepositoryWithMetadata extends Repository {
  stargazersCount: number;
  updatedAt: string | null;
}
