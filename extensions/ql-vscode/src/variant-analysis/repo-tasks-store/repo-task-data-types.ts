export interface VariantAnalysisRepositoryTaskData {
  repository: RepositoryData;
  analysisStatus: VariantAnalysisRepoStatusData;
  resultCount?: number;
  artifactSizeInBytes?: number;
  failureMessage?: string;
  databaseCommitSha?: string;
  sourceLocationPrefix?: string;
  artifactUrl?: string;
}

interface RepositoryData {
  id: number;
  fullName: string;
  private: boolean;
}

export enum VariantAnalysisRepoStatusData {
  Pending = "pending",
  InProgress = "inProgress",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
  TimedOut = "timedOut",
}
