import {
  VariantAnalysisScannedRepositoryState,
  VariantAnalysisScannedRepositoryDownloadStatus,
} from "../shared/variant-analysis";
import {
  VariantAnalysisScannedRepositoryStateData,
  VariantAnalysisScannedRepositoryDownloadData,
} from "./repo-states-data-types";

export function mapRepoStateToDomain(
  repoState: VariantAnalysisScannedRepositoryStateData,
): VariantAnalysisScannedRepositoryState {
  return {
    repositoryId: repoState.repositoryId,
    downloadStatus: processDownloadStatus(repoState.downloadStatus),
    downloadPercentage: repoState.downloadPercentage,
  };
}

function processDownloadStatus(
  downloadedStatus: VariantAnalysisScannedRepositoryDownloadData,
) {
  switch (downloadedStatus) {
    case VariantAnalysisScannedRepositoryDownloadData.Pending:
      return VariantAnalysisScannedRepositoryDownloadStatus.Pending;
    case VariantAnalysisScannedRepositoryDownloadData.InProgress:
      return VariantAnalysisScannedRepositoryDownloadStatus.InProgress;
    case VariantAnalysisScannedRepositoryDownloadData.Succeeded:
      return VariantAnalysisScannedRepositoryDownloadStatus.Succeeded;
    case VariantAnalysisScannedRepositoryDownloadData.Failed:
      return VariantAnalysisScannedRepositoryDownloadStatus.Failed;
    default:
      return VariantAnalysisScannedRepositoryDownloadStatus.Pending;
  }
}
