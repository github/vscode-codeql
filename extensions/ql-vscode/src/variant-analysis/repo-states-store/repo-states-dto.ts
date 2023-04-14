export interface VariantAnalysisScannedRepositoryStateDto {
  repositoryId: number;
  downloadStatus: VariantAnalysisScannedRepositoryDownloadDto;
  downloadPercentage?: number;
}

export enum VariantAnalysisScannedRepositoryDownloadDto {
  Pending = "pending",
  InProgress = "inProgress",
  Succeeded = "succeeded",
  Failed = "failed",
}
