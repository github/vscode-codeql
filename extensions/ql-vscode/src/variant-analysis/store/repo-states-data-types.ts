export interface VariantAnalysisScannedRepositoryStateData {
  repositoryId: number;
  downloadStatus: VariantAnalysisScannedRepositoryDownloadData;
  downloadPercentage?: number;
}

export enum VariantAnalysisScannedRepositoryDownloadData {
  Pending = "pending",
  InProgress = "inProgress",
  Succeeded = "succeeded",
  Failed = "failed",
}
