import { VariantAnalysisScannedRepositoryDownloadStatus } from "../shared/variant-analysis";

export interface VariantAnalysisScannedRepositoryStateData {
  repositoryId: number;
  downloadStatus: VariantAnalysisScannedRepositoryDownloadStatus;
  downloadPercentage?: number;
}
