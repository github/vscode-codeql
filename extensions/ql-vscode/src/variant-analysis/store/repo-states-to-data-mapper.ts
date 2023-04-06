import { assertNever } from "../../pure/helpers-pure";
import {
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisScannedRepositoryState,
} from "../shared/variant-analysis";
import {
  VariantAnalysisScannedRepositoryDownloadData,
  VariantAnalysisScannedRepositoryStateData,
} from "./repo-states-data-types";

export function mapRepoStateToData(
  repoState: VariantAnalysisScannedRepositoryState,
): VariantAnalysisScannedRepositoryStateData {
  return {
    repositoryId: repoState.repositoryId,
    downloadStatus: processDownloadStatus(repoState.downloadStatus),
    downloadPercentage: repoState.downloadPercentage,
  };
}

function processDownloadStatus(
  downloadedStatus: VariantAnalysisScannedRepositoryDownloadStatus,
) {
  switch (downloadedStatus) {
    case VariantAnalysisScannedRepositoryDownloadStatus.Pending:
      return VariantAnalysisScannedRepositoryDownloadData.Pending;
    case VariantAnalysisScannedRepositoryDownloadStatus.InProgress:
      return VariantAnalysisScannedRepositoryDownloadData.InProgress;
    case VariantAnalysisScannedRepositoryDownloadStatus.Succeeded:
      return VariantAnalysisScannedRepositoryDownloadData.Succeeded;
    case VariantAnalysisScannedRepositoryDownloadStatus.Failed:
      return VariantAnalysisScannedRepositoryDownloadData.Failed;
    default:
      assertNever(downloadedStatus);
  }
}
