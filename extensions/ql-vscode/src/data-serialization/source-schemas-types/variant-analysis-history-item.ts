export interface VariantAnalysisHistoryItem {
  readonly t: "variant-analysis";
  failureReason?: string;
  resultCount?: number;
  status: QueryStatus;
  completed: boolean;
  variantAnalysis: VariantAnalysis;
  userSpecifiedLabel?: string;
}

enum QueryStatus {
  InProgress = "InProgress",
  Completed = "Completed",
  Failed = "Failed",
}

interface VariantAnalysis {
  id: number;
  controllerRepo: Repository;
  query: {
    name: string;
    filePath: string;
    language: VariantAnalysisQueryLanguage;
    text: string;
  };
  databases: {
    repositories?: string[];
    repositoryLists?: string[];
    repositoryOwners?: string[];
  };
  createdAt: string;
  updatedAt: string;
  executionStartTime: number;
  status: VariantAnalysisStatus;
  completedAt?: string;
  actionsWorkflowRunId?: number;
  failureReason?: VariantAnalysisFailureReason;
  scannedRepos?: VariantAnalysisScannedRepository[];
  skippedRepos?: VariantAnalysisSkippedRepositories;
}

interface Repository {
  id: number;
  fullName: string;
  private: boolean;
}

enum VariantAnalysisQueryLanguage {
  CSharp = "csharp",
  Cpp = "cpp",
  Go = "go",
  Java = "java",
  Javascript = "javascript",
  Python = "python",
  Ruby = "ruby",
  Swift = "swift",
}

enum VariantAnalysisStatus {
  InProgress = "inProgress",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
}

enum VariantAnalysisFailureReason {
  NoReposQueried = "noReposQueried",
  ActionsWorkflowRunFailed = "actionsWorkflowRunFailed",
  InternalError = "internalError",
}

enum VariantAnalysisRepoStatus {
  Pending = "pending",
  InProgress = "inProgress",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
  TimedOut = "timedOut",
}

interface VariantAnalysisScannedRepository {
  repository: RepositoryWithMetadata;
  analysisStatus: VariantAnalysisRepoStatus;
  resultCount?: number;
  artifactSizeInBytes?: number;
  failureMessage?: string;
}

interface VariantAnalysisSkippedRepositories {
  accessMismatchRepos?: VariantAnalysisSkippedRepositoryGroup;
  notFoundRepos?: VariantAnalysisSkippedRepositoryGroup;
  noCodeqlDbRepos?: VariantAnalysisSkippedRepositoryGroup;
  overLimitRepos?: VariantAnalysisSkippedRepositoryGroup;
}

interface VariantAnalysisSkippedRepositoryGroup {
  repositoryCount: number;
  repositories: VariantAnalysisSkippedRepository[];
}

interface VariantAnalysisSkippedRepository {
  id?: number;
  fullName: string;
  private?: boolean;
  stargazersCount?: number;
  updatedAt?: string | null;
}

interface RepositoryWithMetadata extends Repository {
  stargazersCount: number;
  updatedAt: string | null;
}
