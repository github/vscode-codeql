import { assertNever } from "../../pure/helpers-pure";
import {
  VariantAnalysisScannedRepositoryDownloadStatus,
  VariantAnalysisScannedRepositoryState,
} from "../shared/variant-analysis";
import {
  VariantAnalysisScannedRepositoryDownloadDto,
  VariantAnalysisScannedRepositoryStateDto,
} from "./repo-states-dto";

export function mapRepoStateToDto(
  repoState: VariantAnalysisScannedRepositoryState,
): VariantAnalysisScannedRepositoryStateDto {
  return {
    repositoryId: repoState.repositoryId,
    downloadStatus: mapDownloadStatusToDto(repoState.downloadStatus),
    downloadPercentage: repoState.downloadPercentage,
  };
}

function mapDownloadStatusToDto(
  downloadedStatus: VariantAnalysisScannedRepositoryDownloadStatus,
) {
  switch (downloadedStatus) {
    case VariantAnalysisScannedRepositoryDownloadStatus.Pending:
      return VariantAnalysisScannedRepositoryDownloadDto.Pending;
    case VariantAnalysisScannedRepositoryDownloadStatus.InProgress:
      return VariantAnalysisScannedRepositoryDownloadDto.InProgress;
    case VariantAnalysisScannedRepositoryDownloadStatus.Succeeded:
      return VariantAnalysisScannedRepositoryDownloadDto.Succeeded;
    case VariantAnalysisScannedRepositoryDownloadStatus.Failed:
      return VariantAnalysisScannedRepositoryDownloadDto.Failed;
    default:
      assertNever(downloadedStatus);
  }
}
