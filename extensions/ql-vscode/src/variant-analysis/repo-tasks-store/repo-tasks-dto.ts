export interface VariantAnalysisRepositoryTaskDto {
  repository: RepositoryDto;
  analysisStatus: VariantAnalysisRepoStatusDto;
  resultCount?: number;
  artifactSizeInBytes?: number;
  failureMessage?: string;
  databaseCommitSha?: string;
  sourceLocationPrefix?: string;
  artifactUrl?: string;
}

interface RepositoryDto {
  id: number;
  fullName: string;
  private: boolean;
}

export enum VariantAnalysisRepoStatusDto {
  Pending = "pending",
  InProgress = "inProgress",
  Succeeded = "succeeded",
  Failed = "failed",
  Canceled = "canceled",
  TimedOut = "timedOut",
}
